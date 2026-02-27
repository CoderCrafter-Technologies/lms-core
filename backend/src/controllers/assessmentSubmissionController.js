const { assessmentSubmissionRepository, assessmentRepository, enrollmentRepository, batchRepository, userRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const { buildExecutableCode } = require('../utils/codingRunner');
const { executeCode: executeWithCompiler } = require('../services/codeExecutionService');
const notificationService = require('../services/notificationService');

const MAX_CODE_LENGTH = Number(process.env.CODE_EXEC_MAX_CODE_LENGTH || 20000);
const MAX_STDIN_LENGTH = Number(process.env.CODE_EXEC_MAX_STDIN_LENGTH || 5000);
const MAX_SAMPLE_TEST_CASES = Number(process.env.CODE_EXEC_MAX_SAMPLE_TEST_CASES || 20);
const ALLOWED_EXEC_LANGUAGES = new Set(
  String(process.env.CODE_EXEC_ALLOWED_LANGUAGES || 'javascript,python,java,cpp')
    .split(',')
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean)
);

const validateCodeExecutionPayload = ({ language, code, stdin = '' }) => {
  const normalizedLanguage = String(language || '').trim().toLowerCase();

  if (!normalizedLanguage || !code) {
    return { valid: false, message: 'language and code are required' };
  }

  if (!ALLOWED_EXEC_LANGUAGES.has(normalizedLanguage)) {
    return { valid: false, message: 'Language is not allowed for code execution' };
  }

  if (String(code).length > MAX_CODE_LENGTH) {
    return { valid: false, message: `Code exceeds max length of ${MAX_CODE_LENGTH} characters` };
  }

  if (String(stdin || '').length > MAX_STDIN_LENGTH) {
    return { valid: false, message: `stdin exceeds max length of ${MAX_STDIN_LENGTH} characters` };
  }

  return { valid: true, normalizedLanguage };
};

const sanitizeQuestionForStudent = (question, includeCorrectAnswers = false) => {
  const { correctAnswer, options, coding, ...questionData } = question;

  if (question.type === 'multiple-choice' && options) {
    questionData.options = options.map((option) => {
      if (includeCorrectAnswers) return option;
      const { isCorrect, ...safeOption } = option;
      return safeOption;
    });
  }

  if (question.type === 'coding' && coding) {
    const safeTestCases = (coding.testCases || []).map((testCase) => {
      if (includeCorrectAnswers || !testCase.isHidden) {
        return testCase;
      }
      return {
        isHidden: true,
        weight: testCase.weight || 1
      };
    });

    questionData.coding = {
      ...coding,
      testCases: safeTestCases
    };
  }

  if (includeCorrectAnswers) {
    questionData.correctAnswer = correctAnswer;
  }

  return questionData;
};
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

const hasSubjectiveQuestions = (assessment) =>
  Array.isArray(assessment?.questions) &&
  assessment.questions.some((question) => ['short-answer', 'essay'].includes(question?.type));

const ensureInstructorCanAccessSubmission = async (submissionId, user) => {
  const submission = await assessmentSubmissionRepository.findById(submissionId, {
    populate: [{ path: 'assessmentId', select: 'createdBy courseId batchId title grading settings' }]
  });

  if (!submission) {
    return { error: { code: 404, message: 'Submission not found' } };
  }

  if (user.roleId.name === 'INSTRUCTOR') {
    const allowed = await canInstructorAccessAssessment(submission.assessmentId, user.id || user._id);
    if (!allowed) {
      return { error: { code: 403, message: 'Unauthorized access' } };
    }
  }

  return { submission };
};


/**
 * Start assessment attempt
 */
const startAssessment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assessmentId = id;
  const studentId = req.userId;
  // Get assessment details
  const assessment = await assessmentRepository.findById(assessmentId);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  // Check if assessment is available
  if (assessment.status !== 'published') {
    return res.status(400).json({
      success: false,
      message: 'Assessment is not available'
    });
  }

  // Check schedule
  const now = new Date();
  if (assessment.schedule.isScheduled) {
    if (now < assessment.schedule.startDate || now > assessment.schedule.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Assessment is not currently available'
      });
    }
  }

  // Get student's enrollment
  const enrollment = await enrollmentRepository.findOne({
    studentId,
    courseId: assessment.courseId,
    status: 'ENROLLED'
  });
  if (!enrollment) {
    return res.status(403).json({
      success: false,
      message: 'You are not enrolled in this course'
    });
  }

  // Check existing attempts
  const existingAttempts = await assessmentSubmissionRepository.findStudentAttempts(assessmentId, studentId);
  
  if (existingAttempts.length >= assessment.settings.attempts) {
    return res.status(400).json({
      success: false,
      message: 'Maximum attempts reached'
    });
  }

  // Check for active submission - but allow continuation
  const activeSubmission = await assessmentSubmissionRepository.findActiveSubmission(assessmentId, studentId);
  if (activeSubmission) {
    // Check if submission has expired
    const now = new Date();
    const isExpired = activeSubmission.expiresAt && now > activeSubmission.expiresAt;
    
    if (isExpired) {
      // Mark as abandoned and allow new attempt
      activeSubmission.status = 'abandoned';
      activeSubmission.abandonedAt = now;
      await activeSubmission.save();
    } else {
      // Return existing submission to continue
      
      // Return assessment questions without answers
      const questions = assessment.questions.map((question) => sanitizeQuestionForStudent(question, false));

      return res.json({
        success: true,
        message: 'Continuing existing assessment attempt',
        data: {
          submission: {
            id: activeSubmission._id,
            attemptNumber: activeSubmission.attemptNumber,
            startedAt: activeSubmission.startedAt,
            timeLimit: activeSubmission.timeLimit,
            remainingTime: activeSubmission.remainingTime
          },
          assessment: {
            id: assessment._id,
            title: assessment.title,
            description: assessment.description,
            instructions: assessment.instructions,
            sections: assessment.sections,
            type: assessment.type,
            settings: assessment.settings,
            grading: assessment.grading
          },
          questions: questions
        }
      });
    }
  }

  // Create new submission
  const submission = await assessmentSubmissionRepository.createNewAttempt(
    assessmentId,
    studentId,
    enrollment.id,
    assessment.settings.timeLimit
  );

  // Return assessment questions without answers
  const questions = assessment.questions.map((question) => sanitizeQuestionForStudent(question, false));

  res.status(201).json({
    success: true,
    message: 'Assessment started successfully',
    data: {
      submission: {
        id: submission._id,
        attemptNumber: submission.attemptNumber,
        startedAt: submission.startedAt,
        timeLimit: submission.timeLimit,
        remainingTime: submission.remainingTime
      },
      assessment: {
        id: assessment._id,
        title: assessment.title,
        description: assessment.description,
        instructions: assessment.instructions,
        sections: assessment.sections,
        type: assessment.type,
        settings: assessment.settings,
        grading: assessment.grading
      },
      questions: questions
    }
  });
});

/**
 * Save progress (auto-save answers)
 */
const saveProgress = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { submissionId } = req.params;
  const { questionId, answer, timeSpent } = req.body;
  
  const submission = await assessmentSubmissionRepository.findById(submissionId);
  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }



  // Check if submission belongs to current user
  if (submission.studentId.toString() !== req.userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  // Check if submission is still active
  if (submission.status !== 'in-progress') {
    return res.status(400).json({
      success: false,
      message: 'Submission is no longer active'
    });
  }

  // Check time limit
  if (submission.timeLimit) {
    const elapsed = Math.floor((Date.now() - submission.startedAt) / (1000 * 60));
    if (elapsed > submission.timeLimit) {
      return res.status(400).json({
        success: false,
        message: 'Time limit exceeded'
      });
    }
  }
  await assessmentSubmissionRepository.updateProgress(submissionId, questionId, answer, timeSpent);
  
  res.json({
    success: true,
    message: 'Progress saved successfully'
  });
});

/**
 * Submit assessment
 */
const submitAssessment = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { submissionId } = req.params;
  const { answers, deviceInfo } = req.body;
  
  const submission = await assessmentSubmissionRepository.findById(submissionId);
  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }

  // Check if submission belongs to current user
  if (submission.studentId.toString() !== req.userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  // Check if already submitted
  if (submission.isCompleted) {
    return res.status(400).json({
      success: false,
      message: 'Assessment already submitted'
    });
  }

  const completedSubmission = await assessmentSubmissionRepository.submitAssessment(
    submissionId,
    answers,
    deviceInfo
  );

  const assessment = await assessmentRepository.findById(submission.assessmentId, {
    select: 'title type createdBy batchId'
  });
  const fullAssessment = await assessmentRepository.findById(submission.assessmentId);
  const gradingMethod = fullAssessment?.grading?.gradingMethod || 'automatic';
  const needsManualReview =
    gradingMethod === 'manual' ||
    gradingMethod === 'hybrid' ||
    hasSubjectiveQuestions(fullAssessment);

  if (needsManualReview) {
    const reviewedSubmission = await assessmentSubmissionRepository.updateById(
      completedSubmission._id,
      {
        'flags.needsReview': true
      }
    );

    const batch = assessment?.batchId
      ? await batchRepository.findById(assessment.batchId, { select: 'instructorId' })
      : null;

    const adminManagerUsers = await userRepository.find({}, {
      populate: { path: 'roleId', select: 'name' },
      select: 'isActive roleId'
    });

    const adminManagerIds = adminManagerUsers
      .filter((user) => user.isActive && ['ADMIN', 'MANAGER'].includes(user.roleId?.name))
      .map((user) => user.id?.toString())
      .filter(Boolean);

    const recipients = [
      assessment?.createdBy?.toString?.() || assessment?.createdBy,
      batch?.instructorId?.toString?.() || batch?.instructorId,
      ...adminManagerIds
    ].filter(Boolean);

    await notificationService.createForUsers(recipients, {
      actorId: req.userId,
      type: 'ASSESSMENT_SUBMITTED',
      title: 'Submission awaiting manual review',
      message: `A submission for ${assessment?.title || 'assessment'} is waiting for manual grading.`,
      priority: 'normal',
      data: {
        assessmentId: assessment?.id || assessment?._id?.toString(),
        submissionId: reviewedSubmission?._id?.toString?.() || completedSubmission._id?.toString?.(),
        assessmentType: assessment?.type,
        gradingMethod
      }
    });

    return res.json({
      success: true,
      message: 'Assessment submitted and queued for manual review',
      data: {
        submissionId: reviewedSubmission?._id || completedSubmission._id,
        scoring: reviewedSubmission?.scoring || completedSubmission.scoring,
        completedAt: reviewedSubmission?.completedAt || completedSubmission.completedAt,
        manualReviewRequired: true
      }
    });
  }

  // Small delay to ensure database consistency
  await new Promise(resolve => setTimeout(resolve, 100));

  // Auto-grade the submission - use the completedSubmission id to ensure we have the latest data
  const gradedSubmission = await assessmentSubmissionRepository.gradeSubmission(
    completedSubmission._id,
    { overallComments: 'Auto-graded submission' },
    req.userId
  );

  // Update assessment statistics
  await assessmentRepository.updateStats(submission.assessmentId);

  // Notify instructor/admin for exam submissions only.

  if (assessment?.type === 'exam') {
    const batch = assessment.batchId
      ? await batchRepository.findById(assessment.batchId, { select: 'instructorId' })
      : null;

    const adminManagerUsers = await userRepository.find({}, {
      populate: { path: 'roleId', select: 'name' },
      select: 'isActive roleId'
    });

    const adminManagerIds = adminManagerUsers
      .filter((user) => user.isActive && ['ADMIN', 'MANAGER'].includes(user.roleId?.name))
      .map((user) => user.id?.toString())
      .filter(Boolean);

    const recipients = [
      assessment.createdBy?.toString?.() || assessment.createdBy,
      batch?.instructorId?.toString?.() || batch?.instructorId,
      ...adminManagerIds
    ].filter(Boolean);

    await notificationService.createForUsers(recipients, {
      actorId: req.userId,
      type: 'ASSESSMENT_SUBMITTED',
      title: 'Exam submitted',
      message: `A student submitted ${assessment.title}.`,
      priority: 'normal',
      data: {
        assessmentId: assessment.id || assessment._id?.toString(),
        submissionId: gradedSubmission._id?.toString?.() || gradedSubmission._id,
        assessmentType: assessment.type
      }
    });
  }

  res.json({
    success: true,
    message: 'Assessment submitted successfully',
    data: {
      submissionId: gradedSubmission._id,
      scoring: gradedSubmission.scoring,
      completedAt: gradedSubmission.completedAt
    }
  });
});

/**
 * Get submission details
 */
const getSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  
  const submission = await assessmentSubmissionRepository.findById(submissionId, {
    populate: [
      { 
        path: 'assessmentId',
        select: 'courseId batchId createdBy title',
        populate: { path: 'courseId', select: 'title' }
      },
      { path: 'studentId', select: 'firstName lastName email' }
    ]
  });
  
  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }

  // Check access permissions
  const isStudent = submission.studentId._id.toString() === req.userId;
  const isInstructor = req.user.roleId.name === 'INSTRUCTOR';
  const isAdmin = req.user.roleId.name === 'ADMIN';
  const isManager = req.user.roleId.name === 'MANAGER';

  if (!isStudent && !isInstructor && !isAdmin && !isManager) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  if (isInstructor && !(await canInstructorAccessAssessment(submission.assessmentId, req.userId))) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  res.json({
    success: true,
    data: submission
  });
});

/**
 * Get student submissions
 */
const getStudentSubmissions = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId || req.userId;
  const { courseId, status, page = 1, limit = 10 } = req.query;
  
  // Check permissions
  if (studentId !== req.userId && req.user.roleId.name === 'STUDENT') {
    return res.status(403).json({
      success: false,
      message: 'You can only view your own submissions'
    });
  }

  const filters = { studentId };
  if (status) filters.status = status;

  // If courseId provided, filter by assessments from that course
  if (courseId) {
    const assessments = await assessmentRepository.findByCourse(courseId);
    const assessmentIds = assessments.map(a => a._id);
    filters.assessmentId = { $in: assessmentIds };
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: [
      { 
        path: 'assessmentId',
        select: 'title type grading.totalPoints',
        populate: { path: 'courseId', select: 'title' }
      }
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
 * Add violation
 */
const addViolation = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { type, details } = req.body;
  
  const submission = await assessmentSubmissionRepository.findById(submissionId);
  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }

  // Check if submission belongs to current user
  if (submission.studentId.toString() !== req.userId) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  await assessmentSubmissionRepository.addViolation(submissionId, type, details);
  
  res.json({
    success: true,
    message: 'Violation recorded'
  });
});

/**
 * Get assessment results
 */
const getAssessmentResults = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const studentId = req.userId;
  const assessmentId = id;
  const submissions = await assessmentSubmissionRepository.findStudentAttempts(assessmentId, studentId);
  
  if (submissions.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No submissions found'
    });
  }

  const assessment = await assessmentRepository.findById(assessmentId);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  const showResultsPolicy = assessment.settings?.showResults || 'immediately';
  const now = new Date();
  if (showResultsPolicy === 'never') {
    return res.status(403).json({
      success: false,
      message: 'Results are not available for this assessment'
    });
  }

  if (showResultsPolicy === 'manual') {
    return res.status(403).json({
      success: false,
      message: 'Results are not yet released'
    });
  }

  if (
    showResultsPolicy === 'after-deadline' &&
    assessment.schedule?.isScheduled &&
    assessment.schedule?.endDate &&
    now < new Date(assessment.schedule.endDate)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Results will be available after the assessment deadline'
    });
  }

  const includeCorrectAnswers = !!assessment.settings?.showCorrectAnswers;
  const sanitizedQuestions = assessment.questions.map((question) =>
    sanitizeQuestionForStudent(question, includeCorrectAnswers)
  );

  // Get best attempt
  const bestAttempt = await assessmentSubmissionRepository.getBestAttempt(assessmentId, studentId);
  
  res.json({
    success: true,
    data: {
      assessment: {
        id: assessment._id,
        title: assessment.title,
        description: assessment.description,
        instructions: assessment.instructions,
        sections: assessment.sections,
        type: assessment.type,
        grading: assessment.grading,
        settings: {
          showCorrectAnswers: assessment.settings?.showCorrectAnswers,
          allowReview: assessment.settings?.allowReview
        }
      },
      questions: sanitizedQuestions,
      attempts: submissions,
      bestAttempt,
      totalAttempts: submissions.length
    }
  });
});

/**
 * Execute coding answer using external runner (Piston)
 */
const executeCode = asyncHandler(async (req, res) => {
  const { language, code, stdin = '', version = '*' } = req.body;

  const validation = validateCodeExecutionPayload({ language, code, stdin });
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.message
    });
  }

  try {
    const run = await executeWithCompiler({
      language: validation.normalizedLanguage,
      code,
      stdin,
      version
    });
    res.json({
      success: true,
      data: run
    });
  } catch (executionError) {
    return res.status(400).json({
      success: false,
      message: executionError.message || 'Code execution failed'
    });
  }
});

/**
 * Grade submission manually
 */
const gradeSubmission = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const feedback = req.body;
  
  // Only instructors and admins can grade
  if (!['INSTRUCTOR', 'ADMIN'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Only instructors and admins can grade submissions'
    });
  }

  if (req.user.roleId.name === 'INSTRUCTOR') {
    const submission = await assessmentSubmissionRepository.findById(submissionId, {
      populate: [{ path: 'assessmentId', select: 'createdBy courseId batchId' }]
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (!(await canInstructorAccessAssessment(submission.assessmentId, req.userId))) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
  }

  const gradedSubmission = await assessmentSubmissionRepository.gradeSubmission(
    submissionId,
    feedback,
    req.userId
  );

  if (!gradedSubmission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }

  // Update assessment statistics
  await assessmentRepository.updateStats(gradedSubmission.assessmentId);

  res.json({
    success: true,
    message: 'Submission graded successfully',
    data: gradedSubmission
  });
});

/**
 * Request revision on a submission
 */
const requestSubmissionRevision = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { reason = '', dueAt = null } = req.body;

  if (!['INSTRUCTOR', 'ADMIN'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Only instructors and admins can request revisions'
    });
  }

  const { error } = await ensureInstructorCanAccessSubmission(submissionId, req.user);
  if (error) {
    return res.status(error.code).json({
      success: false,
      message: error.message
    });
  }

  const updated = await assessmentSubmissionRepository.requestRevision(submissionId, {
    requestedBy: req.userId,
    reason,
    dueAt
  });

  res.json({
    success: true,
    message: 'Revision requested',
    data: updated
  });
});

/**
 * Record plagiarism report for a submission
 */
const recordSubmissionPlagiarism = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { provider, similarityScore, reportUrl, details, flagged, status } = req.body;

  if (!['INSTRUCTOR', 'ADMIN'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Only instructors and admins can update plagiarism reports'
    });
  }

  const { error } = await ensureInstructorCanAccessSubmission(submissionId, req.user);
  if (error) {
    return res.status(error.code).json({
      success: false,
      message: error.message
    });
  }

  const updated = await assessmentSubmissionRepository.recordPlagiarismReport(submissionId, {
    provider,
    similarityScore,
    reportUrl,
    details,
    flagged,
    status
  });

  res.json({
    success: true,
    message: 'Plagiarism report updated',
    data: updated
  });
});

/**
 * Override graded submission score
 */
const overrideSubmissionGrade = asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { points = null, percentage = null, reason = '' } = req.body;

  if (!['INSTRUCTOR', 'ADMIN'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Only instructors and admins can override grades'
    });
  }

  const { error } = await ensureInstructorCanAccessSubmission(submissionId, req.user);
  if (error) {
    return res.status(error.code).json({
      success: false,
      message: error.message
    });
  }

  const updated = await assessmentSubmissionRepository.overrideGrade(submissionId, {
    points,
    percentage,
    reason,
    overriddenBy: req.userId
  });

  await assessmentRepository.updateStats(updated.assessmentId);

  res.json({
    success: true,
    message: 'Grade override applied',
    data: updated
  });
});

/**
 * Centralized course gradebook with export support
 */
const getCourseGradebook = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { batchId = null, studentId = null, format = 'json' } = req.query;

  if (!['INSTRUCTOR', 'ADMIN', 'MANAGER'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Only instructors, admins, and managers can access gradebook'
    });
  }

  if (req.user.roleId.name === 'INSTRUCTOR') {
    const assignedBatch = await batchRepository.findOne({
      courseId,
      instructorId: req.userId,
      status: { $ne: 'CANCELLED' }
    });

    if (!assignedBatch) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
  }

  const enrollmentFilter = {
    courseId,
    status: { $in: ['ENROLLED', 'COMPLETED'] }
  };
  if (batchId) {
    enrollmentFilter.batchId = batchId;
  }
  if (studentId) {
    enrollmentFilter.studentId = studentId;
  }

  const enrollments = await enrollmentRepository.find(enrollmentFilter, {
    populate: [{ path: 'studentId', select: 'firstName lastName email' }]
  });

  const assessments = await assessmentRepository.find(
    { courseId, status: { $ne: 'deleted' } },
    {
      select: 'title type grading settings schedule',
      sort: { createdAt: 1 }
    }
  );

  const studentIds = enrollments.map((enrollment) => enrollment.studentId?.id || enrollment.studentId?._id || enrollment.studentId);
  const assessmentIds = assessments.map((assessment) => assessment.id || assessment._id);

  const submissions = assessmentIds.length > 0
    ? await assessmentSubmissionRepository.find(
        {
          assessmentId: { $in: assessmentIds },
          studentId: { $in: studentIds }
        },
        {
          sort: { completedAt: -1, createdAt: -1 }
        }
      )
    : [];

  const bestSubmissionByKey = new Map();
  for (let i = 0; i < submissions.length; i += 1) {
    const submission = submissions[i];
    const sId = submission.studentId?.toString?.() || String(submission.studentId);
    const aId = submission.assessmentId?.toString?.() || String(submission.assessmentId);
    const key = `${sId}:${aId}`;
    const current = bestSubmissionByKey.get(key);

    if (!current || Number(submission.scoring?.percentage || 0) >= Number(current.scoring?.percentage || 0)) {
      bestSubmissionByKey.set(key, submission);
    }
  }

  const rows = enrollments.map((enrollment) => {
    const student = enrollment.studentId || {};
    const studentKey = student.id || student._id?.toString?.() || String(student);

    const gradeEntries = assessments.map((assessment) => {
      const assessmentId = assessment.id || assessment._id?.toString?.() || String(assessment._id);
      const submission = bestSubmissionByKey.get(`${studentKey}:${assessmentId}`);
      const maxPoints = Number(assessment.grading?.totalPoints || 0);
      const earnedPoints = Number(submission?.scoring?.earnedPoints || 0);
      const percentage = Number(submission?.scoring?.percentage || 0);

      return {
        assessmentId,
        title: assessment.title,
        type: assessment.type,
        maxPoints,
        earnedPoints,
        percentage,
        grade: submission?.scoring?.grade || null,
        status: submission?.status || 'missing',
        isLate: Boolean(submission?.latePolicyApplied?.isLate),
        isOverridden: Boolean(submission?.gradeOverride?.isOverridden),
        overrideReason: submission?.gradeOverride?.reason || null,
        plagiarismFlagged: Boolean(submission?.plagiarismReport?.flagged)
      };
    });

    const totalMax = gradeEntries.reduce((sum, entry) => sum + Number(entry.maxPoints || 0), 0);
    const totalEarned = gradeEntries.reduce((sum, entry) => sum + Number(entry.earnedPoints || 0), 0);
    const averagePercentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

    return {
      studentId: student.id || student._id,
      studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      email: student.email || '',
      batchId: enrollment.batchId || null,
      totals: {
        earnedPoints: totalEarned,
        maxPoints: totalMax,
        percentage: averagePercentage
      },
      grades: gradeEntries
    };
  });

  if (String(format).toLowerCase() === 'csv') {
    const staticColumns = ['studentName', 'email', 'earnedPoints', 'maxPoints', 'percentage'];
    const assessmentColumns = assessments.map((assessment) => `${assessment.title} (${assessment.type})`);
    const header = [...staticColumns, ...assessmentColumns].join(',');

    const csvRows = rows.map((row) => {
      const base = [
        `"${String(row.studentName).replace(/"/g, '""')}"`,
        `"${String(row.email).replace(/"/g, '""')}"`,
        row.totals.earnedPoints,
        row.totals.maxPoints,
        `${row.totals.percentage}%`
      ];

      const gradeCells = row.grades.map((grade) => `${grade.percentage}%`);
      return [...base, ...gradeCells].join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="course-${courseId}-gradebook.csv"`);
    return res.send([header, ...csvRows].join('\n'));
  }

  res.json({
    success: true,
    data: {
      courseId,
      batchId,
      totalStudents: rows.length,
      totalAssessments: assessments.length,
      rows
    }
  });
});

/**
 * Get submission statistics
 */
const getSubmissionStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const stats = await assessmentSubmissionRepository.getSubmissionStats(id);
  
  res.json({
    success: true,
    data: stats || {
      totalSubmissions: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passedCount: 0,
      passRate: 0,
      gradeDistribution: [],
      averageTimeSpent: 0
    }
  });
});

/**
 * Run coding question against visible/sample test cases for an in-progress submission
 */
const runCodingQuestion = asyncHandler(async (req, res) => {
  const { submissionId, questionId } = req.params;
  const { language, code, version = '*' } = req.body;

  const validation = validateCodeExecutionPayload({ language, code, stdin: '' });
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.message
    });
  }

  const submission = await assessmentSubmissionRepository.findById(submissionId);
  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found'
    });
  }

  if (submission.studentId.toString() !== req.userId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  if (submission.status !== 'in-progress') {
    return res.status(400).json({
      success: false,
      message: 'Submission is no longer active'
    });
  }

  const assessment = await assessmentRepository.findById(submission.assessmentId);
  if (!assessment) {
    return res.status(404).json({
      success: false,
      message: 'Assessment not found'
    });
  }

  const question = assessment.questions.find((q) => q.id === questionId);
  if (!question || question.type !== 'coding') {
    return res.status(404).json({
      success: false,
      message: 'Coding question not found'
    });
  }

  const allowedLanguages = (question.coding?.allowedLanguages || []).map((lang) =>
    String(lang).trim().toLowerCase()
  );
  if (allowedLanguages.length > 0 && !allowedLanguages.includes(validation.normalizedLanguage)) {
    return res.status(400).json({
      success: false,
      message: 'Selected language is not allowed for this question'
    });
  }

  const sampleCases = (question.coding?.testCases || []).filter((testCase) => !testCase.isHidden);
  const casesToRun = (sampleCases.length > 0
    ? sampleCases
    : [{ input: '', expectedOutput: '', isHidden: false, weight: 1 }])
    .slice(0, MAX_SAMPLE_TEST_CASES);

  const results = [];
  let passed = 0;

  for (let index = 0; index < casesToRun.length; index += 1) {
    const testCase = casesToRun[index];
    try {
      const executable = buildExecutableCode({
        question,
        language: validation.normalizedLanguage,
        userCode: code,
        rawInput: testCase.input || ''
      });
      const execPayload = await executeWithCompiler({
        language: validation.normalizedLanguage,
        code: executable.code,
        stdin: executable.stdin,
        version
      });
      const stdout = String(execPayload?.stdout || execPayload?.output || '').trim();
      const stderr = String(execPayload?.stderr || '').trim();
      const expected = String(testCase.expectedOutput || '').trim();
      const passedCase = expected ? stdout === expected : !stderr;
      if (passedCase) passed += 1;

      results.push({
        index: index + 1,
        input: testCase.input || '',
        expectedOutput: expected,
        actualOutput: stdout,
        stderr,
        passed: passedCase
      });
    } catch (error) {
      results.push({
        index: index + 1,
        input: testCase.input || '',
        expectedOutput: String(testCase.expectedOutput || ''),
        actualOutput: '',
        stderr: error?.message || 'Execution failed',
        passed: false
      });
    }
  }

  await assessmentSubmissionRepository.updateProgress(
    submissionId,
    question.id || questionId,
    {
      language: validation.normalizedLanguage,
      code,
      passedTestCases: passed,
      totalTestCases: results.length,
      lastRunAt: new Date().toISOString(),
      sampleRunResults: results
    },
    0
  );

  res.json({
    success: true,
    data: {
      passedTestCases: passed,
      totalTestCases: results.length,
      results
    }
  });
});

module.exports = {
  startAssessment,
  saveProgress,
  submitAssessment,
  getSubmission,
  getStudentSubmissions,
  addViolation,
  getAssessmentResults,
  executeCode,
  runCodingQuestion,
  gradeSubmission,
  requestSubmissionRevision,
  recordSubmissionPlagiarism,
  overrideSubmissionGrade,
  getCourseGradebook,
  getSubmissionStats
};


