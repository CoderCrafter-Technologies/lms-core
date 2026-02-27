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

async function createEnhancedTestData() {
  try {
    console.log('🚀 Creating Enhanced Test Data for Live Classes...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // Get existing roles
    const studentRole = await Role.findOne({ name: 'STUDENT' });
    const instructorRole = await Role.findOne({ name: 'INSTRUCTOR' });
    const adminRole = await Role.findOne({ name: 'ADMIN' });

    // 1. Create multiple student accounts
    const additionalStudents = [
      {
        email: 'student1@lmsfutureproof.com',
        password: 'student123',
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '+1234567893'
      },
      {
        email: 'student2@lmsfutureproof.com',
        password: 'student123',
        firstName: 'Bob',
        lastName: 'Wilson',
        phone: '+1234567894'
      },
      {
        email: 'student3@lmsfutureproof.com',
        password: 'student123',
        firstName: 'Carol',
        lastName: 'Davis',
        phone: '+1234567895'
      },
      {
        email: 'student4@lmsfutureproof.com',
        password: 'student123',
        firstName: 'David',
        lastName: 'Miller',
        phone: '+1234567896'
      },
      {
        email: 'student5@lmsfutureproof.com',
        password: 'student123',
        firstName: 'Emma',
        lastName: 'Brown',
        phone: '+1234567897'
      }
    ];

    console.log('👥 Creating additional student accounts...');
    const createdStudents = [];
    
    for (const studentData of additionalStudents) {
      const existingUser = await User.findOne({ email: studentData.email });
      
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(studentData.password, 12);
        
        const newStudent = new User({
          email: studentData.email,
          password: hashedPassword,
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          phone: studentData.phone,
          roleId: studentRole._id,
          isActive: true,
          isEmailVerified: true
        });

        await newStudent.save();
        createdStudents.push(newStudent);
        console.log(`✅ Created student: ${studentData.firstName} ${studentData.lastName}`);
      } else {
        createdStudents.push(existingUser);
        console.log(`ℹ️  Student already exists: ${studentData.firstName} ${studentData.lastName}`);
      }
    }

    // 2. Create additional instructor accounts
    const additionalInstructors = [
      {
        email: 'instructor1@lmsfutureproof.com',
        password: 'instructor123',
        firstName: 'Dr. Sarah',
        lastName: 'Thompson',
        phone: '+1234567898'
      },
      {
        email: 'instructor2@lmsfutureproof.com',
        password: 'instructor123',
        firstName: 'Prof. Mike',
        lastName: 'Anderson',
        phone: '+1234567899'
      }
    ];

    console.log('\n👨‍🏫 Creating additional instructor accounts...');
    const createdInstructors = [];
    
    for (const instructorData of additionalInstructors) {
      const existingUser = await User.findOne({ email: instructorData.email });
      
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(instructorData.password, 12);
        
        const newInstructor = new User({
          email: instructorData.email,
          password: hashedPassword,
          firstName: instructorData.firstName,
          lastName: instructorData.lastName,
          phone: instructorData.phone,
          roleId: instructorRole._id,
          isActive: true,
          isEmailVerified: true
        });

        await newInstructor.save();
        createdInstructors.push(newInstructor);
        console.log(`✅ Created instructor: ${instructorData.firstName} ${instructorData.lastName}`);
      } else {
        createdInstructors.push(existingUser);
        console.log(`ℹ️  Instructor already exists: ${instructorData.firstName} ${instructorData.lastName}`);
      }
    }

    // 3. Get existing course and create a test batch for live class testing
    const testCourse = await Course.findOne({ title: 'Full Stack JavaScript Development' });
    if (!testCourse) {
      console.log('❌ Test course not found. Please run create_test_data.js first.');
      return;
    }

    // 4. Create a dedicated live class test batch
    const liveTestBatch = await createLiveTestBatch(testCourse._id, createdInstructors[0]._id);

    // 5. Enroll all students in the live test batch
    console.log('\n📝 Enrolling students in live test batch...');
    const admin = await User.findOne({ email: 'admin@lmsfutureproof.com' });
    const originalStudent = await User.findOne({ email: 'student@lmsfutureproof.com' });
    
    const allStudents = [originalStudent, ...createdStudents];
    
    for (const student of allStudents) {
      const existingEnrollment = await Enrollment.findOne({
        studentId: student._id,
        batchId: liveTestBatch._id
      });
      
      if (!existingEnrollment) {
        const enrollment = new Enrollment({
          studentId: student._id,
          courseId: testCourse._id,
          batchId: liveTestBatch._id,
          enrollmentDate: new Date(),
          status: 'ENROLLED',
          enrolledBy: admin._id,
          progress: {
            completedClasses: Math.floor(Math.random() * 3),
            totalClasses: 10,
            completionPercentage: Math.floor(Math.random() * 30)
          },
          attendance: {
            totalClasses: 8,
            attendedClasses: Math.floor(Math.random() * 8),
            attendancePercentage: 0
          },
          payment: {
            status: 'PAID',
            amount: 299,
            paidAt: new Date(),
            transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }
        });
        
        await enrollment.save();
        console.log(`✅ Enrolled ${student.firstName} ${student.lastName}`);
      }
    }

    // 6. Create a live class that's happening right now
    console.log('\n📹 Creating live test class...');
    const now = new Date();
    const liveClassStart = new Date(now.getTime() - (10 * 60 * 1000)); // Started 10 minutes ago
    const liveClassEnd = new Date(now.getTime() + (110 * 60 * 1000)); // Ends in 110 minutes

    const liveTestClass = new LiveClass({
      title: 'Live Multi-User Test Session - React Fundamentals',
      batchId: liveTestBatch._id,
      instructorId: createdInstructors[0]._id,
      scheduledStartTime: liveClassStart,
      scheduledEndTime: liveClassEnd,
      actualStartTime: liveClassStart,
      description: 'Interactive session for testing multiple users, screen sharing, and whiteboard features',
      agenda: '1. React Components\n2. State Management\n3. Interactive Whiteboard Exercise\n4. Screen Sharing Demo\n5. Q&A Session',
      roomId: `live_test_room_${Date.now()}`,
      status: 'LIVE',
      settings: {
        maxParticipants: 50,
        allowRecording: true,
        allowScreenShare: true,
        allowWhiteboard: true,
        allowChat: true,
        allowStudentMic: true,
        allowStudentCamera: true,
        requireApproval: false
      },
      stats: {
        totalParticipants: 0,
        peakParticipants: 0,
        averageParticipants: 0,
        totalChatMessages: 0
      },
      createdBy: admin._id
    });

    await liveTestClass.save();
    console.log(`✅ Created live test class: ${liveTestClass.title}`);
    console.log(`   Room ID: ${liveTestClass.roomId}`);

    // Print summary
    console.log('\n🎉 ENHANCED TEST DATA CREATED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n👥 TEST ACCOUNTS:');
    console.log('📚 Students (All enrolled in live test batch):');
    console.log('   • student@lmsfutureproof.com / student123 (Jane Student)');
    allStudents.slice(1).forEach(student => {
      console.log(`   • ${student.email} / student123 (${student.firstName} ${student.lastName})`);
    });
    
    console.log('\n👨‍🏫 Instructors (Associated with live test batch):');
    createdInstructors.forEach(instructor => {
      console.log(`   • ${instructor.email} / instructor123 (${instructor.firstName} ${instructor.lastName})`);
    });
    
    console.log('\n🔴 LIVE CLASS READY FOR TESTING:');
    console.log(`📹 Title: ${liveTestClass.title}`);
    console.log(`🎓 Batch: ${liveTestBatch.name}`);
    console.log(`👨‍🏫 Instructor: ${createdInstructors[0].firstName} ${createdInstructors[0].lastName}`);
    console.log(`🏠 Room ID: ${liveTestClass.roomId}`);
    console.log(`🌐 Join URL: http://localhost:3000/classroom/${liveTestClass.roomId}`);
    console.log(`📊 Enrolled Students: ${allStudents.length}`);
    
    console.log('\n🧪 MULTI-USER TEST SCENARIOS:');
    console.log('1. Join as different students to test multiple participants');
    console.log('2. Join as instructor to test instructor controls');
    console.log('3. Test screen sharing permissions (instructor vs student)');
    console.log('4. Test whiteboard collaboration with multiple users');
    console.log('5. Test student kick functionality (instructor only)');
    
  } catch (error) {
    console.error('❌ Error creating enhanced test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

async function createLiveTestBatch(courseId, instructorId) {
  const admin = await User.findOne({ email: 'admin@lmsfutureproof.com' });
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // Started a week ago
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 60); // Ends in 2 months
  
  const batchCode = `LIVE_TEST_${Date.now()}`;
  
  const batch = new Batch({
    name: 'Live Class Test Batch - Full Stack JavaScript',
    courseId: courseId,
    batchCode: batchCode,
    startDate: startDate,
    endDate: endDate,
    schedule: {
      days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      startTime: '14:00',
      endTime: '16:00',
      timezone: 'UTC'
    },
    maxStudents: 50,
    currentEnrollment: 0,
    instructorId: instructorId,
    status: 'ACTIVE',
    settings: {
      allowLateJoin: true,
      autoEnrollment: false,
      recordClasses: true,
      allowStudentChat: true
    },
    description: 'Dedicated batch for testing live class features with multiple users',
    createdBy: admin._id
  });
  
  await batch.save();
  console.log(`✅ Created live test batch: ${batch.name} (${batch.batchCode})`);
  return batch;
}

// Run the script
createEnhancedTestData();