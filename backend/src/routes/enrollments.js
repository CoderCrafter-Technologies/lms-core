const express = require('express');
const { body, param, query } = require('express-validator');
const enrollmentController = require('../controllers/entrollmentsController');
const { roleMiddleware, enrollmentSelfOrRoleMiddleware } = require('../middleware/roleMiddleware');
const studentDataAccessMiddleware = require('../middleware/studentDataAccessMiddleware');

const router = express.Router();

// Validation schemas
const createEnrollmentValidation = [
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required'),
  body('courseId')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('batchId')
    .isMongoId()
    .withMessage('Valid batch ID is required'),
  body('status')
    .optional()
    .isIn(['ENROLLED', 'COMPLETED', 'DROPPED', 'SUSPENDED'])
    .withMessage('Invalid enrollment status'),
  body('payment.status')
    .optional()
    .isIn(['PENDING', 'PAID', 'OVERDUE', 'WAIVED'])
    .withMessage('Invalid payment status'),
  body('payment.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Payment amount must be a positive number')
];

const updateEnrollmentValidation = [
  body('status')
    .optional()
    .isIn(['ENROLLED', 'COMPLETED', 'DROPPED', 'SUSPENDED'])
    .withMessage('Invalid enrollment status'),
  body('payment.status')
    .optional()
    .isIn(['PENDING', 'PAID', 'OVERDUE', 'WAIVED'])
    .withMessage('Invalid payment status'),
  body('payment.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Payment amount must be a positive number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notes cannot exceed 2000 characters')
];

const progressValidation = [
  body('completedClasses')
    .isInt({ min: 0 })
    .withMessage('Completed classes must be a positive integer'),
  body('totalClasses')
    .isInt({ min: 0 })
    .withMessage('Total classes must be a positive integer')
];

const attendanceValidation = [
  body('attendedClasses')
    .isInt({ min: 0 })
    .withMessage('Attended classes must be a positive integer'),
  body('totalClasses')
    .isInt({ min: 0 })
    .withMessage('Total classes must be a positive integer')
];

const gradeValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Assignment title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('score')
    .isFloat({ min: 0 })
    .withMessage('Score must be a positive number'),
  body('maxScore')
    .isFloat({ min: 0 })
    .withMessage('Max score must be a positive number')
];

const certificateValidation = [
  body('certificateUrl')
    .trim()
    .notEmpty()
    .withMessage('Certificate URL is required')
    .isURL()
    .withMessage('Valid certificate URL is required')
];

const paymentValidation = [
  body('status')
    .isIn(['PENDING', 'PAID', 'OVERDUE', 'WAIVED'])
    .withMessage('Invalid payment status'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Payment amount must be a positive number'),
  body('transactionId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Transaction ID cannot exceed 100 characters')
];

// Parameter validation
const mongoIdValidation = param('id').isMongoId().withMessage('Valid ID is required');
const studentIdValidation = param('studentId').isMongoId().withMessage('Valid student ID is required');
const courseIdValidation = param('courseId').isMongoId().withMessage('Valid course ID is required');
const batchIdValidation = param('batchId').isMongoId().withMessage('Valid batch ID is required');

// Query validation
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['ENROLLED', 'COMPLETED', 'DROPPED', 'SUSPENDED']).withMessage('Invalid status'),
  query('paymentStatus').optional().isIn(['PENDING', 'PAID', 'OVERDUE', 'WAIVED']).withMessage('Invalid payment status'),
  query('sortBy').optional().isIn(['enrollmentDate', 'completedAt', 'status']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order')
];

// Routes

/**
 * @route   GET /api/enrollments
 * @desc    Get all enrollments with filtering and pagination
 * @access  Admin
 */
router.get('/', 
  paginationValidation,
  roleMiddleware(['admin']),
  enrollmentController.getAllEnrollments
);

/**
 * @route   GET /api/enrollments
 * @desc    Get all enrollments with filtering and pagination
 * @access  Admin
 */
router.get('/myenrollments',
  paginationValidation,
  roleMiddleware(['student']),
  enrollmentController.getMyEnrollments
);

/**
 * @route   POST /api/enrollments
 * @desc    Create new enrollment
 * @access  Admin
 */
router.post('/',
  createEnrollmentValidation,
  roleMiddleware(['admin']),
  enrollmentController.createEnrollment
);

/**
 * @route   POST /api/enrollments/self-enroll
 * @desc    Student self-enrollment
 * @access  Student
 */
router.post('/self-enroll',
  [
    body('courseId')
      .isMongoId()
      .withMessage('Valid course ID is required'),
    body('batchId')
      .isMongoId()
      .withMessage('Valid batch ID is required')
  ],
  roleMiddleware(['student']),
  enrollmentController.selfEnroll
);

/**
 * @route   GET /api/enrollments/:id
 * @desc    Get single enrollment by ID
 * @access  Admin
 */
router.get('/:id',
  mongoIdValidation,
  roleMiddleware(['admin', 'student']),
  enrollmentSelfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin'] }),
  enrollmentController.getEnrollment
);

/**
 * @route   PUT /api/enrollments/:id
 * @desc    Update enrollment
 * @access  Admin
 */
router.put('/:id',
  mongoIdValidation,
  updateEnrollmentValidation,
  roleMiddleware(['admin']),
  enrollmentController.updateEnrollment
);

/**
 * @route   DELETE /api/enrollments/:id
 * @desc    Delete enrollment
 * @access  Admin
 */
router.delete('/:id',
  mongoIdValidation,
  roleMiddleware(['admin']),
  enrollmentController.deleteEnrollment
);

/**
 * @route   GET /api/enrollments/student/:studentId
 * @desc    Get enrollments by student
 * @access  Admin/Instructor (for their students)
 */
router.get('/student/:studentId',
  studentIdValidation,
  roleMiddleware(['admin', 'instructor', 'student']),
  studentDataAccessMiddleware(),
  enrollmentController.getEnrollmentsByStudent
);

/**
 * @route   GET /api/enrollments/course/:courseId
 * @desc    Get enrollments by course
 * @access  Admin/Instructor (for their courses)
 */
router.get('/course/:courseId',
  courseIdValidation,
  roleMiddleware(['admin', 'instructor']),
  enrollmentController.getEnrollmentsByCourse
);

/**
 * @route   GET /api/enrollments/batch/:batchId
 * @desc    Get enrollments by batch
 * @access  Admin/Instructor (for their batches)
 */
router.get('/batch/:batchId',
  batchIdValidation,
  roleMiddleware(['admin', 'instructor']),
  enrollmentController.getEnrollmentsByBatch
);

/**
 * @route   PUT /api/enrollments/:id/progress
 * @desc    Update enrollment progress
 * @access  Admin/Instructor
 */
router.put('/:id/progress',
  mongoIdValidation,
  progressValidation,
  roleMiddleware(['admin', 'instructor']),
  enrollmentController.updateEnrollmentProgress
);

/**
 * @route   PUT /api/enrollments/:id/attendance
 * @desc    Update enrollment attendance
 * @access  Admin/Instructor
 */
router.put('/:id/attendance',
  mongoIdValidation,
  attendanceValidation,
  roleMiddleware(['admin', 'instructor']),
  enrollmentController.updateEnrollmentAttendance
);

/**
 * @route   POST /api/enrollments/:id/grades
 * @desc    Add grade to enrollment
 * @access  Admin/Instructor
 */
router.post('/:id/grades',
  mongoIdValidation,
  gradeValidation,
  roleMiddleware(['admin', 'instructor']),
  enrollmentController.addEnrollmentGrade
);

/**
 * @route   PUT /api/enrollments/:id/complete
 * @desc    Mark enrollment as completed
 * @access  Admin
 */
router.put('/:id/complete',
  mongoIdValidation,
  roleMiddleware(['admin']),
  enrollmentController.completeEnrollment
);

/**
 * @route   POST /api/enrollments/:id/certificate
 * @desc    Issue certificate for enrollment
 * @access  Admin
 */
router.post('/:id/certificate',
  mongoIdValidation,
  certificateValidation,
  roleMiddleware(['admin']),
  enrollmentController.issueCertificate
);

/**
 * @route   PUT /api/enrollments/:id/payment
 * @desc    Update enrollment payment
 * @access  Admin
 */
router.put('/:id/payment',
  mongoIdValidation,
  paymentValidation,
  roleMiddleware(['admin']),
  enrollmentController.updateEnrollmentPayment
);

module.exports = router;
