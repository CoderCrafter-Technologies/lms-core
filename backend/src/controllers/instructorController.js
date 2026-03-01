const { userRepository, liveClassRepository, batchRepository, roleRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const bcrypt = require('bcryptjs');
const { Enrollment } = require('../models');

/**
 * Get all instructors with filtering and pagination
 */
const getInstructors = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;
  
  // Get instructor role ID
  const instructorRole = await roleRepository.findOne({ name: 'INSTRUCTOR' });
  if (!instructorRole) {
    return res.status(500).json({
      success: false,
      message: 'Instructor role not found in system'
    });
  }
  
  // Build filter for instructors (users with instructor role)
  const instructorFilter = { roleId: instructorRole.id };
  
  if (search) {
    instructorFilter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    instructorFilter.isActive = status === 'active';
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: { path: 'roleId', select: 'name' }
  };

  const instructors = await userRepository.paginate(instructorFilter, options);
  console.log(instructors, "All instructors")
  // Get class counts for each instructor
  const instructorsWithStats = await Promise.all(
    instructors.documents.map(async instructor => {
        console.log(instructor, "Single Instructor")
        const classCount = await liveClassRepository.count({ instructorId: instructor.id });
      return {
        ...instructor,
        classCount
      };
    })
  );

  res.json({
    success: true,
    data: instructorsWithStats,
    pagination: instructors.pagination
  });
});

/**
 * Get single instructor by ID with class details
 */
const getInstructor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const instructor = await userRepository.findById(id, {
    populate: { path: 'roleId', select: 'name' }
  });
  
  if (!instructor) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found'
    });
  }

  // Get instructor's classes
  const classes = await liveClassRepository.find(
    { instructorId: id },
    {
      populate: [
        { path: 'batchId', select: 'name' },
        { path: 'courseId', select: 'title' }
      ],
      sort: { scheduledStartTime: 1 }
    }
  );
  // Get batches assigned to instructor
  const batches = await batchRepository.findByInstructor(id);

  res.json({
    success: true,
    data: {
      ...instructor,
      classes,
      batches
    }
  });
});

/**
 * Create new instructor
 */
const createInstructor = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { firstName, lastName, email, phone, password, expertise } = req.body;

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Get instructor role ID
  const instructorRole = await roleRepository.findOne({ name: 'INSTRUCTOR' });
  if (!instructorRole) {
    return res.status(500).json({
      success: false,
      message: 'Instructor role not found in system'
    });
  }

  // Generate password if not provided
  const instructorPassword = password || generateRandomPassword();

  // Create instructor user
  const instructorData = {
    firstName,
    lastName,
    email,
    phone,
    password: instructorPassword,
    roleId: instructorRole._id,
    isActive: true,
    isEmailVerified: false,
    mustSetPassword: true,
    profile: {
      expertise,
      bio: req.body.bio || '',
      qualifications: req.body.qualifications || []
    }
  };

  const instructor = await userRepository.create(instructorData);

  // Send welcome email with credentials
  try {
    await emailService.sendInstructorWelcomeEmail(instructor, instructorPassword);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail the request if email fails
  }

  try {
    await emailService.sendAdminEventEmail(
      'Instructor created',
      `<p>A new instructor account was created.</p>
       <p><strong>Name:</strong> ${instructor.firstName || ''} ${instructor.lastName || ''}<br/>
       <strong>Email:</strong> ${instructor.email || '-'}</p>`
    );
  } catch (error) {
    console.error('Failed to send admin event email:', error);
  }

  res.status(201).json({
    success: true,
    message: 'Instructor created successfully',
    data: {
      id: instructor._id,
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      email: instructor.email,
      phone: instructor.phone,
      isActive: instructor.isActive,
      expertise: instructor.profile.expertise
    }
  });
});

/**
 * Update instructor information
 */
const updateInstructor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove sensitive fields that shouldn't be updated via this endpoint
  delete updates.password;
  delete updates.roleId;
  delete updates.isEmailVerified;

  // Handle profile updates separately
  if (updates.expertise || updates.bio || updates.qualifications) {
    updates.profile = {
      expertise: updates.expertise,
      bio: updates.bio,
      qualifications: updates.qualifications
    };
    delete updates.expertise;
    delete updates.bio;
    delete updates.qualifications;
  }

  const instructor = await userRepository.updateById(id, updates);
  
  if (!instructor) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found'
    });
  }

  res.json({
    success: true,
    message: 'Instructor updated successfully',
    data: instructor
  });
});

/**
 * Delete instructor (soft delete)
 */
const deleteInstructor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Check if instructor has any upcoming classes
  const upcomingClasses = await liveClassRepository.count({
    instructorId: id,
    scheduledStartTime: { $gt: new Date() }
  });

  if (upcomingClasses > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete instructor with upcoming classes'
    });
  }

  // Soft delete by deactivating
  const instructor = await userRepository.updateById(id, { isActive: false });
  
  if (!instructor) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found'
    });
  }

  res.json({
    success: true,
    message: 'Instructor deactivated successfully'
  });
});

/**
 * Assign instructor to a batch
 */
const assignToBatch = asyncHandler(async (req, res) => {
  const { instructorId, batchId } = req.body;

  // Validate instructor exists and is active
  const instructor = await userRepository.findById(instructorId);
  if (!instructor || !instructor.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found or inactive'
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

  // Check if instructor is already assigned
  if (batch.instructorId && batch.instructorId.toString() === instructorId) {
    return res.status(400).json({
      success: false,
      message: 'Instructor is already assigned to this batch'
    });
  }

  // Update batch with new instructor
  const updatedBatch = await batchRepository.updateById(batchId, {
    instructorId
  });

  res.json({
    success: true,
    message: 'Instructor assigned to batch successfully',
    data: updatedBatch
  });
});

/**
 * Remove instructor from batch
 */
const removeFromBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const batch = await batchRepository.findById(batchId);
  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  // Check if batch has an instructor assigned
  if (!batch.instructorId) {
    return res.status(400).json({
      success: false,
      message: 'No instructor assigned to this batch'
    });
  }

  // Check if instructor has upcoming classes in this batch
  const upcomingClasses = await liveClassRepository.count({
    batchId,
    instructorId: batch.instructorId,
    scheduledStartTime: { $gt: new Date() }
  });

  if (upcomingClasses > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot remove instructor with upcoming classes in this batch'
    });
  }

  // Remove instructor from batch
  await batchRepository.updateById(batchId, {
    $unset: { instructorId: 1 }
  });

  res.json({
    success: true,
    message: 'Instructor removed from batch successfully'
  });
});

/**
 * Get instructor classes
 */
const getInstructorClasses = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;
  
  const filter = { instructorId: id };
  if (status) {
    if (status === 'upcoming') {
      filter.scheduledStartTime = { $gt: new Date() };
    } else if (status === 'completed') {
      filter.scheduledEndTime = { $lt: new Date() };
    } else if (status === 'ongoing') {
      filter.scheduledStartTime = { $lte: new Date() };
      filter.scheduledEndTime = { $gte: new Date() };
    }
  }

  const classes = await liveClassRepository.find(filter, {
    populate: [
      { path: 'batchId', select: 'name' },
      { path: 'courseId', select: 'title' }
    ],
    sort: { scheduledStartTime: 1 }
  });

  res.json({
    success: true,
    data: classes
  });
});

/**
 * Get instructor batches
 */
const getInstructorCourses = asyncHandler(async (req, res) => {

  const courses = await batchRepository.find(
    { instructorId: req.userId },
    {
      populate: [
        { path: 'courseId', select: 'title' },
      ]
    }
  );

  res.json({
    success: true,
    data: courses
  });
});

/**
 * Get instructor batches
 */
const getInstructorBatches = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const batches = await batchRepository.find(
    { instructorId: id },
    {
      populate: [
        { path: 'courseId', select: 'title' },
        { path: 'students', select: 'firstName lastName' }
      ]
    }
  );

  res.json({
    success: true,
    data: batches
  });
});

/**
 * Get instructor statistics
 */
const getInstructorStats = asyncHandler(async (req, res) => {
  // Get instructor role ID
  const instructorRole = await roleRepository.findOne({ name: 'INSTRUCTOR' });
  if (!instructorRole) {
    return res.status(500).json({
      success: false,
      message: 'Instructor role not found in system'
    });
  }

  const totalInstructors = await userRepository.count({ roleId: instructorRole._id });
  const activeInstructors = await userRepository.count({ 
    roleId: instructorRole._id, 
    isActive: true 
  });

  // Get class statistics
  const now = new Date();
  const totalClasses = await liveClassRepository.count({});
  const completedClasses = await liveClassRepository.count({ status: 'ENDED' });
  const upcomingClasses = await liveClassRepository.count({
    status: 'SCHEDULED',
    scheduledStartTime: { $gt: now }
  });
  const liveClasses = await liveClassRepository.count({ status: 'LIVE' });
  const classStats = {
    totalClasses,
    completedClasses,
    upcomingClasses,
    liveClasses,
    completionRate: totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0
  };
  
  res.json({
    success: true,
    data: {
      totalInstructors,
      activeInstructors,
      inactiveInstructors: totalInstructors - activeInstructors,
      ...classStats
    }
  });
});

/**
 * Reset instructor password
 */
const resetInstructorPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const instructor = await userRepository.findById(id);
  if (!instructor) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found'
    });
  }

  // Generate new password
  const newPassword = generateRandomPassword();
  
  // Update password
  await userRepository.updateById(id, { password: newPassword });

  // Send email with new password
  try {
    await emailService.sendPasswordResetEmail(instructor, newPassword);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }

  res.json({
    success: true,
    message: 'Password reset successfully. New password sent to instructor\'s email.'
  });
});

/**
 * Toggle instructor active/inactive status
 */
const toggleInstructorStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const instructor = await userRepository.findById(id, {
    populate: { path: 'roleId', select: 'name' }
  });

  if (!instructor) {
    return res.status(404).json({
      success: false,
      message: 'Instructor not found'
    });
  }

  if (String(instructor?.roleId?.name || '').toUpperCase() !== 'INSTRUCTOR') {
    return res.status(400).json({
      success: false,
      message: 'Selected user is not an instructor'
    });
  }

  const updated = await userRepository.updateById(id, {
    isActive: !Boolean(instructor.isActive)
  });

  return res.json({
    success: true,
    message: `Instructor ${updated?.isActive ? 'activated' : 'deactivated'} successfully`,
    data: updated
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
 * Get current instructor's batches (for logged-in instructor)
 */
const getMyBatches = asyncHandler(async (req, res) => {
  const instructorId = req.userId.toString(); // From auth middleware
  console.log(instructorId, "INSTRUCTOR ID");
  const batches = await batchRepository.find(
    { instructorId },
    {
      populate: [
        { path: 'courseId', select: 'title description category level' },
        { path: 'createdBy', select: 'firstName lastName' }
      ],
      sort: { startDate: -1 }
    }
  );
  console.log(batches, "Batches for requesting instructor");
  // Get student counts for each batch
  const { enrollmentRepository } = require('../repositories');
  const batchesWithCounts = await Promise.all(
    batches.map(async (batch) => {
      const studentCount = await enrollmentRepository.count({ batchId: batch.id });
      return {
        ...batch,
        currentEnrollment: studentCount
      };
    })
  );

  res.json({
    success: true,
    count: batchesWithCounts.length,
    data: batchesWithCounts
  });
});


/**
 * Get current instructor's enrollments (for logged-in instructor)
 */
const getMyEnrollments = asyncHandler(async (req, res) => {
  const instructorId = req.userId.toString(); // From auth middleware
  const enrollmentsData = await Enrollment.find({ instructorId })
    .populate('courseId', 'title slug thumbnail')
    .populate('batchId', 'name batchCode schedule')
    .populate('instructorId', 'firstName lastName email')
    .populate('enrolledBy', 'firstName lastName');
  console.log(enrollmentsData, "Batches for requesting instructor");
  // Get student counts for each batch

  res.json({
    success: true,
    data: enrollmentsData
  });
});

/**
 * Get current instructor's live classes (for logged-in instructor)
 */
const getMyClasses = asyncHandler(async (req, res) => {
  const instructorId = req.userId; // From auth middleware
  
  const classes = await liveClassRepository.find(
    { instructorId },
    {
      populate: [
        { path: 'batchId', select: 'name courseId' },
        { path: 'batchId.courseId', select: 'title' }
      ],
      sort: { scheduledStartTime: 1 }
    }
  );

  res.json({
    success: true,
    data: classes
  });
});

/**
 * Get detailed view for one instructor-owned batch
 */
const getMyBatchDetails = asyncHandler(async (req, res) => {
  const instructorId = req.userId.toString();
  const { id } = req.params;

  const batch = await batchRepository.findById(id, {
    populate: [
      { path: 'courseId', select: 'title description category level' },
      { path: 'instructorId', select: 'firstName lastName email phone bio specialization experience' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]
  });

  if (!batch) {
    return res.status(404).json({
      success: false,
      message: 'Batch not found'
    });
  }

  if (!batch.instructorId || batch.instructorId.id.toString() !== instructorId) {
    return res.status(403).json({
      success: false,
      message: 'You can only access your own batches'
    });
  }

  const [classes, enrollments] = await Promise.all([
    liveClassRepository.find({ batchId: id }, { sort: { scheduledStartTime: 1 } }),
    Enrollment.find({ batchId: id }).populate('studentId', 'firstName lastName email phone avatar isActive')
  ]);

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
        activeStudents: enrollments.filter(e => e.studentId?.isActive && e.status === 'ENROLLED').length
      }
    }
  });
});

/**
 * Get instructor dashboard data
 */
const getInstructorDashboard = asyncHandler(async (req, res) => {
  const instructorId = req.userId;
  
  // Get instructor's batches
  const batches = await batchRepository.find(
    { instructorId },
    {
      populate: { path: 'courseId', select: 'title category' }
    }
  );

  // Get instructor's classes
  const classes = await liveClassRepository.find(
    { instructorId },
    {
      populate: { path: 'batchId', select: 'name' },
      sort: { scheduledStartTime: 1 }
    }
  );

  // Get student counts
  const { enrollmentRepository } = require('../repositories');
  let totalStudents = 0;
  for (const batch of batches) {
    const count = await enrollmentRepository.count({ batchId: batch.id });
    totalStudents += count;
  }

  // Calculate statistics
  const now = new Date();
  const upcomingClasses = classes.filter(c => 
    new Date(c.scheduledStartTime) > now && c.status === 'SCHEDULED'
  );
  const completedClasses = classes.filter(c => c.status === 'ENDED');

  // Get unique courses
  const uniqueCourses = new Set(batches.map(b => b.courseId.id));

  res.json({
    success: true,
    data: {
      batches,
      classes,
      stats: {
        totalCourses: uniqueCourses.size,
        totalBatches: batches.length,
        activeBatches: batches.filter(b => b.status === 'ACTIVE').length,
        totalStudents,
        upcomingClasses: upcomingClasses.length,
        completedClasses: completedClasses.length,
        totalClasses: classes.length
      },
      upcomingClasses: upcomingClasses.slice(0, 5)
    }
  });
});

module.exports = {
  getInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  assignToBatch,
  removeFromBatch,
  getInstructorClasses,
  getInstructorBatches,
  getInstructorStats,
  resetInstructorPassword,
  toggleInstructorStatus,
  getMyBatches,
  getMyClasses,
  getMyBatchDetails,
  getInstructorDashboard,
  getInstructorCourses,
  getMyEnrollments
};
