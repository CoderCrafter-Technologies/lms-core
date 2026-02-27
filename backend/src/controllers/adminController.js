const { userRepository, courseRepository, batchRepository, liveClassRepository, enrollmentRepository, roleRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const {
  toCanonicalTimezone,
  parseDateInput,
  addDaysToDateParts,
  compareDateParts,
  getDayNameForDateParts,
  zonedDateTimeToUtc
} = require('../utils/timezone');
const {
  MANAGER_PERMISSION_GROUPS,
  ALL_MANAGER_PERMISSIONS,
  LEGACY_MANAGER_DEFAULT_PERMISSIONS
} = require('../constants/managerPermissions');

/**
 * Get comprehensive dashboard statistics
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  // Get all statistics in parallel
  const [
    userStats,
    courseStats,
    batchStats,
    enrollmentStats,
    recentActivities
  ] = await Promise.all([
    getUserStats(),
    getCourseStats(),
    getBatchStats(),
    getEnrollmentStats(),
    getRecentActivities()
  ]);

  res.json({
    success: true,
    data: {
      users: userStats,
      courses: courseStats,
      batches: batchStats,
      enrollments: enrollmentStats,
      recentActivities
    }
  });
});

/**
 * Get all courses with their batches and classes
 */
const getCoursesWithBatches = asyncHandler(async (req, res) => {
  const courses = await courseRepository.find({}, {
    populate: { path: 'createdBy', select: 'firstName lastName' },
    sort: { createdAt: -1 }
  });

  const coursesWithBatches = await Promise.all(
    courses.map(async (course) => {
      const batches = await batchRepository.find({ courseId: course.id }, {
        populate: { path: 'instructorId', select: 'firstName lastName email' },
        sort: { startDate: -1 }
      });

      const batchesWithClasses = await Promise.all(
        batches.map(async (batch) => {
          const classes = await liveClassRepository.find({ batchId: batch.id }, {
            sort: { scheduledStartTime: 1 }
          });
          
          const enrollments = await enrollmentRepository.find({ batchId: batch.id }, {
            populate: { path: 'studentId', select: 'firstName lastName email' }
          });

          return {
            ...batch.toObject(),
            scheduledClasses: classes,
            enrolledStudents: enrollments,
            totalClasses: classes.length,
            totalStudents: enrollments.length
          };
        })
      );

      return {
        ...course.toObject(),
        batches: batchesWithClasses,
        totalBatches: batches.length,
        totalStudents: batchesWithClasses.reduce((sum, batch) => sum + batch.totalStudents, 0)
      };
    })
  );

  res.json({
    success: true,
    data: coursesWithBatches
  });
});

/**
 * Create student and optionally enroll in batch
 */
const createStudentWithEnrollment = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, batchId, sendEmail = true } = req.body;

  // Get student role
  const studentRole = await roleRepository.findOne({ name: 'STUDENT' });
  if (!studentRole) {
    return res.status(500).json({
      success: false,
      message: 'Student role not found'
    });
  }

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Generate password
  const password = generateRandomPassword();

  // Create student
  const studentData = {
    firstName,
    lastName,
    email,
    phone,
    password,
    roleId: studentRole._id || studentRole.id,
    isActive: true,
    isEmailVerified: false,
    mustSetPassword: true
  };

  const student = await userRepository.create(studentData);

  let enrollment = null;
  let batch = null;
  let course = null;

  // Enroll in batch if provided
  if (batchId) {
    batch = await batchRepository.findById(batchId, {
      populate: { path: 'courseId', select: 'title' }
    });

    if (batch) {
      course = batch.courseId;
      
      // Create enrollment
      const enrollmentData = {
        studentId: student.id,
        courseId: course.id,
        batchId: batchId,
        enrollmentDate: new Date(),
        status: 'ENROLLED',
        enrolledBy: req.userId
      };

      enrollment = await enrollmentRepository.create(enrollmentData);

      // Update batch enrollment count
      await batchRepository.updateById(batchId, {
        $inc: { currentEnrollment: 1 }
      });

      // Send enrollment email
      if (sendEmail) {
        try {
          await emailService.sendBatchEnrollmentEmail(student, batch, course);
        } catch (error) {
          console.error('Failed to send enrollment email:', error);
        }
      }
    }
  }

  // Send welcome email
  if (sendEmail) {
    try {
      await emailService.sendWelcomeEmail(student, password);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  await emailService.sendAdminEventEmail(
    'Student created',
    `<p>A new student account was created.</p>
     <p><strong>Name:</strong> ${student.firstName || ''} ${student.lastName || ''}<br/>
     <strong>Email:</strong> ${student.email || '-'}</p>`
  );

  res.status(201).json({
    success: true,
    message: 'Student created successfully',
    data: {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        isActive: student.isActive
      },
      enrollment: enrollment ? {
        id: enrollment.id,
        course: course.title,
        batch: batch.name,
        status: enrollment.status
      } : null
    }
  });
});

/**
 * Get batch details with students and classes
 */
const getBatchDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const batch = await batchRepository.findById(id, {
    populate: [
      { path: 'courseId', select: 'title category level' },
      { path: 'instructorId', select: 'firstName lastName email' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]
  });

  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  // Get scheduled classes
  const classes = await liveClassRepository.find({ batchId: id }, {
    sort: { scheduledStartTime: 1 }
  });

  // Get enrolled students
  const enrollments = await enrollmentRepository.find({ batchId: id }, {
    populate: { path: 'studentId', select: 'firstName lastName email phone avatar isActive' }
  });

  res.json({
    success: true,
    data: {
      batch,
      scheduledClasses: classes,
      enrolledStudents: enrollments,
      stats: {
        totalClasses: classes.length,
        upcomingClasses: classes.filter(c => c.status === 'SCHEDULED' && new Date(c.scheduledStartTime) > new Date()).length,
        completedClasses: classes.filter(c => c.status === 'ENDED').length,
        totalStudents: enrollments.length,
        activeStudents: enrollments.filter(e => e.studentId.isActive && e.status === 'ENROLLED').length
      }
    }
  });
});

/**
 * Auto-generate classes for batch
 */
const autoGenerateClasses = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { sessionDuration = 120, totalSessions, startDate, endDate } = req.body;

  const batch = await batchRepository.findById(batchId);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  const generatedClasses = [];
  const batchStartDate = parseDateInput(startDate || batch.startDate);
  const batchEndDate = parseDateInput(endDate || batch.endDate);
  const scheduleDays = batch.schedule.days;
  const startTime = batch.schedule.startTime;
  const timezone = toCanonicalTimezone(batch?.schedule?.timezone) || 'UTC';

  if (!batchStartDate || !batchEndDate) {
    return res.status(400).json({
      success: false,
      message: 'Batch has invalid start or end date'
    });
  }

  let sessionCount = 0;
  let currentDate = { ...batchStartDate };

  while (compareDateParts(currentDate, batchEndDate) <= 0 && (!totalSessions || sessionCount < totalSessions)) {
    const dayName = getDayNameForDateParts(currentDate);
    
    if (scheduleDays.includes(dayName)) {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      
      const classStartTime = zonedDateTimeToUtc(
        {
          year: currentDate.year,
          month: currentDate.month,
          day: currentDate.day,
          hour: startHour,
          minute: startMinute
        },
        timezone
      );
      
      const classEndTime = new Date(classStartTime);
      classEndTime.setMinutes(classEndTime.getMinutes() + sessionDuration);
      
      const classData = {
        title: `Session ${sessionCount + 1}`,
        batchId: batchId,
        instructorId: batch.instructorId,
        scheduledStartTime: classStartTime,
        scheduledEndTime: classEndTime,
        description: `Auto-generated session ${sessionCount + 1} for ${batch.name}`,
        createdBy: req.userId,
        status: 'SCHEDULED',
        roomId: `room_${Date.now()}_${sessionCount}_${Math.random().toString(36).substr(2, 6)}`
      };

      const scheduledClass = await liveClassRepository.create(classData);
      generatedClasses.push(scheduledClass);
      sessionCount++;
    }
    
    currentDate = addDaysToDateParts(currentDate, 1);
  }

  const enrollments = await enrollmentRepository.find(
    { batchId, status: 'ENROLLED' },
    { select: 'studentId' }
  );
  const recipients = [
    batch.instructorId?.toString?.() || batch.instructorId,
    ...enrollments.map((enrollment) => enrollment.studentId?.toString())
  ].filter(Boolean);

  await notificationService.createForUsers(recipients, {
    actorId: req.userId,
    type: 'BATCH_AUTO_CLASSES_SCHEDULED',
    title: 'Class schedule generated',
    message: `${generatedClasses.length} classes were auto-scheduled for ${batch.name}.`,
    priority: 'normal',
    data: {
      batchId,
      generatedCount: generatedClasses.length
    }
  });

  res.json({
    success: true,
    message: `${generatedClasses.length} classes generated successfully`,
    data: generatedClasses
  });
});

/**
 * Bulk operations
 */
const bulkEnrollStudents = asyncHandler(async (req, res) => {
  const { studentIds, batchId } = req.body;

  const batch = await batchRepository.findById(batchId, {
    populate: { path: 'courseId', select: 'title' }
  });

  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  const results = [];
  
  for (const studentId of studentIds) {
    try {
      const student = await userRepository.findById(studentId);
      if (!student) {
        results.push({ studentId, success: false, message: 'Student not found' });
        continue;
      }

      // Check if already enrolled
      const existingEnrollment = await enrollmentRepository.findOne({ studentId, batchId });
      if (existingEnrollment) {
        results.push({ studentId, success: false, message: 'Already enrolled' });
        continue;
      }

      // Create enrollment
      const enrollmentData = {
        studentId,
        courseId: batch.courseId.id,
        batchId,
        enrollmentDate: new Date(),
        status: 'ENROLLED',
        enrolledBy: req.userId
      };

      await enrollmentRepository.create(enrollmentData);
      results.push({ studentId, success: true, message: 'Enrolled successfully' });

      // Send email notification
      try {
        await emailService.sendBatchEnrollmentEmail(student, batch, batch.courseId);
      } catch (error) {
        console.error(`Failed to send email to ${student.email}`);
      }

    } catch (error) {
      results.push({ studentId, success: false, message: error.message });
    }
  }

  // Update batch enrollment count
  const successCount = results.filter(r => r.success).length;
  await batchRepository.updateById(batchId, {
    $inc: { currentEnrollment: successCount }
  });

  res.json({
    success: true,
    message: `Bulk enrollment completed: ${successCount} successful, ${results.length - successCount} failed`,
    data: results
  });
});

// Helper functions
async function getUserStats() {
  const studentRole = await roleRepository.findOne({ name: 'STUDENT' });
  const instructorRole = await roleRepository.findOne({ name: 'INSTRUCTOR' });
  
  const [totalUsers, totalStudents, totalInstructors, activeUsers] = await Promise.all([
    userRepository.count(),
    userRepository.count({ roleId: studentRole?._id }),
    userRepository.count({ roleId: instructorRole?._id }),
    userRepository.count({ isActive: true })
  ]);

  return {
    total: totalUsers,
    students: totalStudents,
    instructors: totalInstructors,
    active: activeUsers,
    inactive: totalUsers - activeUsers
  };
}

async function getCourseStats() {
  const [total, published, draft] = await Promise.all([
    courseRepository.count(),
    courseRepository.count({ status: 'PUBLISHED' }),
    courseRepository.count({ status: 'DRAFT' })
  ]);

  return { total, published, draft };
}

async function getBatchStats() {
  const [total, upcoming, active, completed] = await Promise.all([
    batchRepository.count(),
    batchRepository.count({ status: 'UPCOMING' }),
    batchRepository.count({ status: 'ACTIVE' }),
    batchRepository.count({ status: 'COMPLETED' })
  ]);

  return { total, upcoming, active, completed };
}

async function getEnrollmentStats() {
  const [total, active, completed] = await Promise.all([
    enrollmentRepository.count(),
    enrollmentRepository.count({ status: 'ENROLLED' }),
    enrollmentRepository.count({ status: 'COMPLETED' })
  ]);

  return { total, active, completed };
}

async function getRecentActivities() {
  // Get recent enrollments, course creations, etc.
  const recentEnrollments = await enrollmentRepository.find({}, {
    populate: [
      { path: 'studentId', select: 'firstName lastName' },
      { path: 'courseId', select: 'title' }
    ],
    sort: { createdAt: -1 },
    limit: 10
  });

  const recentCourses = await courseRepository.find({}, {
    populate: { path: 'createdBy', select: 'firstName lastName' },
    sort: { createdAt: -1 },
    limit: 5
  });

  return {
    recentEnrollments: recentEnrollments.map(e => ({
      type: 'enrollment',
      message: `${e.studentId.firstName} ${e.studentId.lastName} enrolled in ${e.courseId.title}`,
      timestamp: e.createdAt
    })),
    recentCourses: recentCourses.map(c => ({
      type: 'course',
      message: `New course "${c.title}" created by ${c.createdBy.firstName} ${c.createdBy.lastName}`,
      timestamp: c.createdAt
    }))
  };
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function normalizeManagerPermissions(inputPermissions = []) {
  if (!Array.isArray(inputPermissions)) {
    return [];
  }

  return [...new Set(
    inputPermissions.filter((permission) => ALL_MANAGER_PERMISSIONS.includes(permission))
  )];
}

function mapUserForAdminList(user) {
  return {
    id: user.id || user._id?.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone || '',
    isActive: !!user.isActive,
    status: user.isActive ? 'active' : 'inactive',
    role: user.roleId,
    managerPermissions: Array.isArray(user.managerPermissions) ? user.managerPermissions : [],
    managedBy: user.managedBy || null,
    lastLogin: user.lastLogin || null,
    createdAt: user.createdAt
  };
}

/**
 * Get all instructors for selection
 */
const getInstructors = asyncHandler(async (req, res) => {
  const instructorRole = await roleRepository.findOne({ name: 'INSTRUCTOR' });
  
  if (!instructorRole) {
    return res.status(500).json({
      success: false,
      message: 'Instructor role not found'
    });
  }

  const instructors = await userRepository.find(
    { roleId: instructorRole._id },
    {
      select: 'firstName lastName email phone avatar isActive createdAt',
      sort: { firstName: 1 }
    }
  );

  // Get additional stats for each instructor
  const instructorsWithStats = await Promise.all(
    instructors.map(async (instructor) => {
      const [batchCount, classCount] = await Promise.all([
        batchRepository.count({ instructorId: instructor.id }),
        liveClassRepository.count({ instructorId: instructor.id })
      ]);

      return {
        id: instructor.id,
        firstName: instructor.firstName,
        lastName: instructor.lastName,
        email: instructor.email,
        phone: instructor.phone,
        avatar: instructor.avatar,
        isActive: instructor.isActive,
        createdAt: instructor.createdAt,
        stats: {
          totalBatches: batchCount,
          totalClasses: classCount
        }
      };
    })
  );

  res.json({
    success: true,
    data: instructorsWithStats
  });
});

/**
 * Get manager permission catalog for admin provisioning UI
 */
const getManagerPermissionCatalog = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      groups: MANAGER_PERMISSION_GROUPS,
      defaults: LEGACY_MANAGER_DEFAULT_PERMISSIONS
    }
  });
});

/**
 * Create manager with custom permissions
 */
const createManager = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    managerPermissions = [],
    sendEmail = false
  } = req.body;

  const managerRole = await roleRepository.findOne({ name: 'MANAGER' });
  if (!managerRole) {
    return res.status(500).json({
      success: false,
      message: 'Manager role not found'
    });
  }

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  const normalizedPermissions = normalizeManagerPermissions(managerPermissions);
  if (normalizedPermissions.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one valid manager permission is required'
    });
  }
  const initialPassword = password || generateRandomPassword();

  const manager = await userRepository.create({
    firstName,
    lastName,
    email,
    phone,
    password: initialPassword,
    roleId: managerRole._id || managerRole.id,
    isActive: true,
    isEmailVerified: false,
    mustSetPassword: true,
    managerPermissions: normalizedPermissions,
    managedBy: req.userId
  });

  const managerWithRole = await userRepository.findById(manager.id, {
    populate: { path: 'roleId', select: 'name displayName level' }
  });

  if (sendEmail) {
    try {
      await emailService.sendWelcomeEmail(managerWithRole, initialPassword);
    } catch (error) {
      console.error('Failed to send manager welcome email:', error);
    }
  }

  await emailService.sendAdminEventEmail(
    'Manager created',
    `<p>A new manager account was created.</p>
     <p><strong>Name:</strong> ${manager.firstName || ''} ${manager.lastName || ''}<br/>
     <strong>Email:</strong> ${manager.email || '-'}<br/>
     <strong>Permission count:</strong> ${normalizedPermissions.length}</p>`
  );

  res.status(201).json({
    success: true,
    message: 'Manager created successfully',
    data: mapUserForAdminList(managerWithRole)
  });
});

/**
 * Create new instructor
 */
const createInstructor = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, sendEmail = true } = req.body;

  // Get instructor role
  const instructorRole = await roleRepository.findOne({ name: 'INSTRUCTOR' });
  if (!instructorRole) {
    return res.status(500).json({
      success: false,
      message: 'Instructor role not found'
    });
  }

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Generate password
  const password = generateRandomPassword();

  // Create instructor
  const instructorData = {
    firstName,
    lastName,
    email,
    phone,
    password,
    roleId: instructorRole._id || instructorRole.id,
    isActive: true,
    isEmailVerified: false,
    mustSetPassword: true
  };

  const instructor = await userRepository.create(instructorData);

  // Send welcome email
  if (sendEmail) {
    try {
      await emailService.sendInstructorWelcomeEmail(instructor, password);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  await emailService.sendAdminEventEmail(
    'Instructor created',
    `<p>A new instructor account was created.</p>
     <p><strong>Name:</strong> ${instructor.firstName || ''} ${instructor.lastName || ''}<br/>
     <strong>Email:</strong> ${instructor.email || '-'}</p>`
  );

  res.status(201).json({
    success: true,
    message: 'Instructor created successfully',
    data: {
      id: instructor.id,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      email: instructor.email,
      phone: instructor.phone,
      isActive: instructor.isActive
    }
  });
});

/**
 * Get instructor profile with performance stats
 */
const getInstructorProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const instructor = await userRepository.findById(id, {
    select: 'firstName lastName email phone avatar isActive createdAt lastLogin'
  });

  if (!instructor) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found'
    });
  }

  // Get instructor's batches with detailed info
  const batches = await batchRepository.find({ instructorId: id }, {
    populate: [
      { path: 'courseId', select: 'title category' },
      { path: 'createdBy', select: 'firstName lastName' }
    ],
    sort: { startDate: -1 }
  });

  // Get instructor's classes
  const classes = await liveClassRepository.find({ instructorId: id }, {
    populate: { path: 'batchId', select: 'name' },
    sort: { scheduledStartTime: -1 }
  });

  // Get enrollment counts for instructor's batches
  let totalStudents = 0;
  const batchStats = await Promise.all(
    batches.map(async (batch) => {
      const enrollmentCount = await enrollmentRepository.count({ batchId: batch.id });
      totalStudents += enrollmentCount;
      
      const classCount = await liveClassRepository.count({ batchId: batch.id });
      const completedClasses = await liveClassRepository.count({ 
        batchId: batch.id, 
        status: 'ENDED' 
      });

      return {
        ...batch,
        studentCount: enrollmentCount,
        totalClasses: classCount,
        completedClasses,
        completionRate: classCount > 0 ? Math.round((completedClasses / classCount) * 100) : 0
      };
    })
  );

  // Calculate performance metrics
  const totalClasses = classes.length;
  const completedClasses = classes.filter(c => c.status === 'ENDED').length;
  const upcomingClasses = classes.filter(c => 
    c.status === 'SCHEDULED' && new Date(c.scheduledStartTime) > new Date()
  ).length;

  const performanceStats = {
    totalBatches: batches.length,
    activeBatches: batches.filter(b => b.status === 'ACTIVE').length,
    totalStudents,
    totalClasses,
    completedClasses,
    upcomingClasses,
    completionRate: totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0,
    averageStudentsPerBatch: batches.length > 0 ? Math.round(totalStudents / batches.length) : 0
  };

  res.json({
    success: true,
    data: {
      instructor,
      batches: batchStats,
      recentClasses: classes.slice(0, 10),
      performanceStats
    }
  });
});

module.exports = {
  getDashboardStats,
  getCoursesWithBatches,
  createStudentWithEnrollment,
  getBatchDetails,
  autoGenerateClasses,
  bulkEnrollStudents,
  getInstructors,
  createInstructor,
  getInstructorProfile,
  getManagerPermissionCatalog,
  createManager
};
