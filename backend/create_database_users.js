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

async function createDatabaseUsers() {
  try {
    console.log('🔧 Creating Users Directly in Database...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to MongoDB database...');

    // Clear existing test users (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing test users...');
    await User.deleteMany({ 
      email: { 
        $in: [
          'admin@lmsfutureproof.com',
          'instructor@lmsfutureproof.com',
          'instructor1@lmsfutureproof.com',
          'instructor2@lmsfutureproof.com',
          'student@lmsfutureproof.com',
          'student1@lmsfutureproof.com',
          'student2@lmsfutureproof.com',
          'student3@lmsfutureproof.com',
          'student4@lmsfutureproof.com',
          'student5@lmsfutureproof.com'
        ] 
      } 
    });

    // 1. Create Roles First
    console.log('🎭 Creating roles in database...');
    const rolesData = [
      {
        name: 'ADMIN',
        displayName: 'Administrator',
        description: 'System administrator with full access',
        level: 1,
        isActive: true,
        isSystemRole: true
      },
      {
        name: 'INSTRUCTOR',
        displayName: 'Instructor',
        description: 'Course instructor with teaching capabilities',
        level: 2,
        isActive: true,
        isSystemRole: true
      },
      {
        name: 'STUDENT',
        displayName: 'Student',
        description: 'Student with learning access',
        level: 3,
        isActive: true,
        isSystemRole: true
      }
    ];

    const createdRoles = {};
    for (const roleData of rolesData) {
      const role = await Role.findOneAndUpdate(
        { name: roleData.name },
        roleData,
        { upsert: true, new: true }
      );
      createdRoles[roleData.name] = role._id;
      console.log(`✅ Role created: ${roleData.displayName}`);
    }

    // 2. Create Users with Proper Database Structure
    console.log('\n👥 Creating users in database...');
    
    const usersData = [
      {
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@lmsfutureproof.com',
        password: 'admin123456',
        phone: '+1234567890',
        roleId: createdRoles.ADMIN,
        isActive: true,
        isEmailVerified: true
      },
      {
        firstName: 'John',
        lastName: 'Instructor',
        email: 'instructor@lmsfutureproof.com',
        password: 'instructor123',
        phone: '+1234567891',
        roleId: createdRoles.INSTRUCTOR,
        isActive: true,
        isEmailVerified: true,
        profile: {
          bio: 'Experienced instructor with 10+ years of teaching',
          specialization: ['JavaScript', 'React', 'Node.js'],
          experience: 10,
          qualification: 'PhD in Computer Science'
        }
      },
      {
        firstName: 'Dr. Sarah',
        lastName: 'Thompson',
        email: 'instructor1@lmsfutureproof.com',
        password: 'instructor123',
        phone: '+1234567898',
        roleId: createdRoles.INSTRUCTOR,
        isActive: true,
        isEmailVerified: true,
        profile: {
          bio: 'Expert in data science and machine learning',
          specialization: ['Python', 'Data Science', 'Machine Learning'],
          experience: 8,
          qualification: 'PhD in Data Science'
        }
      },
      {
        firstName: 'Prof. Mike',
        lastName: 'Anderson',
        email: 'instructor2@lmsfutureproof.com',
        password: 'instructor123',
        phone: '+1234567899',
        roleId: createdRoles.INSTRUCTOR,
        isActive: true,
        isEmailVerified: true,
        profile: {
          bio: 'UI/UX design specialist with industry experience',
          specialization: ['UI/UX Design', 'Figma', 'Design Thinking'],
          experience: 12,
          qualification: 'Master of Design'
        }
      },
      {
        firstName: 'Jane',
        lastName: 'Student',
        email: 'student@lmsfutureproof.com',
        password: 'student123',
        phone: '+1234567892',
        roleId: createdRoles.STUDENT,
        isActive: true,
        isEmailVerified: true
      },
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'student1@lmsfutureproof.com',
        password: 'student123',
        phone: '+1234567893',
        roleId: createdRoles.STUDENT,
        isActive: true,
        isEmailVerified: true
      },
      {
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'student2@lmsfutureproof.com',
        password: 'student123',
        phone: '+1234567894',
        roleId: createdRoles.STUDENT,
        isActive: true,
        isEmailVerified: true
      },
      {
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'student3@lmsfutureproof.com',
        password: 'student123',
        phone: '+1234567895',
        roleId: createdRoles.STUDENT,
        isActive: true,
        isEmailVerified: true
      },
      {
        firstName: 'David',
        lastName: 'Miller',
        email: 'student4@lmsfutureproof.com',
        password: 'student123',
        phone: '+1234567896',
        roleId: createdRoles.STUDENT,
        isActive: true,
        isEmailVerified: true
      },
      {
        firstName: 'Emma',
        lastName: 'Brown',
        email: 'student5@lmsfutureproof.com',
        password: 'student123',
        phone: '+1234567897',
        roleId: createdRoles.STUDENT,
        isActive: true,
        isEmailVerified: true
      }
    ];

    const createdUsers = {};
    for (const userData of usersData) {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Create user document
      const user = new User({
        ...userData,
        password: hashedPassword
      });

      await user.save();
      createdUsers[userData.email] = user;
      
      console.log(`✅ User created: ${userData.firstName} ${userData.lastName} (${userData.email})`);
    }

    // 3. Verify Users in Database
    console.log('\n🔍 Verifying users in database...');
    const allUsers = await User.find({}).populate('roleId');
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    for (const user of allUsers) {
      console.log(`   • ${user.email} - ${user.firstName} ${user.lastName} (${user.roleId?.displayName}) - ID: ${user._id}`);
    }

    // 4. Create Test Course and Batch for Live Classes
    console.log('\n📚 Creating test course...');
    const course = new Course({
      title: 'Live Classroom Test Course',
      slug: 'live-classroom-test-course',
      description: 'A test course for demonstrating live classroom functionality with multiple users.',
      shortDescription: 'Live classroom testing course',
      category: 'PROGRAMMING',
      level: 'INTERMEDIATE',
      estimatedDuration: { hours: 40, minutes: 0 },
      pricing: { type: 'FREE' },
      status: 'PUBLISHED',
      isPublic: true,
      createdBy: createdUsers['admin@lmsfutureproof.com']._id,
      publishedAt: new Date()
    });
    await course.save();
    console.log(`✅ Test course created: ${course.title}`);

    // 5. Create Test Batch
    console.log('\n🎓 Creating test batch...');
    const batch = new Batch({
      name: 'Live Test Batch - Programming Fundamentals',
      courseId: course._id,
      batchCode: `LIVE_${Date.now()}`,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 2 months from now
      schedule: {
        days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        startTime: '14:00',
        endTime: '16:00',
        timezone: 'UTC'
      },
      maxStudents: 50,
      instructorId: createdUsers['instructor1@lmsfutureproof.com']._id,
      status: 'ACTIVE',
      createdBy: createdUsers['admin@lmsfutureproof.com']._id
    });
    await batch.save();
    console.log(`✅ Test batch created: ${batch.name}`);

    // 6. Create Live Class
    console.log('\n📹 Creating live test class...');
    const now = new Date();
    const liveClass = new LiveClass({
      title: 'Database Test - Live Programming Session',
      batchId: batch._id,
      instructorId: createdUsers['instructor1@lmsfutureproof.com']._id,
      scheduledStartTime: new Date(now.getTime() - 10 * 60 * 1000), // 10 minutes ago
      scheduledEndTime: new Date(now.getTime() + 110 * 60 * 1000), // 110 minutes from now
      actualStartTime: new Date(now.getTime() - 10 * 60 * 1000),
      description: 'Live programming session for testing database users and classroom features',
      roomId: `db_test_room_${Date.now()}`,
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
      createdBy: createdUsers['admin@lmsfutureproof.com']._id
    });
    await liveClass.save();
    console.log(`✅ Live class created: ${liveClass.title}`);
    console.log(`   🌐 Room ID: ${liveClass.roomId}`);

    // 7. Enroll Students in Batch
    console.log('\n📝 Enrolling students...');
    const students = [
      createdUsers['student@lmsfutureproof.com'],
      createdUsers['student1@lmsfutureproof.com'],
      createdUsers['student2@lmsfutureproof.com'],
      createdUsers['student3@lmsfutureproof.com'],
      createdUsers['student4@lmsfutureproof.com'],
      createdUsers['student5@lmsfutureproof.com']
    ];

    for (const student of students) {
      const enrollment = new Enrollment({
        studentId: student._id,
        courseId: course._id,
        batchId: batch._id,
        enrollmentDate: new Date(),
        status: 'ENROLLED',
        enrolledBy: createdUsers['admin@lmsfutureproof.com']._id,
        progress: {
          completedClasses: Math.floor(Math.random() * 5),
          totalClasses: 20,
          completionPercentage: Math.floor(Math.random() * 50)
        },
        attendance: {
          totalClasses: 15,
          attendedClasses: Math.floor(Math.random() * 15),
          attendancePercentage: 0
        },
        payment: {
          status: 'PAID',
          amount: 0,
          paidAt: new Date()
        }
      });
      await enrollment.save();
      console.log(`✅ Enrolled: ${student.firstName} ${student.lastName}`);
    }

    // Update batch enrollment count
    batch.currentEnrollment = students.length;
    await batch.save();

    console.log('\n🎉 DATABASE USERS CREATED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n📊 DATABASE SUMMARY:');
    console.log(`👥 Users: ${allUsers.length}`);
    console.log(`🎭 Roles: ${Object.keys(createdRoles).length}`);
    console.log(`📚 Courses: 1`);
    console.log(`🎓 Batches: 1`);
    console.log(`📹 Live Classes: 1`);
    console.log(`📝 Enrollments: ${students.length}`);

    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 ADMIN: admin@lmsfutureproof.com / admin123456');
    console.log('👨‍🏫 INSTRUCTORS:');
    console.log('   • instructor@lmsfutureproof.com / instructor123');
    console.log('   • instructor1@lmsfutureproof.com / instructor123');
    console.log('   • instructor2@lmsfutureproof.com / instructor123');
    console.log('👨‍🎓 STUDENTS:');
    console.log('   • student@lmsfutureproof.com / student123');
    console.log('   • student1@lmsfutureproof.com / student123');
    console.log('   • student2@lmsfutureproof.com / student123');
    console.log('   • student3@lmsfutureproof.com / student123');
    console.log('   • student4@lmsfutureproof.com / student123');
    console.log('   • student5@lmsfutureproof.com / student123');

    console.log('\n🧪 TESTING READY:');
    console.log(`🌐 Live Class URL: http://localhost:3000/classroom/${liveClass.roomId}`);
    console.log('📱 Frontend: http://localhost:3000');
    console.log('🎛️ Admin Panel: Login as admin to test instructor view/edit');

  } catch (error) {
    console.error('❌ Error creating database users:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

// Run the script
createDatabaseUsers();