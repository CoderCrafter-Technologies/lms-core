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

async function createTestData() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof');
    console.log('🔗 Connected to database...');

    // First, ensure test accounts exist
    await createTestAccounts();
    
    // Get users for reference
    const admin = await User.findOne({ email: 'admin@lmsfutureproof.com' }).populate('roleId');
    const instructor = await User.findOne({ email: 'instructor@lmsfutureproof.com' }).populate('roleId');
    const student = await User.findOne({ email: 'student@lmsfutureproof.com' }).populate('roleId');

    if (!admin || !instructor || !student) {
      throw new Error('Test accounts not found. Run create_test_accounts.js first.');
    }

    // Create test courses
    await createTestCourses(admin._id);
    
    // Get created courses
    const courses = await Course.find({ createdBy: admin._id });
    console.log(`📚 Found ${courses.length} courses for batch creation`);
    
    // Create test batches
    await createTestBatches(courses, instructor._id, admin._id);
    
    // Get created batches
    const batches = await Batch.find({ createdBy: admin._id });
    console.log(`🎓 Found ${batches.length} batches for live class creation`);
    
    // Create test live classes (including upcoming ones)
    await createTestLiveClasses(batches, instructor._id, admin._id);
    
    // Enroll student in courses/batches
    await createTestEnrollments(student._id, batches);
    
    console.log('\n🎉 TEST DATA CREATION COMPLETE!');
    console.log('\n📊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalCourses = await Course.countDocuments();
    const totalBatches = await Batch.countDocuments();
    const totalLiveClasses = await LiveClass.countDocuments();
    const totalEnrollments = await Enrollment.countDocuments();
    
    console.log(`📚 Courses: ${totalCourses}`);
    console.log(`🎓 Batches: ${totalBatches}`);
    console.log(`📹 Live Classes: ${totalLiveClasses}`);
    console.log(`📝 Enrollments: ${totalEnrollments}`);
    
    console.log('\n🧪 TEST SCENARIOS READY:');
    console.log('• Login as student@lmsfutureproof.com (password: student123)');
    console.log('• Join live classes through the dashboard');
    console.log('• Test classroom whiteboard functionality');
    console.log('• View enrolled courses and upcoming classes');
    console.log('• Test live class joining and features');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📵 Database connection closed');
    process.exit(0);
  }
}

async function createTestAccounts() {
  // First, create/ensure roles exist
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

  console.log('🎭 Creating/updating roles...');
  const createdRoles = {};
  
  for (const roleData of rolesData) {
    const role = await Role.findOneAndUpdate(
      { name: roleData.name },
      roleData,
      { upsert: true, new: true }
    );
    createdRoles[roleData.name] = role._id;
  }

  // Create test accounts
  const testAccounts = [
    {
      email: 'admin@lmsfutureproof.com',
      password: 'admin123456',
      firstName: 'System',
      lastName: 'Administrator',
      roleName: 'ADMIN',
      phone: '+1234567890'
    },
    {
      email: 'instructor@lmsfutureproof.com',
      password: 'instructor123',
      firstName: 'John',
      lastName: 'Instructor',
      roleName: 'INSTRUCTOR',
      phone: '+1234567891'
    },
    {
      email: 'student@lmsfutureproof.com',
      password: 'student123',
      firstName: 'Jane',
      lastName: 'Student',
      roleName: 'STUDENT',
      phone: '+1234567892'
    }
  ];

  console.log('👥 Creating test user accounts...');
  
  for (const accountData of testAccounts) {
    const existingUser = await User.findOne({ email: accountData.email });
    
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(accountData.password, 12);
      
      const newUser = new User({
        email: accountData.email,
        password: hashedPassword,
        firstName: accountData.firstName,
        lastName: accountData.lastName,
        phone: accountData.phone,
        roleId: createdRoles[accountData.roleName],
        isActive: true,
        isEmailVerified: true
      });

      await newUser.save();
      console.log(`✅ Created user: ${accountData.email}`);
    }
  }
}

async function createTestCourses(adminId) {
  console.log('\n📚 Creating test courses...');
  
  const courseData = [
    {
      title: 'Full Stack JavaScript Development',
      slug: 'full-stack-javascript-development',
      description: 'Learn to build complete web applications using JavaScript, Node.js, React, and MongoDB. This comprehensive course covers both frontend and backend development.',
      shortDescription: 'Complete web development with JavaScript stack',
      category: 'PROGRAMMING',
      level: 'INTERMEDIATE',
      estimatedDuration: { hours: 120, minutes: 0 },
      pricing: { type: 'PAID', amount: 299, currency: 'USD' },
      status: 'PUBLISHED',
      isPublic: true,
      tags: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Full Stack']
    },
    {
      title: 'Python for Data Science',
      slug: 'python-for-data-science',
      description: 'Master Python programming for data analysis, visualization, and machine learning. Learn pandas, numpy, matplotlib, and scikit-learn.',
      shortDescription: 'Python programming focused on data science applications',
      category: 'DATA_SCIENCE',
      level: 'BEGINNER',
      estimatedDuration: { hours: 80, minutes: 30 },
      pricing: { type: 'PAID', amount: 199, currency: 'USD' },
      status: 'PUBLISHED',
      isPublic: true,
      tags: ['Python', 'Data Science', 'Pandas', 'Machine Learning', 'Analysis']
    },
    {
      title: 'UI/UX Design Fundamentals',
      slug: 'ui-ux-design-fundamentals',
      description: 'Learn the principles of user interface and user experience design. Create beautiful, functional designs using Figma and modern design tools.',
      shortDescription: 'Essential design principles and practical skills',
      category: 'DESIGN',
      level: 'BEGINNER',
      estimatedDuration: { hours: 60, minutes: 0 },
      pricing: { type: 'PAID', amount: 149, currency: 'USD' },
      status: 'PUBLISHED',
      isPublic: true,
      tags: ['UI Design', 'UX Design', 'Figma', 'Prototyping', 'Design Thinking']
    },
    {
      title: 'Digital Marketing Mastery',
      slug: 'digital-marketing-mastery',
      description: 'Comprehensive digital marketing course covering SEO, social media marketing, content marketing, PPC advertising, and analytics.',
      shortDescription: 'Complete guide to digital marketing strategies',
      category: 'MARKETING',
      level: 'INTERMEDIATE',
      estimatedDuration: { hours: 90, minutes: 15 },
      pricing: { type: 'PAID', amount: 249, currency: 'USD' },
      status: 'PUBLISHED',
      isPublic: true,
      tags: ['SEO', 'Social Media', 'PPC', 'Content Marketing', 'Analytics']
    },
    {
      title: 'Introduction to Programming',
      slug: 'introduction-to-programming',
      description: 'Perfect first course for absolute beginners. Learn programming fundamentals using Python with hands-on projects and exercises.',
      shortDescription: 'Perfect first programming course for beginners',
      category: 'PROGRAMMING',
      level: 'BEGINNER',
      estimatedDuration: { hours: 40, minutes: 0 },
      pricing: { type: 'FREE' },
      status: 'PUBLISHED',
      isPublic: true,
      tags: ['Programming', 'Python', 'Beginner', 'Fundamentals', 'Logic']
    }
  ];

  for (const course of courseData) {
    const existingCourse = await Course.findOne({ slug: course.slug });
    if (!existingCourse) {
      const newCourse = new Course({
        ...course,
        createdBy: adminId,
        publishedAt: new Date()
      });
      await newCourse.save();
      console.log(`✅ Created course: ${course.title}`);
    } else {
      console.log(`ℹ️  Course already exists: ${course.title}`);
    }
  }
}

async function createTestBatches(courses, instructorId, adminId) {
  console.log('\n🎓 Creating test batches...');
  
  const batchTemplates = [
    {
      name: 'Morning Batch',
      schedule: {
        days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        startTime: '09:00',
        endTime: '11:00',
        timezone: 'UTC'
      },
      maxStudents: 25,
      settings: {
        allowLateJoin: true,
        autoEnrollment: false,
        recordClasses: true,
        allowStudentChat: true
      }
    },
    {
      name: 'Evening Batch',
      schedule: {
        days: ['TUESDAY', 'THURSDAY'],
        startTime: '18:00',
        endTime: '20:00',
        timezone: 'UTC'
      },
      maxStudents: 30,
      settings: {
        allowLateJoin: false,
        autoEnrollment: false,
        recordClasses: true,
        allowStudentChat: true
      }
    },
    {
      name: 'Weekend Intensive',
      schedule: {
        days: ['SATURDAY', 'SUNDAY'],
        startTime: '10:00',
        endTime: '15:00',
        timezone: 'UTC'
      },
      maxStudents: 20,
      settings: {
        allowLateJoin: true,
        autoEnrollment: true,
        recordClasses: true,
        allowStudentChat: false
      }
    }
  ];

  for (const course of courses) {
    for (let i = 0; i < batchTemplates.length; i++) {
      const template = batchTemplates[i];
      
      // Create batches with different start dates
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (i * 7) + 3); // Different start dates
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 90); // 3 months duration
      
      const batchCode = `${course.title.substring(0, 3).toUpperCase()}${startDate.getFullYear()}${(startDate.getMonth() + 1).toString().padStart(2, '0')}${startDate.getDate().toString().padStart(2, '0')}${i + 1}`;
      
      const existingBatch = await Batch.findOne({ batchCode });
      
      if (!existingBatch) {
        const batch = new Batch({
          name: `${course.title} - ${template.name}`,
          courseId: course._id,
          batchCode: batchCode,
          startDate: startDate,
          endDate: endDate,
          schedule: template.schedule,
          maxStudents: template.maxStudents,
          currentEnrollment: Math.floor(Math.random() * (template.maxStudents / 2)), // Random enrollments
          instructorId: instructorId,
          status: startDate <= new Date() ? 'ACTIVE' : 'UPCOMING',
          settings: template.settings,
          description: `${template.name} for ${course.title}. ${course.shortDescription}`,
          prerequisites: course.level === 'ADVANCED' ? 'Basic programming knowledge required' : '',
          createdBy: adminId
        });
        
        await batch.save();
        console.log(`✅ Created batch: ${batch.name} (${batch.batchCode})`);
      }
    }
  }
}

async function createTestLiveClasses(batches, instructorId, adminId) {
  console.log('\n📹 Creating test live classes...');
  
  for (const batch of batches) {
    const classTemplates = [
      {
        title: 'Introduction and Course Overview',
        description: 'Welcome to the course! We\'ll cover the curriculum, expectations, and get started with the basics.',
        agenda: '1. Welcome and introductions\n2. Course overview\n3. Setup and tools\n4. Q&A session'
      },
      {
        title: 'Core Concepts - Part 1',
        description: 'Deep dive into the fundamental concepts and principles.',
        agenda: '1. Key concepts explanation\n2. Practical examples\n3. Hands-on exercises\n4. Discussion'
      },
      {
        title: 'Practical Workshop',
        description: 'Hands-on workshop session with real-world projects.',
        agenda: '1. Project introduction\n2. Live coding session\n3. Problem solving\n4. Code review'
      },
      {
        title: 'Advanced Topics',
        description: 'Exploring advanced concepts and best practices.',
        agenda: '1. Advanced techniques\n2. Case studies\n3. Best practices\n4. Industry insights'
      },
      {
        title: 'Final Project Review',
        description: 'Review of final projects and course wrap-up.',
        agenda: '1. Project presentations\n2. Peer feedback\n3. Course summary\n4. Next steps'
      }
    ];
    
    // Create classes at different time periods
    const now = new Date();
    const classSchedules = [
      // Past class (for testing history)
      new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)), // 1 week ago
      // Recent class (just ended)
      new Date(now.getTime() - (2 * 60 * 60 * 1000)), // 2 hours ago
      // Current/Live class
      new Date(now.getTime() - (30 * 60 * 1000)), // 30 minutes ago (should be live)
      // Upcoming classes
      new Date(now.getTime() + (2 * 60 * 60 * 1000)), // 2 hours from now
      new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)), // 2 days from now
      new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)), // 1 week from now
    ];
    
    for (let i = 0; i < Math.min(classTemplates.length, classSchedules.length); i++) {
      const template = classTemplates[i];
      const scheduledStart = classSchedules[i];
      const scheduledEnd = new Date(scheduledStart.getTime() + (2 * 60 * 60 * 1000)); // 2 hours duration
      
      let status = 'SCHEDULED';
      let actualStartTime = null;
      let actualEndTime = null;
      
      // Set status based on timing
      if (scheduledEnd < now) {
        status = 'ENDED';
        actualStartTime = scheduledStart;
        actualEndTime = scheduledEnd;
      } else if (scheduledStart <= now && scheduledEnd > now) {
        status = 'LIVE';
        actualStartTime = scheduledStart;
      }
      
      const roomId = `room_${batch._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const liveClass = new LiveClass({
        title: `${template.title} - ${batch.name}`,
        batchId: batch._id,
        instructorId: instructorId,
        scheduledStartTime: scheduledStart,
        scheduledEndTime: scheduledEnd,
        actualStartTime: actualStartTime,
        actualEndTime: actualEndTime,
        description: template.description,
        agenda: template.agenda,
        roomId: roomId,
        status: status,
        settings: {
          maxParticipants: batch.maxStudents,
          allowRecording: true,
          allowScreenShare: true,
          allowWhiteboard: true,
          allowChat: true,
          allowStudentMic: false,
          allowStudentCamera: false,
          requireApproval: false
        },
        stats: {
          totalParticipants: status === 'ENDED' ? Math.floor(Math.random() * batch.maxStudents) : 0,
          peakParticipants: status === 'ENDED' ? Math.floor(Math.random() * batch.maxStudents) : 0,
          averageParticipants: status === 'ENDED' ? Math.floor(Math.random() * batch.maxStudents * 0.8) : 0,
          totalChatMessages: status === 'ENDED' ? Math.floor(Math.random() * 50) : 0
        },
        recording: status === 'ENDED' ? {
          isRecorded: Math.random() > 0.3,
          recordingUrl: Math.random() > 0.3 ? `https://recordings.example.com/${roomId}.mp4` : null,
          recordingSize: Math.random() > 0.3 ? Math.floor(Math.random() * 500) : 0,
          recordingDuration: Math.random() > 0.3 ? 7200 : 0 // 2 hours
        } : {},
        createdBy: adminId
      });
      
      await liveClass.save();
      console.log(`✅ Created live class: ${liveClass.title} (${status})`);
    }
  }
}

async function createTestEnrollments(studentId, batches) {
  console.log('\n📝 Creating test enrollments...');
  
  // Get admin for enrolledBy field
  const admin = await User.findOne({ email: 'admin@lmsfutureproof.com' });
  
  // Enroll student in a few random batches
  const enrollmentBatches = batches.slice(0, Math.min(3, batches.length));
  
  for (const batch of enrollmentBatches) {
    const existingEnrollment = await Enrollment.findOne({
      studentId: studentId,
      batchId: batch._id
    });
    
    if (!existingEnrollment) {
      const enrollment = new Enrollment({
        studentId: studentId,
        courseId: batch.courseId,
        batchId: batch._id,
        enrollmentDate: new Date(),
        status: 'ENROLLED',
        enrolledBy: admin._id,
        progress: {
          completedClasses: Math.floor(Math.random() * 5),
          totalClasses: 20,
          completionPercentage: Math.floor(Math.random() * 50)
        },
        attendance: {
          totalClasses: 15,
          attendedClasses: Math.floor(Math.random() * 15),
          attendancePercentage: 0 // Will be calculated in pre-save
        },
        payment: {
          status: 'PAID',
          amount: 299,
          paidAt: new Date(),
          transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });
      
      await enrollment.save();
      
      // Update batch enrollment count
      await Batch.findByIdAndUpdate(batch._id, {
        $inc: { currentEnrollment: 1 }
      });
      
      console.log(`✅ Enrolled student in: ${batch.name}`);
    }
  }
}

// Run the script
createTestData();