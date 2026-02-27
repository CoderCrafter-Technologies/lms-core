const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./src/models/User');
const Role = require('./src/models/Role');
const Course = require('./src/models/Course');
const Batch = require('./src/models/Batch');
const LiveClass = require('./src/models/LiveClass');
const Enrollment = require('./src/models/Enrollment');

async function testStudentFeatures() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // Test student login
    console.log('\n🧪 Testing Student Features...\n');

    // 1. Verify student account
    const student = await User.findOne({ email: 'student@lmsfutureproof.com' }).populate('roleId');
    
    if (!student) {
      console.log('❌ Student account not found');
      return;
    }

    console.log('✅ Student Account Found:');
    console.log(`   👤 Name: ${student.firstName} ${student.lastName}`);
    console.log(`   📧 Email: ${student.email}`);
    console.log(`   🎭 Role: ${student.roleId.displayName}`);
    console.log(`   📱 Phone: ${student.phone}`);
    console.log(`   ✅ Active: ${student.isActive}`);
    console.log(`   📧 Email Verified: ${student.isEmailVerified}`);

    // 2. Test password verification
    const isPasswordValid = await bcrypt.compare('student123', student.password);
    console.log(`   🔐 Password Valid: ${isPasswordValid}`);

    if (!isPasswordValid) {
      console.log('❌ Password validation failed');
      return;
    }

    // 3. Get student enrollments
    console.log('\n📚 Student Enrollments:');
    const enrollments = await Enrollment.findByStudent(student._id);
    
    if (enrollments.length === 0) {
      console.log('   ℹ️  No enrollments found');
    } else {
      enrollments.forEach((enrollment, index) => {
        console.log(`   ${index + 1}. Course: ${enrollment.courseId.title}`);
        console.log(`      Batch: ${enrollment.batchId.name} (${enrollment.batchId.batchCode})`);
        console.log(`      Status: ${enrollment.status}`);
        console.log(`      Progress: ${enrollment.progress.completionPercentage}%`);
        console.log(`      Attendance: ${enrollment.attendance.attendancePercentage}%`);
        console.log(`      Payment: ${enrollment.payment.status}`);
        console.log('');
      });
    }

    // 4. Get upcoming live classes for enrolled batches
    console.log('📅 Upcoming Live Classes:');
    const upcomingClasses = await LiveClass.find({
      batchId: { $in: enrollments.map(e => e.batchId._id) },
      status: 'SCHEDULED',
      scheduledStartTime: { $gt: new Date() }
    }).populate('batchId', 'name batchCode').sort({ scheduledStartTime: 1 }).limit(5);

    if (upcomingClasses.length === 0) {
      console.log('   ℹ️  No upcoming classes found');
    } else {
      upcomingClasses.forEach((liveClass, index) => {
        const timeUntil = Math.ceil((liveClass.scheduledStartTime - new Date()) / (1000 * 60));
        console.log(`   ${index + 1}. ${liveClass.title}`);
        console.log(`      Batch: ${liveClass.batchId.name}`);
        console.log(`      Scheduled: ${liveClass.scheduledStartTime.toLocaleString()}`);
        console.log(`      Duration: ${liveClass.scheduledDuration} minutes`);
        console.log(`      Time until start: ${timeUntil > 0 ? timeUntil + ' minutes' : 'Starting soon!'}`);
        console.log(`      Room ID: ${liveClass.roomId}`);
        console.log(`      Status: ${liveClass.status}`);
        console.log('');
      });
    }

    // 5. Get currently live classes for enrolled batches
    console.log('🔴 Currently Live Classes:');
    const liveClasses = await LiveClass.find({
      batchId: { $in: enrollments.map(e => e.batchId._id) },
      status: 'LIVE'
    }).populate('batchId', 'name batchCode').populate('instructorId', 'firstName lastName');

    if (liveClasses.length === 0) {
      console.log('   ℹ️  No live classes currently running');
    } else {
      liveClasses.forEach((liveClass, index) => {
        const duration = Math.floor((new Date() - liveClass.actualStartTime) / (1000 * 60));
        console.log(`   ${index + 1}. 🔴 ${liveClass.title} (LIVE)`);
        console.log(`      Batch: ${liveClass.batchId.name}`);
        console.log(`      Instructor: ${liveClass.instructorId.firstName} ${liveClass.instructorId.lastName}`);
        console.log(`      Started: ${liveClass.actualStartTime.toLocaleString()}`);
        console.log(`      Duration: ${duration} minutes`);
        console.log(`      Room ID: ${liveClass.roomId}`);
        console.log(`      🎯 JOIN URL: http://localhost:3000/classroom/${liveClass.roomId}`);
        console.log('');
      });
    }

    // 6. Get available courses (not enrolled)
    console.log('🛍️ Available Courses (Not Enrolled):');
    const enrolledCourseIds = enrollments.map(e => e.courseId._id);
    const availableCourses = await Course.find({
      _id: { $nin: enrolledCourseIds },
      status: 'PUBLISHED',
      isPublic: true
    }).limit(3);

    if (availableCourses.length === 0) {
      console.log('   ℹ️  No additional courses available');
    } else {
      availableCourses.forEach((course, index) => {
        console.log(`   ${index + 1}. ${course.title}`);
        console.log(`      Category: ${course.category}`);
        console.log(`      Level: ${course.level}`);
        console.log(`      Duration: ${course.formattedDuration}`);
        console.log(`      Price: ${course.priceDisplay}`);
        console.log(`      Rating: ${course.averageRating}/5 (${course.totalRatings} ratings)`);
        console.log('');
      });
    }

    // 7. Test whiteboard features (check settings)
    console.log('🖼️ Whiteboard Feature Test:');
    const whiteboardClasses = await LiveClass.find({
      'settings.allowWhiteboard': true,
      status: { $in: ['LIVE', 'SCHEDULED'] }
    }).limit(3);

    console.log(`   ✅ Classes with whiteboard enabled: ${whiteboardClasses.length}`);
    whiteboardClasses.forEach((liveClass, index) => {
      console.log(`   ${index + 1}. ${liveClass.title} (${liveClass.status})`);
      console.log(`      Whiteboard: ✅ Enabled`);
      console.log(`      Screen Share: ${liveClass.settings.allowScreenShare ? '✅' : '❌'}`);
      console.log(`      Chat: ${liveClass.settings.allowChat ? '✅' : '❌'}`);
      console.log(`      Student Mic: ${liveClass.settings.allowStudentMic ? '✅' : '❌'}`);
      console.log(`      Student Camera: ${liveClass.settings.allowStudentCamera ? '✅' : '❌'}`);
      console.log('');
    });

    console.log('\n🎯 TESTING SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Student account verification: PASSED');
    console.log('✅ Password authentication: PASSED');
    console.log(`✅ Course enrollments: ${enrollments.length} found`);
    console.log(`✅ Upcoming classes: ${upcomingClasses.length} found`);
    console.log(`✅ Live classes: ${liveClasses.length} found`);
    console.log(`✅ Available courses: ${availableCourses.length} found`);
    console.log(`✅ Whiteboard-enabled classes: ${whiteboardClasses.length} found`);

    console.log('\n🎓 STUDENT TEST SCENARIOS:');
    console.log('1. Login with: student@lmsfutureproof.com / student123');
    console.log('2. View dashboard with enrolled courses and upcoming classes');
    console.log('3. Join live classes using the room URLs shown above');
    console.log('4. Test whiteboard functionality in live classes');
    console.log('5. View course progress and attendance statistics');
    console.log('6. Browse and enroll in additional courses');

    if (liveClasses.length > 0) {
      console.log('\n🚀 IMMEDIATE TESTING OPPORTUNITIES:');
      liveClasses.forEach(liveClass => {
        console.log(`• Join LIVE class: "${liveClass.title}"`);
        console.log(`  URL: http://localhost:3000/classroom/${liveClass.roomId}`);
      });
    }

  } catch (error) {
    console.error('❌ Error testing student features:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

// Run the test
testStudentFeatures();