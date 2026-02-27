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

async function createSyncTestData() {
  try {
    console.log('🔄 Creating Comprehensive Sync Test Data...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to MongoDB database...');

    // Get existing users
    const admin = await User.findOne({ email: 'admin@lmsfutureproof.com' });
    const instructor1 = await User.findOne({ email: 'instructor1@lmsfutureproof.com' });
    const instructor2 = await User.findOne({ email: 'instructor2@lmsfutureproof.com' });
    const students = await User.find({ 
      email: { $in: [
        'student@lmsfutureproof.com',
        'student1@lmsfutureproof.com',
        'student2@lmsfutureproof.com',
        'student3@lmsfutureproof.com',
        'student4@lmsfutureproof.com',
        'student5@lmsfutureproof.com'
      ]}
    });

    console.log(`Found ${students.length} students for testing`);

    // 1. Create comprehensive course structure for sync testing
    console.log('\n📚 Creating sync test courses...');
    
    const syncTestCourses = [
      {
        title: 'Sync Test - React Development',
        slug: 'sync-test-react-development',
        description: 'Complete React development course for testing panel synchronization',
        shortDescription: 'React development with sync testing',
        category: 'PROGRAMMING',
        level: 'INTERMEDIATE',
        estimatedDuration: { hours: 60, minutes: 0 },
        pricing: { type: 'PAID', amount: 199, currency: 'USD' },
        status: 'PUBLISHED',
        isPublic: true,
        tags: ['React', 'JavaScript', 'Frontend', 'Sync Test'],
        createdBy: admin._id,
        publishedAt: new Date()
      },
      {
        title: 'Sync Test - Python Data Science',
        slug: 'sync-test-python-data-science',
        description: 'Python data science course for testing admin-instructor-student sync',
        shortDescription: 'Python data science with sync testing',
        category: 'DATA_SCIENCE',
        level: 'BEGINNER',
        estimatedDuration: { hours: 80, minutes: 0 },
        pricing: { type: 'PAID', amount: 249, currency: 'USD' },
        status: 'PUBLISHED',
        isPublic: true,
        tags: ['Python', 'Data Science', 'Analytics', 'Sync Test'],
        createdBy: admin._id,
        publishedAt: new Date()
      },
      {
        title: 'Sync Test - Full Stack Development',
        slug: 'sync-test-full-stack-development',
        description: 'Full stack development course for comprehensive sync testing',
        shortDescription: 'Full stack development with sync testing',
        category: 'PROGRAMMING',
        level: 'ADVANCED',
        estimatedDuration: { hours: 120, minutes: 0 },
        pricing: { type: 'PAID', amount: 399, currency: 'USD' },
        status: 'PUBLISHED',
        isPublic: true,
        tags: ['Full Stack', 'Node.js', 'React', 'MongoDB', 'Sync Test'],
        createdBy: admin._id,
        publishedAt: new Date()
      }
    ];

    const createdCourses = [];
    for (const courseData of syncTestCourses) {
      const existingCourse = await Course.findOne({ slug: courseData.slug });
      if (!existingCourse) {
        const course = new Course(courseData);
        await course.save();
        createdCourses.push(course);
        console.log(`✅ Created course: ${course.title}`);
      } else {
        createdCourses.push(existingCourse);
        console.log(`ℹ️  Course exists: ${existingCourse.title}`);
      }
    }

    // 2. Create batches with different instructors
    console.log('\n🎓 Creating sync test batches...');
    
    const batchTemplates = [
      {
        name: 'Morning Sync Test Batch',
        schedule: {
          days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
          startTime: '09:00',
          endTime: '11:00',
          timezone: 'UTC'
        },
        maxStudents: 15,
        instructor: instructor1
      },
      {
        name: 'Evening Sync Test Batch',
        schedule: {
          days: ['TUESDAY', 'THURSDAY'],
          startTime: '18:00',
          endTime: '20:00',
          timezone: 'UTC'
        },
        maxStudents: 20,
        instructor: instructor2
      },
      {
        name: 'Weekend Intensive Sync Batch',
        schedule: {
          days: ['SATURDAY', 'SUNDAY'],
          startTime: '10:00',
          endTime: '15:00',
          timezone: 'UTC'
        },
        maxStudents: 12,
        instructor: instructor1
      }
    ];

    const createdBatches = [];
    
    for (let courseIndex = 0; courseIndex < createdCourses.length; courseIndex++) {
      const course = createdCourses[courseIndex];
      
      for (let batchIndex = 0; batchIndex < batchTemplates.length; batchIndex++) {
        const template = batchTemplates[batchIndex];
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + (batchIndex * 7) + 1); // Stagger start dates
        
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 90); // 3 months duration
        
        const batchCode = `SYNC${courseIndex + 1}${batchIndex + 1}_${Date.now().toString().slice(-6)}`;
        
        const batch = new Batch({
          name: `${course.title.split(' - ')[1]} - ${template.name}`,
          courseId: course._id,
          batchCode: batchCode,
          startDate: startDate,
          endDate: endDate,
          schedule: template.schedule,
          maxStudents: template.maxStudents,
          currentEnrollment: 0,
          instructorId: template.instructor._id,
          status: 'UPCOMING',
          settings: {
            allowLateJoin: true,
            autoEnrollment: false,
            recordClasses: true,
            allowStudentChat: true
          },
          description: `Sync testing batch for ${course.title}. Instructor: ${template.instructor.firstName} ${template.instructor.lastName}`,
          createdBy: admin._id
        });
        
        await batch.save();
        createdBatches.push(batch);
        console.log(`✅ Created batch: ${batch.name} (${batch.batchCode}) - Instructor: ${template.instructor.firstName} ${template.instructor.lastName}`);
      }
    }

    // 3. Enroll students in batches (distributed enrollment)
    console.log('\n📝 Creating sync test enrollments...');
    
    const enrollmentPromises = [];
    
    createdBatches.forEach((batch, batchIndex) => {
      // Enroll 3-5 students per batch
      const studentsToEnroll = students.slice(0, 3 + (batchIndex % 3));
      
      studentsToEnroll.forEach((student, studentIndex) => {
        const enrollmentPromise = async () => {
          const enrollment = new Enrollment({
            studentId: student._id,
            courseId: batch.courseId,
            batchId: batch._id,
            enrollmentDate: new Date(),
            status: 'ENROLLED',
            enrolledBy: admin._id,
            progress: {
              completedClasses: Math.floor(Math.random() * 3),
              totalClasses: 20,
              completionPercentage: Math.floor(Math.random() * 25)
            },
            attendance: {
              totalClasses: 5,
              attendedClasses: Math.floor(Math.random() * 5),
              attendancePercentage: 0
            },
            payment: {
              status: 'PAID',
              amount: batch.courseId === createdCourses[0]._id ? 199 : 
                      batch.courseId === createdCourses[1]._id ? 249 : 399,
              paidAt: new Date(),
              transactionId: `SYNC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }
          });
          
          await enrollment.save();
          
          // Update batch enrollment count
          await Batch.findByIdAndUpdate(batch._id, {
            $inc: { currentEnrollment: 1 }
          });
          
          console.log(`✅ Enrolled ${student.firstName} ${student.lastName} in ${batch.name}`);
        };
        
        enrollmentPromises.push(enrollmentPromise());
      });
    });
    
    await Promise.all(enrollmentPromises);

    // 4. Create 24-hour live classes for testing
    console.log('\n📹 Creating 24-hour sync test live classes...');
    
    const now = new Date();
    const testClasses = [
      {
        title: '24-Hour Sync Test - React Fundamentals Live Session',
        batchId: createdBatches[0]._id,
        instructorId: instructor1._id,
        scheduledStartTime: new Date(now.getTime() + (1 * 60 * 60 * 1000)), // 1 hour from now
        scheduledEndTime: new Date(now.getTime() + (25 * 60 * 60 * 1000)), // 25 hours from now (24h + 1h buffer)
        description: '24-hour comprehensive React fundamentals session with live coding, Q&A, and hands-on projects',
        agenda: 'Hour 1-6: React Basics\nHour 7-12: State Management\nHour 13-18: Component Architecture\nHour 19-24: Project Building',
        status: 'SCHEDULED'
      },
      {
        title: '24-Hour Sync Test - Python Data Analysis Marathon',
        batchId: createdBatches[4]._id,
        instructorId: instructor2._id,
        scheduledStartTime: new Date(now.getTime() + (2 * 60 * 60 * 1000)), // 2 hours from now
        scheduledEndTime: new Date(now.getTime() + (26 * 60 * 60 * 1000)), // 26 hours from now
        description: '24-hour intensive Python data analysis session with real-world datasets',
        agenda: 'Hour 1-6: Data Cleaning\nHour 7-12: Exploratory Analysis\nHour 13-18: Machine Learning\nHour 19-24: Project Presentation',
        status: 'SCHEDULED'
      },
      {
        title: 'Sync Test - Immediate Live Class',
        batchId: createdBatches[2]._id,
        instructorId: instructor1._id,
        scheduledStartTime: new Date(now.getTime() - (5 * 60 * 1000)), // Started 5 minutes ago
        scheduledEndTime: new Date(now.getTime() + (115 * 60 * 1000)), // Ends in 115 minutes
        actualStartTime: new Date(now.getTime() - (5 * 60 * 1000)),
        description: 'Currently live session for immediate sync testing',
        agenda: 'Live coding session with Q&A',
        status: 'LIVE'
      }
    ];

    const createdClasses = [];
    for (const classData of testClasses) {
      const liveClass = new LiveClass({
        ...classData,
        roomId: `sync_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
          totalParticipants: classData.status === 'LIVE' ? Math.floor(Math.random() * 10) : 0,
          peakParticipants: 0,
          averageParticipants: 0,
          totalChatMessages: 0
        },
        createdBy: admin._id
      });
      
      await liveClass.save();
      createdClasses.push(liveClass);
      console.log(`✅ Created ${classData.status} class: ${liveClass.title}`);
      console.log(`   🌐 Room ID: ${liveClass.roomId}`);
      console.log(`   👨‍🏫 Instructor: ${classData.instructorId === instructor1._id ? 'Dr. Sarah Thompson' : 'Prof. Mike Anderson'}`);
    }

    // 5. Generate test credentials and access information
    console.log('\n🎉 COMPREHENSIVE SYNC TEST DATA CREATED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n📊 SYNC TEST DATA SUMMARY:');
    console.log(`📚 Courses: ${createdCourses.length} (with hierarchical structure)`);
    console.log(`🎓 Batches: ${createdBatches.length} (distributed across instructors)`);
    console.log(`📹 Live Classes: ${createdClasses.length} (including 24-hour sessions)`);
    console.log(`📝 Enrollments: Cross-batch distributed enrollment`);

    console.log('\n🔑 TEST CREDENTIALS FOR SYNC VALIDATION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n👑 ADMIN (Complete System Oversight):');
    console.log('📧 Email: admin@lmsfutureproof.com');
    console.log('🔐 Password: admin123456');
    console.log('✅ Access: All courses, batches, instructors, students, analytics');
    
    console.log('\n👨‍🏫 INSTRUCTORS (Batch & Student Management):');
    console.log('1. Dr. Sarah Thompson (instructor1@lmsfutureproof.com / instructor123)');
    console.log('   - Assigned Batches: React batches + Full Stack weekend batch');
    console.log('   - 24-Hour Class: React Fundamentals Live Session');
    console.log('   - Live Now: Sync Test - Immediate Live Class');
    
    console.log('\n2. Prof. Mike Anderson (instructor2@lmsfutureproof.com / instructor123)');
    console.log('   - Assigned Batches: Python batches + Full Stack evening batch');
    console.log('   - 24-Hour Class: Python Data Analysis Marathon');
    
    console.log('\n👨‍🎓 STUDENTS (Course & Class Access):');
    console.log('All students enrolled across multiple batches for cross-panel sync testing:');
    students.forEach((student, index) => {
      console.log(`${index + 1}. ${student.firstName} ${student.lastName} (${student.email} / student123)`);
    });

    console.log('\n🧪 SYNC TESTING SCENARIOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 📋 ADMIN CREATES → INSTRUCTOR SEES → STUDENT ENROLLS');
    console.log('   • Admin creates course/batch → Should instantly appear in instructor panel');
    console.log('   • Admin enrolls students → Should instantly appear in student panel');
    
    console.log('\n2. 📅 INSTRUCTOR SCHEDULES → ADMIN OVERSEES → STUDENTS ACCESS');
    console.log('   • Instructor creates live class → Should appear in admin oversight');
    console.log('   • Instructor schedules class → Students see in their dashboard');
    
    console.log('\n3. 🎓 HIERARCHICAL RESOURCE ISOLATION');
    console.log('   • Course resources visible to all batches of that course');
    console.log('   • Batch resources isolated to specific batch students only');
    console.log('   • Class resources isolated to class participants only');

    console.log('\n🌐 24-HOUR LIVE CLASS TEST URLS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    createdClasses.forEach((liveClass, index) => {
      console.log(`${index + 1}. ${liveClass.title}`);
      console.log(`   🔗 URL: http://localhost:3000/classroom/${liveClass.roomId}`);
      console.log(`   ⏰ ${liveClass.status}: ${liveClass.scheduledStartTime.toLocaleString()}`);
      console.log('');
    });

    console.log('🚀 READY FOR COMPREHENSIVE SYNC VALIDATION TESTING!');

  } catch (error) {
    console.error('❌ Error creating sync test data:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

// Run the script
createSyncTestData();