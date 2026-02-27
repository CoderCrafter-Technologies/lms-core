const express = require('express');
const rateLimit = require('express-rate-limit');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const {
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
} = require('../controllers/assessmentController');

const {
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
  getSubmissionStats,
  requestSubmissionRevision,
  recordSubmissionPlagiarism,
  overrideSubmissionGrade,
  getCourseGradebook
} = require('../controllers/assessmentSubmissionController');

const { body, param, query } = require('express-validator');
const router = express.Router();

const assessmentCodeExecuteLimiter = rateLimit({
  windowMs: Number(process.env.ASSESSMENT_CODE_EXEC_WINDOW_MS || 60 * 1000),
  max: Number(process.env.ASSESSMENT_CODE_EXEC_MAX_REQUESTS || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many code execution requests. Please try again shortly.'
  }
});

const assessmentQuestionRunLimiter = rateLimit({
  windowMs: Number(process.env.ASSESSMENT_QUESTION_RUN_WINDOW_MS || 60 * 1000),
  max: Number(process.env.ASSESSMENT_QUESTION_RUN_MAX_REQUESTS || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many code run attempts. Please slow down.'
  }
});

// Validation middlewares
const mongoIdValidation = param('id').isMongoId().withMessage('Valid ID is required');
const courseIdValidation = param('courseId').isMongoId().withMessage('Valid course ID is required');
const submissionIdValidation = param('submissionId').isMongoId().withMessage('Valid submission ID is required');

const createAssessmentValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('instructions.general').optional().isLength({ max: 3000 }).withMessage('General instructions must be less than 3000 characters'),
  body('instructions.additional').optional().isLength({ max: 3000 }).withMessage('Additional instructions must be less than 3000 characters'),
  body('type').isIn(['quiz', 'exam', 'assignment', 'practice']).withMessage('Valid assessment type is required'),
  body('courseId').isMongoId().withMessage('Valid course ID is required'),
  body('batchId').optional().isMongoId().withMessage('Valid batch ID required'),
  body('sections').optional().isArray().withMessage('Sections must be an array'),
  body('sections.*.type').optional().isIn(['theory', 'mcq', 'coding']).withMessage('Section type must be theory, mcq, or coding'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questions.*.type').isIn(['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-blank', 'coding']).withMessage('Valid question type is required'),
  body('questions.*.question').trim().isLength({ min: 1 }).withMessage('Question text is required'),
  body('questions.*.points').isNumeric().withMessage('Question points must be a number'),
  body('questions.*.coding.allowedLanguages').optional().isArray().withMessage('Coding languages must be an array'),
  body('questions.*.coding.testCases').optional().isArray().withMessage('Coding test cases must be an array')
];

const updateAssessmentValidation = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('instructions.general').optional().isLength({ max: 3000 }).withMessage('General instructions must be less than 3000 characters'),
  body('instructions.additional').optional().isLength({ max: 3000 }).withMessage('Additional instructions must be less than 3000 characters'),
  body('type').optional().isIn(['quiz', 'exam', 'assignment', 'practice']).withMessage('Valid assessment type is required'),
];

const saveProgressValidation = [
  body('questionId').trim().isLength({ min: 1 }).withMessage('Question ID is required'),
  body('answer').exists().withMessage('Answer is required'),
  body('timeSpent').optional().isNumeric().withMessage('Time spent must be a number'),
];

const submitAssessmentValidation = [
  body('answers').isArray().withMessage('Answers must be an array'),
  body('answers.*.questionId').trim().isLength({ min: 1 }).withMessage('Question ID is required'),
  body('answers.*.answer').exists().withMessage('Answer is required'),
];

// Assessment routes
router.get('/', roleMiddleware(['admin', 'manager', 'instructor', 'student']), getAssessments);
router.get('/available', roleMiddleware(['student']), getAvailableAssessments);
router.get('/course/:courseId', courseIdValidation, roleMiddleware(['admin', 'manager', 'instructor', 'student']), getAssessmentsByCourse);
router.get('/course/:courseId/available/:batchId?', courseIdValidation, roleMiddleware(['student']), getAvailableAssessments);
router.post('/code/execute', assessmentCodeExecuteLimiter, roleMiddleware(['admin', 'manager', 'instructor', 'student']), executeCode);

router.get('/:id', mongoIdValidation, roleMiddleware(['admin', 'manager', 'instructor', 'student']), getAssessment);
router.get('/:id/stats', mongoIdValidation, roleMiddleware(['admin', 'manager', 'instructor']), getAssessmentStats);
router.get('/:id/submissions', mongoIdValidation, roleMiddleware(['admin', 'manager', 'instructor']), getAssessmentSubmissions);
router.get('/:id/export', mongoIdValidation, roleMiddleware(['admin', 'manager', 'instructor']), exportAssessment);

router.post('/', createAssessmentValidation, roleMiddleware(['admin', 'instructor']), createAssessment);
router.put('/:id', mongoIdValidation, updateAssessmentValidation, roleMiddleware(['admin', 'instructor']), updateAssessment);
router.delete('/:id', mongoIdValidation, roleMiddleware(['admin', 'instructor']), deleteAssessment);

router.patch('/:id/publish', mongoIdValidation, roleMiddleware(['admin', 'instructor']), publishAssessment);
router.post('/:id/duplicate', mongoIdValidation, roleMiddleware(['admin', 'instructor']), duplicateAssessment);

// Assessment submission routes
router.post('/:id/start', mongoIdValidation, roleMiddleware(['student']), startAssessment);
router.get('/:id/results', mongoIdValidation, roleMiddleware(['student']), getAssessmentResults);

// Submission management routes
router.get('/submissions/student/:studentId?', roleMiddleware(['admin', 'manager', 'instructor', 'student']), getStudentSubmissions);
router.get('/submissions/:submissionId', submissionIdValidation, roleMiddleware(['admin', 'manager', 'instructor', 'student']), getSubmission);
router.get('/:id/submission-stats', mongoIdValidation, roleMiddleware(['admin', 'manager', 'instructor']), getSubmissionStats);
router.get('/gradebook/course/:courseId', courseIdValidation, roleMiddleware(['admin', 'manager', 'instructor']), getCourseGradebook);

router.patch('/submissions/:submissionId/progress', submissionIdValidation, saveProgressValidation, roleMiddleware(['student']), saveProgress);
router.post('/submissions/:submissionId/questions/:questionId/run', assessmentQuestionRunLimiter, submissionIdValidation, roleMiddleware(['student']), runCodingQuestion);
router.post('/submissions/:submissionId/submit', submissionIdValidation, submitAssessmentValidation, roleMiddleware(['student']), submitAssessment);
router.post('/submissions/:submissionId/violation', submissionIdValidation, roleMiddleware(['student']), addViolation);
router.patch('/submissions/:submissionId/grade', submissionIdValidation, roleMiddleware(['admin', 'instructor']), gradeSubmission);
router.patch('/submissions/:submissionId/revision', submissionIdValidation, roleMiddleware(['admin', 'instructor']), requestSubmissionRevision);
router.patch('/submissions/:submissionId/plagiarism', submissionIdValidation, roleMiddleware(['admin', 'instructor']), recordSubmissionPlagiarism);
router.patch('/submissions/:submissionId/override', submissionIdValidation, roleMiddleware(['admin', 'instructor']), overrideSubmissionGrade);

module.exports = router;
