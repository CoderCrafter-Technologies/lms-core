const { userRepository, enrollmentRepository, batchRepository, courseRepository, roleRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const bcrypt = require('bcryptjs');
const { syncEnrollmentProgress, syncEnrollmentsProgress } = require('../services/enrollmentProgressService');

/**
 * Get all students with filtering and pagination
 */
const getStudents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, batchId, courseId } = req.query;
  
  // Get student role ID
  const studentRole = await roleRepository.findOne({ name: 'STUDENT' });
  if (!studentRole) {
    return res.status(500).json({
      success: false,
      message: 'Student role not found in system'
    });
  }
  
  // Build filter for students (users with student role)
  const studentFilter = { roleId: studentRole.id };
  
  if (search) {
    studentFilter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    studentFilter.isActive = status === 'active';
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: { path: 'roleId', select: 'name' }
  };

  const students = await userRepository.paginate(studentFilter, options);
  
  // If batch or course filter is specified, get enrollments
  if (batchId || courseId) {
    const enrollmentFilter = {};
    if (batchId) enrollmentFilter.batchId = batchId;
    if (courseId) enrollmentFilter.courseId = courseId;
    
    const enrollments = await enrollmentRepository.find(enrollmentFilter);
    const enrolledStudentIds = enrollments.map(e => e.studentId.toString());
    
    // Filter students based on enrollments
    students.documents = students.documents.filter(student => 
      enrolledStudentIds.includes(student._id.toString())
    );
  }

  res.json({
    success: true,
    data: students.documents,
    pagination: students.pagination
  });
});

/**
 * Get single student by ID with enrollment details
 */
const getStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const student = await userRepository.findById(id, {
    populate: { path: 'roleId', select: 'name' }
  });
  
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Get student's enrollments
  const enrollments = await enrollmentRepository.findByStudent(id);

  res.json({
    success: true,
    data: {
      ...student,
      enrollments
    }
  });
});

/**
 * Create new student
 */
const createStudent = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { firstName, lastName, email, phone, password } = req.body;

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Get student role ID
  const studentRole = await roleRepository.findOne({ name: 'STUDENT' });
  if (!studentRole) {
    return res.status(500).json({
      success: false,
      message: 'Student role not found in system'
    });
  }

  console.log('Found student role:', studentRole); // Debug log

  // Generate password if not provided
  const studentPassword = password || generateRandomPassword();

  // Create student user
  const studentData = {
    firstName,
    lastName,
    email,
    phone,
    password: studentPassword,
    roleId: studentRole._id || studentRole.id,
    isActive: true,
    isEmailVerified: false,
    mustSetPassword: true
  };

  console.log('Student data to create:', { ...studentData, password: '[HIDDEN]' }); // Debug log

  const student = await userRepository.create(studentData);

  // Send welcome email with credentials
  try {
    await emailService.sendWelcomeEmail(student, studentPassword);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail the request if email fails
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
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      isActive: student.isActive
    }
  });
});

/**
 * Update student information
 */
const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove sensitive fields that shouldn't be updated via this endpoint
  delete updates.password;
  delete updates.roleId;
  delete updates.isEmailVerified;

  const student = await userRepository.updateById(id, updates);
  
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  res.json({
    success: true,
    message: 'Student updated successfully',
    data: student
  });
});

/**
 * Delete student (soft delete)
 */
const deleteStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Soft delete by deactivating
  const student = await userRepository.updateById(id, { isActive: false });
  
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  res.json({
    success: true,
    message: 'Student deactivated successfully'
  });
});

/**
 * Toggle student active status
 */
const updateStudentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body || {};

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'isActive must be a boolean'
    });
  }

  const student = await userRepository.updateById(id, { isActive });
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  res.json({
    success: true,
    message: `Student ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: student
  });
});

/**
 * Enroll student in a batch
 */
const enrollStudent = asyncHandler(async (req, res) => {
  const { studentId, batchId } = req.body;

  // Validate student exists
  const student = await userRepository.findById(studentId);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Validate batch exists
  const batch = await batchRepository.findById(batchId, {
    populate: { path: 'courseId', select: 'title' }
  });
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  // Check if student is already enrolled
  const existingEnrollment = await enrollmentRepository.isStudentEnrolled(studentId, batchId);
  if (existingEnrollment) {
    return res.status(400).json({
      success: false,
      message: 'Student is already enrolled in this batch'
    });
  }

  // Check if batch has available spots
  if (batch.currentEnrollment >= batch.maxStudents) {
    return res.status(400).json({
      success: false,
      message: 'Batch is full'
    });
  }

  // Create enrollment
  const enrollmentData = {
    studentId,
    courseId: batch.courseId._id,
    batchId,
    enrollmentDate: new Date(),
    status: 'ENROLLED',
    enrolledBy: req.userId
  };

  const enrollment = await enrollmentRepository.create(enrollmentData);

  // Update batch enrollment count
  await batchRepository.updateById(batchId, {
    $inc: { currentEnrollment: 1 }
  });

  // Send enrollment confirmation email
  try {
    await emailService.sendBatchEnrollmentEmail(student, batch, batch.courseId);
  } catch (error) {
    console.error('Failed to send enrollment email:', error);
  }

  res.status(201).json({
    success: true,
    message: 'Student enrolled successfully',
    data: enrollment
  });
});

/**
 * Remove student from batch
 */
const unenrollStudent = asyncHandler(async (req, res) => {
  const { studentId, batchId } = req.body;

  const enrollment = await enrollmentRepository.findOne({ studentId, batchId });
  if (!enrollment) {
    return res.status(404).json({
      success: false,
      message: 'Enrollment not found'
    });
  }

  // Update enrollment status
  await enrollmentRepository.updateById(enrollment._id, { status: 'DROPPED' });

  // Update batch enrollment count
  await batchRepository.updateById(batchId, {
    $inc: { currentEnrollment: -1 }
  });

  res.json({
    success: true,
    message: 'Student unenrolled successfully'
  });
});

/**
 * Get student enrollments
 */
const getStudentEnrollments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const enrollments = await enrollmentRepository.findByStudent(id);

  res.json({
    success: true,
    data: enrollments
  });
});

/**
 * Get students by batch
 */
const getStudentsByBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  
  const enrollments = await enrollmentRepository.findByBatch(batchId);

  res.json({
    success: true,
    data: enrollments
  });
});

/**
 * Get students by course
 */
const getStudentsByCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  
  const enrollments = await enrollmentRepository.findByCourse(courseId);

  res.json({
    success: true,
    data: enrollments
  });
});

/**
 * Get student statistics
 */
const getStudentStats = asyncHandler(async (req, res) => {
  // Get student role ID
  const studentRole = await roleRepository.findOne({ name: 'STUDENT' });
  if (!studentRole) {
    return res.status(500).json({
      success: false,
      message: 'Student role not found in system'
    });
  }

  const totalStudents = await userRepository.count({ roleId: studentRole._id });
  const activeStudents = await userRepository.count({ 
    roleId: studentRole._id, 
    isActive: true 
  });
  
  const enrollmentStats = await enrollmentRepository.getEnrollmentStats();

  res.json({
    success: true,
    data: {
      totalStudents,
      activeStudents,
      inactiveStudents: totalStudents - activeStudents,
      ...enrollmentStats
    }
  });
});

/**
 * Update student progress
 */
const updateStudentProgress = asyncHandler(async (req, res) => {
  const { enrollmentId } = req.params;
  const { completedClasses, totalClasses, attendedClasses } = req.body;

  const enrollment = await enrollmentRepository.findById(enrollmentId);
  if (!enrollment) {
    return res.status(404).json({
      success: false,
      message: 'Enrollment not found'
    });
  }

  // Update progress
  if (completedClasses !== undefined && totalClasses !== undefined) {
    await enrollment.updateProgress(completedClasses, totalClasses);
  }

  // Update attendance
  if (attendedClasses !== undefined && totalClasses !== undefined) {
    await enrollment.updateAttendance(attendedClasses, totalClasses);
  }

  res.json({
    success: true,
    message: 'Student progress updated successfully',
    data: enrollment
  });
});

/**
 * Reset student password
 */
// const resetStudentPassword = asyncHandler(async (req, res) => {
//   const { id } = req.params;
  
//   const student = await userRepository.findById(id);
//   if (!student) {
//     return res.status(404).json({
//       success: false,
//       message: 'Student not found'
//     });
//   }

//   // Generate new password
//   const newPassword = generateRandomPassword();
  
//   // Update password
//   await userRepository.updateById(id, { password: newPassword });

//   // Send email with new password
//   try {
//     await emailService.sendWelcomeEmail(student, newPassword);
//   } catch (error) {
//     console.error('Failed to send password reset email:', error);
//   }

//   res.json({
//     success: true,
//     message: 'Password reset successfully. New password sent to student\'s email.'
//   });
// });

const resetStudentPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword, notifyUser } = req.body;

  // Validate input
  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password is required'
    });
  }

  const student = await userRepository.findById(id);
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update password
  await userRepository.updateById(id, { 
    password: hashedPassword,
    mustSetPassword: true,
    passwordChangedAt: new Date() // Track password change time
  });

  // Send email notification if requested
  let emailSent = false;
  if (notifyUser) {
    try {
      await emailService.sendPasswordResetEmail(student.email, {
        name: `${student.firstName} ${student.lastName}`,
        newPassword: newPassword // Send the plain text password for the email
      });
      emailSent = true;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }
  }

  await emailService.sendAdminEventEmail(
    'Student password reset',
    `<p>A student password was reset by admin.</p>
     <p><strong>Student:</strong> ${student.firstName || ''} ${student.lastName || ''}<br/>
     <strong>Email:</strong> ${student.email || '-'}</p>`
  );

  res.json({
    success: true,
    message: emailSent 
      ? 'Password reset successfully. New password sent to student\'s email.'
      : 'Password reset successfully.',
    data: {
      // Return the plain password only for admin display (not for production)
      newPassword: process.env.NODE_ENV === 'development' ? newPassword : undefined
    }
  });
});

/**
 * Helper function to generate random password
 */
function generateRandomPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Get current student's enrollments (for logged-in student)
 */
const getMyEnrollments = asyncHandler(async (req, res) => {
  const studentId = req.userId; // From auth middleware
  
  const enrollments = await enrollmentRepository.find(
    { studentId },
    {
      populate: [
        { path: 'courseId', select: 'title description category level duration' },
        { path: 'batchId', select: 'name startDate endDate schedule status currentEnrollment maxStudents' }
      ],
      sort: { enrollmentDate: -1 }
    }
  );
  await syncEnrollmentsProgress(enrollments);

  res.json({
    success: true,
    data: enrollments
  });
});

/**
 * Get upcoming live classes for current student
 */
const getUpcomingClasses = asyncHandler(async (req, res) => {
  const studentId = req.userId; // From auth middleware
  const now = new Date();
  
  // Get student's batches
  const enrollments = await enrollmentRepository.find(
    { studentId, status: 'ENROLLED' },
    { select: 'batchId' }
  );
  
  if (enrollments.length === 0) {
    return res.json({
      success: true,
      data: []
    });
  }

  const batchIds = enrollments.map(e => e.batchId);
  
  // Get live classes for these batches
  const { liveClassRepository } = require('../repositories');
  
  const liveClasses = await liveClassRepository.find(
    { 
      batchId: { $in: batchIds },
      status: 'SCHEDULED',
      scheduledStartTime: { $gte: now }
    },
    {
      populate: [
        { path: 'batchId', select: 'name courseId' },
        { path: 'instructorId', select: 'firstName lastName email' }
      ],
      sort: { scheduledStartTime: 1 }
    }
  );

  res.json({
    success: true,
    data: liveClasses
  });
});

const getPastClasses = asyncHandler(async (req, res) => {
  const studentId = req.userId; // From auth middleware
  
  // Get student's batches
  const enrollments = await enrollmentRepository.find(
    { studentId, status: 'ENROLLED' },
    { select: 'batchId' }
  );
  
  if (enrollments.length === 0) {
    return res.json({
      success: true,
      data: []
    });
  }

  const batchIds = enrollments.map(e => e.batchId);
  
  // Get live classes for these batches
  const { liveClassRepository } = require('../repositories');
  
  const liveClasses = await liveClassRepository.find(
    { 
      batchId: { $in: batchIds },
      status: { $in: ['ENDED'] }
    },
    {
      populate: [
        { path: 'batchId', select: 'name courseId' },
        { path: 'instructorId', select: 'firstName lastName email' }
      ],
      sort: { scheduledStartTime: 1 }
    }
  );

  res.json({
    success: true,
    data: liveClasses
  });
});


const getLiveClasses = asyncHandler(async (req, res) => {
  const studentId = req.userId; // From auth middleware
  const now = new Date();
  
  // Get student's batches
  const enrollments = await enrollmentRepository.find(
    { studentId, status: 'ENROLLED' },
    { select: 'batchId' }
  );
  
  if (enrollments.length === 0) {
    return res.json({
      success: true,
      data: []
    });
  }

  const batchIds = enrollments.map(e => e.batchId);
  
  // Get live classes for these batches
  const { liveClassRepository } = require('../repositories');
  
  const liveClasses = await liveClassRepository.find(
    { 
      batchId: { $in: batchIds },
      status: { $in: ['SCHEDULED', 'LIVE'] },
      scheduledStartTime: { $lte: now },
      scheduledEndTime: { $gte: now }
    },
    {
      populate: [
        { path: 'batchId', select: 'name courseId' },
        { path: 'instructorId', select: 'firstName lastName email' }
      ],
      sort: { scheduledStartTime: 1 }
    }
  );

  res.json({
    success: true,
    data: liveClasses
  });
});

/**
 * Get student's course resources
 */
const getCourseResources = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const studentId = req.userId;
  
  // Verify student is enrolled in this batch
  const enrollment = await enrollmentRepository.findOne({ 
    studentId, 
    batchId,
    status: 'ENROLLED' 
  });
  
  if (!enrollment) {
    return res.status(403).json({
      success: false,
      message: 'You are not enrolled in this batch'
    });
  }

  // Get batch with course details
  const batch = await batchRepository.findById(batchId, {
    populate: { 
      path: 'courseId', 
      select: 'title description resources materials syllabus' 
    }
  });

  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  // TODO: Get uploaded resources from file storage
  // This would typically include PDFs, videos, assignments, etc.
  const resources = batch.courseId.resources || [];
  const materials = batch.courseId.materials || [];

  res.json({
    success: true,
    data: {
      batchId,
      courseName: batch.courseId.title,
      resources,
      materials,
      syllabus: batch.courseId.syllabus
    }
  });
});

/**
 * Get student's progress dashboard data
 */
const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.userId;
  
  // Get enrollments with populated data
  const enrollments = await enrollmentRepository.find(
    { studentId },
    {
      populate: [
        { path: 'courseId', select: 'title category level' },
        { path: 'batchId', select: 'name status startDate endDate' }
      ]
    }
  );
  await syncEnrollmentsProgress(enrollments);

  // Get upcoming classes
  const batchIds = enrollments.map(e => e.batchId._id);
  const { liveClassRepository } = require('../repositories');
  
  const upcomingClasses = await liveClassRepository.find(
    { 
      batchId: { $in: batchIds },
      status: 'SCHEDULED',
      scheduledStartTime: { $gte: new Date() }
    },
    {
      populate: [
        { path: 'batchId', select: 'name' },
        { path: 'instructorId', select: 'firstName lastName' }
      ],
      sort: { scheduledStartTime: 1 },
      limit: 5
    }
  );

  // Calculate statistics
  const totalEnrollments = enrollments.length;
  const completedCourses = enrollments.filter(e => e.status === 'COMPLETED').length;
  const averageProgress = enrollments.length > 0 
    ? enrollments.reduce((sum, e) => sum + (e.progress?.completionPercentage || 0), 0) / enrollments.length
    : 0;

  res.json({
    success: true,
    data: {
      enrollments,
      upcomingClasses,
      stats: {
        totalEnrollments,
        activeCourses: totalEnrollments - completedCourses,
        completedCourses,
        averageProgress: Math.round(averageProgress),
        upcomingClassesCount: upcomingClasses.length
      }
    }
  });
});

/**
 * Get enrolled courses for current user with search functionality
 */
const getMyEnrolledCourses = asyncHandler(async (req, res) => {
  const studentId = req.userId; // From auth middleware
  const { search, status, category, level, page = 1, limit = 10 } = req.query;

  // Build base filter for enrollments
  const enrollmentFilter = { studentId };
  
  // Add status filter if provided
  if (status) {
    enrollmentFilter.status = status;
  } else {
    // Default to active enrollments only
    enrollmentFilter.status = { $in: ['ENROLLED', 'IN_PROGRESS'] };
  }

  // Get enrollments with course and batch details
  const enrollments = await enrollmentRepository.find(
    enrollmentFilter,
    {
      populate: [
        { 
          path: 'courseId', 
          select: 'title description category level duration thumbnail instructor tags price',
          populate: { path: 'instructor', select: 'firstName lastName email' }
        },
        { 
          path: 'batchId', 
          select: 'name startDate endDate schedule status currentEnrollment maxStudents'
        }
      ],
      sort: { enrollmentDate: -1 }
    }
  );
  await syncEnrollmentsProgress(enrollments);

  // Extract courses from enrollments
  let courses = enrollments.map(enrollment => ({
    enrollmentId: enrollment._id,
    enrollmentDate: enrollment.enrollmentDate,
    enrollmentStatus: enrollment.status,
    progress: enrollment.progress || {
      completedClasses: 0,
      totalClasses: 0,
      completionPercentage: 0
    },
    completedClasses: enrollment.progress?.completedClasses || 0,
    totalClasses: enrollment.progress?.totalClasses || 0,
    attendedClasses: enrollment.attendance?.attendedClasses || 0,
    batch: enrollment.batchId,
    ...enrollment.courseId.toObject()
  }));

  // Apply search filter if provided
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    courses = courses.filter(course => 
      course.title.match(searchRegex) ||
      course.description.match(searchRegex) ||
      course.category.match(searchRegex) ||
      (course.tags && course.tags.some(tag => tag.match(searchRegex)))
    );
  }

  // Apply category filter if provided
  if (category) {
    courses = courses.filter(course => 
      course.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Apply level filter if provided
  if (level) {
    courses = courses.filter(course => 
      course.level.toLowerCase() === level.toLowerCase()
    );
  }

  // Pagination
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedCourses = courses.slice(startIndex, endIndex);

  res.json({
    success: true,
    data: paginatedCourses,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(courses.length / parseInt(limit)),
      totalCourses: courses.length,
      hasNext: endIndex < courses.length,
      hasPrev: startIndex > 0
    }
  });
});

/**
 * Search enrolled courses with advanced filtering
 */
const searchEnrolledCourses = asyncHandler(async (req, res) => {
  const studentId = req.userId;
  const { 
    query, 
    category, 
    level, 
    status, 
    progress, 
    sortBy = 'enrollmentDate', 
    sortOrder = 'desc',
    page = 1, 
    limit = 10 
  } = req.query;

  // Build enrollment filter
  const enrollmentFilter = { studentId };
  
  if (status) {
    enrollmentFilter.status = status;
  }

  // Get enrollments with populated data
  const enrollments = await enrollmentRepository.find(
    enrollmentFilter,
    {
      populate: [
        { 
          path: 'courseId', 
          select: 'title description category level duration thumbnail instructor tags price objectives prerequisites',
          populate: { path: 'instructor', select: 'firstName lastName email avatar' }
        },
        { 
          path: 'batchId', 
          select: 'name startDate endDate schedule status currentEnrollment maxStudents'
        }
      ]
    }
  );
  await syncEnrollmentsProgress(enrollments);

  // Transform data and apply filters
  let courses = enrollments.map(enrollment => ({
    enrollmentId: enrollment._id,
    enrollmentDate: enrollment.enrollmentDate,
    enrollmentStatus: enrollment.status,
    progress: enrollment.progress || {
      completedClasses: 0,
      totalClasses: 0,
      completionPercentage: 0
    },
    completedClasses: enrollment.progress?.completedClasses || 0,
    totalClasses: enrollment.progress?.totalClasses || 0,
    attendedClasses: enrollment.attendance?.attendedClasses || 0,
    attendanceRate: enrollment.attendance?.attendancePercentage || 0,
    batch: enrollment.batchId,
    course: enrollment.courseId
  }));

  if (progress) {
    courses = courses.filter((item) => {
      const completion = item.progress?.completionPercentage || 0;
      if (progress === 'completed') return completion === 100;
      if (progress === 'in-progress') return completion > 0 && completion < 100;
      if (progress === 'not-started') return completion === 0;
      return true;
    });
  }

  // Apply search query
  if (query) {
    const searchRegex = new RegExp(query, 'i');
    courses = courses.filter(item => 
      item.course.title.match(searchRegex) ||
      item.course.description.match(searchRegex) ||
      item.course.category.match(searchRegex) ||
      (item.course.tags && item.course.tags.some(tag => tag.match(searchRegex))) ||
      (item.course.objectives && item.course.objectives.some(obj => obj.match(searchRegex)))
    );
  }

  // Apply category filter
  if (category) {
    courses = courses.filter(item => 
      item.course.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Apply level filter
  if (level) {
    courses = courses.filter(item => 
      item.course.level.toLowerCase() === level.toLowerCase()
    );
  }

  // Sort results
  const sortField = sortBy === 'title' ? 'course.title' : sortBy;
  courses.sort((a, b) => {
    let aValue, bValue;
    
    if (sortBy === 'title') {
      aValue = a.course.title;
      bValue = b.course.title;
    } else if (sortBy === 'progress') {
      aValue = a.progress;
      bValue = b.progress;
    } else if (sortBy === 'enrollmentDate') {
      aValue = new Date(a.enrollmentDate);
      bValue = new Date(b.enrollmentDate);
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (sortOrder === 'desc') {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }
  });

  // Pagination
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedCourses = courses.slice(startIndex, endIndex);

  // Get unique categories and levels for filter options
  const categories = [...new Set(courses.map(item => item.course.category))];
  const levels = [...new Set(courses.map(item => item.course.level))];

  res.json({
    success: true,
    data: paginatedCourses,
    filters: {
      categories,
      levels,
      statuses: ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']
    },
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(courses.length / parseInt(limit)),
      totalCourses: courses.length,
      hasNext: endIndex < courses.length,
      hasPrev: startIndex > 0
    }
  });
});

/**
 * Get quick search results for enrolled courses (for search bar suggestions)
 */
const quickSearchEnrolledCourses = asyncHandler(async (req, res) => {
  const studentId = req.userId;
  const { q: query } = req.query;

  if (!query || query.length < 2) {
    return res.json({
      success: true,
      data: [],
      message: 'Query too short'
    });
  }

  // Get active enrollments
  const enrollments = await enrollmentRepository.find(
    { 
      studentId, 
      status: { $in: ['ENROLLED', 'IN_PROGRESS'] } 
    },
    {
      populate: [
        { 
          path: 'courseId', 
          select: 'title description category level thumbnail'
        },
        { 
          path: 'batchId', 
          select: 'name status' 
        }
      ],
      limit: 10
    }
  );
  await syncEnrollmentsProgress(enrollments);

  const searchRegex = new RegExp(query, 'i');
  
  const results = enrollments
    .filter(enrollment => 
      enrollment.courseId.title.match(searchRegex) ||
      enrollment.courseId.description.match(searchRegex) ||
      enrollment.courseId.category.match(searchRegex)
    )
    .map(enrollment => ({
      id: enrollment.courseId._id,
      title: enrollment.courseId.title,
      description: enrollment.courseId.description,
      category: enrollment.courseId.category,
      level: enrollment.courseId.level,
      thumbnail: enrollment.courseId.thumbnail,
      batchName: enrollment.batchId.name,
      progress: enrollment.progress?.completionPercentage || 0,
      type: 'course'
    }));

  res.json({
    success: true,
    data: results,
    query
  });
});

/**
 * Get enrolled course by ID
 */
const getEnrolledCourse = asyncHandler(async (req, res) => {
  const studentId = req.userId;
  const { courseId } = req.params;

  // Find enrollment for this course
  const enrollment = await enrollmentRepository.findOne(
    { 
      studentId, 
      courseId,
      status: { $in: ['ENROLLED', 'IN_PROGRESS', 'COMPLETED'] } 
    },
    {
      populate: [
        { 
          path: 'courseId', 
          select: 'title description category level duration thumbnail instructor tags price objectives syllabus resources materials',
          populate: { path: 'instructor', select: 'firstName lastName email avatar bio' }
        },
        { 
          path: 'batchId', 
          select: 'name startDate endDate schedule status currentEnrollment maxStudents'
        }
      ]
    }
  );

  if (!enrollment) {
    return res.status(404).json({
      success: false,
      message: 'Course not found or you are not enrolled in this course'
    });
  }
  await syncEnrollmentProgress(enrollment);

  // Get upcoming classes for this course batch
  const { liveClassRepository } = require('../repositories');
  const upcomingClasses = await liveClassRepository.find(
    { 
      batchId: enrollment.batchId._id,
      status: 'SCHEDULED',
      scheduledStartTime: { $gte: new Date() }
    },
    {
      populate: [
        { path: 'instructorId', select: 'firstName lastName' }
      ],
      sort: { scheduledStartTime: 1 },
      limit: 5
    }
  );

  // Get course resources
  const resources = enrollment.courseId.resources || [];
  const materials = enrollment.courseId.materials || [];

  res.json({
    success: true,
    data: {
      enrollment: {
        id: enrollment._id,
        enrollmentDate: enrollment.enrollmentDate,
        status: enrollment.status,
        progress: enrollment.progress || {
          completedClasses: 0,
          totalClasses: 0,
          completionPercentage: 0
        },
        completedClasses: enrollment.progress?.completedClasses || 0,
        totalClasses: enrollment.progress?.totalClasses || 0,
        attendedClasses: enrollment.attendance?.attendedClasses || 0,
        attendanceRate: enrollment.attendance?.attendancePercentage || 0
      },
      course: enrollment.courseId,
      batch: enrollment.batchId,
      upcomingClasses,
      resources: {
        studyMaterials: materials,
        additionalResources: resources,
        syllabus: enrollment.courseId.syllabus
      }
    }
  });
});

module.exports = {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  enrollStudent,
  unenrollStudent,
  getStudentEnrollments,
  getStudentsByBatch,
  getStudentStats,
  updateStudentProgress,
  resetStudentPassword,
  getMyEnrollments,
  getUpcomingClasses,
  getCourseResources,
  getStudentDashboard,
  getStudentsByCourse,
  getPastClasses,
  getLiveClasses,
  // New methods for enrolled courses search
  getMyEnrolledCourses,
  searchEnrolledCourses,
  quickSearchEnrolledCourses,
  getEnrolledCourse
};
