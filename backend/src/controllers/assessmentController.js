const { assessmentRepository, courseRepository, batchRepository, assessmentSubmissionRepository, enrollmentRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const notificationService = require('../services/notificationService');

const canInstructorAccessAssessment = async (assessment, instructorId) => {
  if (!assessment) return false;
  if (assessment.createdBy?.toString() === instructorId.toString()) return true;

  const batchId = assessment.batchId?._id || assessment.batchId;
  if (batchId) {
    const batch = await batchRepository.findById(batchId);
    if (batch?.instructorId?.toString() === instructorId.toString()) {
      return true;
    }
  }

  const courseId = assessment.courseId?._id || assessment.courseId;
  if (courseId) {
    const assignedBatch = await batchRepository.findOne({
      courseId,
      instructorId,
      status: { $ne: 'CANCELLED' }
    });
    if (assignedBatch) return true;
  }

  return false;
};

const getAssessmentRecipientStudentIds = async (assessment) => {
  const courseId = assessment.courseId?._id || assessment.courseId;
  const batchId = assessment.batchId?._id || assessment.batchId;
  if (!courseId) return [];

  const enrollmentFilter = { courseId, status: 'ENROLLED' };
  if (batchId) {
    enrollmentFilter.batchId = batchId;
  }

  const enrollments = await enrollmentRepository.find(enrollmentFilter, { select: 'studentId' });
  return [...new Set(enrollments.map((enrollment) => enrollment.studentId?.toString()).filter(Boolean))];
};

const ensureInstructorAssessmentScope = async (assessment, req, res) => {
  if (!assessment) {
    res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
    return false;
  }

  const isInstructor = req.user?.roleId?.name === 'INSTRUCTOR';
  if (isInstructor && !(await canInstructorAccessAssessment(assessment, req.userId))) {
    res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
    return false;
  }

  return true;
};

/**
 * Get all assessments with filtering and pagination
 */
const getAssessments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, courseId, batchId, type, status, search } = req.query;
  
  // Handle different user roles
  if (req.user.roleId.name === 'STUDENT') {
    // For students, get all available assessments from their enrolled courses
    return getAvailableAssessments(req, res);
  }

  const filters = {};
  if (courseId) filters.courseId = courseId;
  if (batchId) filters.batchId = batchId;
  if (type) filters.type = type;
  if (status) filters.status = status;
  if (search) {
    filters.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // For instructors, filter by assessments they created
  if (req.user.roleId.name === 'INSTRUCTOR') {
    filters.createdBy = req.user.id;
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: [
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ],
    sort: { createdAt: -1 }
  };

  const result = await assessmentRepository.paginate(filters, options);
  
  res.json({
    success: true,
    data: result.documents,
    pagination: result.pagination
  });
});

/**
 * Get single assessment by ID
 */
const getAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { includeAnswers = false } = req.query;
  
  const assessment = await assessmentRepository.findById(id, {
    populate: [
      { path: 'courseId', select: 'title description' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]
  });
  
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  // Remove correct answers if not authorized
  if (!includeAnswers && req.user.roleId.name !== 'ADMIN' && req.user.roleId.name !== 'INSTRUCTOR') {
    assessment.questions = assessment.questions.map(question => {
      const { correctAnswer, options, coding, ...questionWithoutAnswers } = question;
      
      // For multiple choice, remove the isCorrect flag from options
      if (question.type === 'multiple-choice' && options) {
        questionWithoutAnswers.options = options.map(({ isCorrect, ...option }) => option);
      }

      if (question.type === 'coding' && coding) {
        questionWithoutAnswers.coding = {
          ...coding,
          testCases: (coding.testCases || []).map((testCase) => {
            if (!testCase.isHidden) return testCase;
            return {
              isHidden: true,
              weight: testCase.weight || 1
            };
          })
        };
      }
      
      return questionWithoutAnswers;
    });
  }

  res.json({
    success: true,
    data: assessment
  });
});

/**
 * Create new assessment
 */
const createAssessment = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Verify course exists
  const course = await courseRepository.findById(req.body.courseId);
  if (!course) {
    return res.status(404).json({
      success: false,
      message: 'Course not found'
    });
  }

  // Verify batch exists if provided
  if (req.body.batchId) {
    const batch = await batchRepository.findById(req.body.batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
  }

  const assessmentData = {
    ...req.body,
    createdBy: req.userId,
    lastModifiedBy: req.userId
  };

  const assessment = await assessmentRepository.create(assessmentData);

  if (assessment.status === 'published') {
    const recipientIds = await getAssessmentRecipientStudentIds(assessment);
    await notificationService.createForUsers(recipientIds, {
      actorId: req.userId,
      type: 'ASSESSMENT_CREATED',
      title: 'New assessment available',
      message: `${assessment.title} is now available.`,
      priority: 'high',
      data: {
        assessmentId: assessment.id || assessment._id?.toString(),
        courseId: assessment.courseId?.toString?.() || assessment.courseId,
        batchId: assessment.batchId?.toString?.() || assessment.batchId || null,
        type: assessment.type
      }
    });
  }
  
  res.status(201).json({
    success: true,
    message: 'Assessment created successfully',
    data: assessment
  });
});

/**
 * Update assessment
 */
const updateAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = {
    ...req.body,
    courseId: req.body.courseId?._id || req.body.courseId,
    createdBy: req.body.createdBy?.id || req.body.createdBy,
    lastModifiedBy: req.userId
  };
  const assessment = await assessmentRepository.updateById(id, updates);
  
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  res.json({
    success: true,
    message: 'Assessment updated successfully',
    data: assessment
  });
});

/**
 * Delete assessment
 */
const deleteAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Soft delete by updating status
  const assessment = await assessmentRepository.updateById(id, { 
    status: 'deleted',
    lastModifiedBy: req.userId
  });
  
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  res.json({
    success: true,
    message: 'Assessment deleted successfully'
  });
});

/**
 * Publish assessment
 */
const publishAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const assessment = await assessmentRepository.updateById(id, {
    status: 'published',
    publishedAt: new Date(),
    lastModifiedBy: req.userId
  });
  
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  const recipientIds = await getAssessmentRecipientStudentIds(assessment);
  await notificationService.createForUsers(recipientIds, {
    actorId: req.userId,
    type: 'ASSESSMENT_PUBLISHED',
    title: 'Assessment published',
    message: `${assessment.title} has been published.`,
    priority: 'high',
    data: {
      assessmentId: assessment.id || assessment._id?.toString(),
      courseId: assessment.courseId?.toString?.() || assessment.courseId,
      batchId: assessment.batchId?.toString?.() || assessment.batchId || null,
      type: assessment.type
    }
  });

  res.json({
    success: true,
    message: 'Assessment published successfully',
    data: assessment
  });
});

/**
 * Duplicate assessment
 */
const duplicateAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  
  if (!title) {
    return res.status(400).json({
      success: false,
      message: 'Title is required for duplicated assessment'
    });
  }

  const duplicated = await assessmentRepository.duplicate(id, title, req.userId);
  
  res.status(201).json({
    success: true,
    message: 'Assessment duplicated successfully',
    data: duplicated
  });
});

/**
 * Get assessments by course
 */
const getAssessmentsByCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { batchId } = req.query;
  
  let assessments;
  if (batchId) {
    assessments = await assessmentRepository.findByBatch(batchId);
  } else {
    assessments = await assessmentRepository.findByCourse(courseId);
  }
  
  res.json({
    success: true,
    data: assessments
  });
});

/**
 * Get available assessments for student
 */
const getAvailableAssessments = asyncHandler(async (req, res) => {
  const { courseId, batchId } = req.params;
  const studentId = req.user?.id || req.userId;
  
  let assessments;
  
  if (courseId) {
    // Get assessments for specific course/batch
    assessments = await assessmentRepository.findAvailableForStudent(
      studentId, 
      courseId, 
      batchId
    );
  } else {
    // Get all available assessments for the student across all enrolled courses
    // Get student's enrollments
    const enrollments = await enrollmentRepository.find({
      studentId,
      status: 'ENROLLED'
    });
    
    if (enrollments.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // Get all assessments for enrolled courses and batches
    const courseIds = enrollments.map(e => e.courseId);
    const batchIds = enrollments.map(e => e.batchId);
    
    assessments = await assessmentRepository.find({
      $and: [
        { status: 'published' },
        {
          $or: [
            { courseId: { $in: courseIds }, batchId: { $in: batchIds } },
            { courseId: { $in: courseIds }, batchId: null } // Course-wide assessments
          ]
        }
      ]
    }, {
      populate: [
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ],
      sort: { createdAt: -1 }
    });
  }

  // Get student's submissions for these assessments
  const assessmentIds = assessments.map(a => a._id);
  const submissions = await assessmentSubmissionRepository.find({
    assessmentId: { $in: assessmentIds },
    studentId
  });
  // Add submission info to each assessment
  const assessmentsWithSubmissions = assessments.map(assessment => {
    const studentSubmissions = submissions.filter(
      sub => sub.assessmentId.toString() === assessment._id.toString()
    );
    
    return {
      ...assessment,
      submissions: studentSubmissions,
      hasAttempts: studentSubmissions.length > 0,
      canAttempt: studentSubmissions.length < assessment.settings.attempts,
      bestScore: studentSubmissions.length > 0 
        ? Math.max(...studentSubmissions.filter(s => s.isCompleted).map(s => s.scoring.percentage || 0))
        : null
    };
  });
  
  res.json({
    success: true,
    data: assessmentsWithSubmissions
  });
});

/**
 * Get assessment statistics
 */
const getAssessmentStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const assessment = await assessmentRepository.findById(id);
  if (!(await ensureInstructorAssessmentScope(assessment, req, res))) {
    return;
  }
  
  const stats = await assessmentRepository.getAssessmentStats(id);
  
  if (!stats) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  res.json({
    success: true,
    data: stats
  });
});

/**
 * Get assessment submissions
 */
const getAssessmentSubmissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, status, studentId } = req.query;

  const assessment = await assessmentRepository.findById(id);
  if (!(await ensureInstructorAssessmentScope(assessment, req, res))) {
    return;
  }
  
  const filters = { assessmentId: id };
  if (status) filters.status = status;
  if (studentId) filters.studentId = studentId;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: [
      { path: 'studentId', select: 'firstName lastName email' },
      { path: 'enrollmentId', select: 'enrollmentDate' }
    ],
    sort: { startedAt: -1 }
  };

  const result = await assessmentSubmissionRepository.paginate(filters, options);
  
  res.json({
    success: true,
    data: result.documents,
    pagination: result.pagination
  });
});

/**
 * Export assessment data
 */
const exportAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { format = 'json' } = req.query;
  
  const assessment = await assessmentRepository.findById(id, {
    populate: [
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]
  });
  
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  if (req.user?.roleId?.name === 'INSTRUCTOR' && !(await canInstructorAccessAssessment(assessment, req.userId))) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  const submissions = await assessmentSubmissionRepository.findByAssessment(id);
  
  const exportData = {
    assessment: assessment.toObject(),
    submissions: submissions.map(sub => sub.toObject()),
    exportedAt: new Date(),
    exportedBy: req.userId
  };

  if (format === 'csv') {
    // Convert to CSV format (basic implementation)
    const csvHeader = 'Student,Email,Score,Grade,Completed At\n';
    const csvData = submissions
      .filter(sub => sub.isCompleted)
      .map(sub => 
        `"${sub.studentId.firstName} ${sub.studentId.lastName}","${sub.studentId.email}",${sub.scoring.percentage}%,${sub.scoring.grade},"${sub.completedAt}"`
      )
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="assessment-${id}-results.csv"`);
    res.send(csvHeader + csvData);
  } else {
    res.json({
      success: true,
      data: exportData
    });
  }
});

module.exports = {
  getAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  publishAssessment,
  duplicateAssessment,
  getAssessmentsByCourse,
  getAvailableAssessments,
  getAssessmentStats,
  getAssessmentSubmissions,
  exportAssessment
};
