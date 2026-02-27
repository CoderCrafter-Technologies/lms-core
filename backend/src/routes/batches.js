const express = require('express');
const { body, param, query } = require('express-validator');
const batchController = require('../controllers/batchController');
const { roleMiddleware, batchEnrollmentMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

// Validation schemas
const createBatchValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Batch name is required')
    .isLength({ min: 3, max: 150 })
    .withMessage('Batch name must be between 3 and 150 characters'),
  body('courseId')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  body('instructorId')
    .isMongoId()
    .withMessage('Valid instructor ID is required'),
  body('startDate')
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('maxStudents')
    .isInt({ min: 1, max: 500 })
    .withMessage('Max students must be between 1 and 500'),
  body('schedule.days')
    .isArray({ min: 1 })
    .withMessage('At least one schedule day is required'),
  body('schedule.startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time is required (HH:MM format)'),
  body('schedule.endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time is required (HH:MM format)')
];

const updateBatchValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 150 })
    .withMessage('Batch name must be between 3 and 150 characters'),
  body('instructorId')
    .optional()
    .isMongoId()
    .withMessage('Valid instructor ID is required'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  body('maxStudents')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('Max students must be between 1 and 500'),
  body('schedule.startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time is required (HH:MM format)'),
  body('schedule.endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time is required (HH:MM format)')
];

const scheduleClassValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Class title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Class title must be between 3 and 200 characters'),
  body('scheduledStartTime')
    .isISO8601()
    .withMessage('Valid scheduled start time is required'),
  body('scheduledEndTime')
    .isISO8601()
    .withMessage('Valid scheduled end time is required'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
];

const autoGenerateClassesValidation = [
  body('sessionDuration')
    .optional()
    .isInt({ min: 15, max: 480 })
    .withMessage('Session duration must be between 15 and 480 minutes'),
  body('totalSessions')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('Total sessions must be between 1 and 200')
];

// Parameter validation
const mongoIdValidation = param('id').isMongoId().withMessage('Valid ID is required');
const classIdValidation = param('classId').isMongoId().withMessage('Valid class ID is required');
const courseIdValidation = param('courseId').isMongoId().withMessage('Valid course ID is required');

// Query validation
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('courseId').optional().isMongoId().withMessage('Valid course ID is required'),
  query('status').optional().isIn(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  query('instructorId').optional().isMongoId().withMessage('Valid instructor ID is required')
];

// Routes

/**
 * @route   GET /api/batches
 * @desc    Get all batches with filtering and pagination
 * @access  Admin/Instructor
 */
router.get('/', 
  paginationValidation,
  roleMiddleware(['admin', 'instructor']),
  batchController.getBatches
);

/**
 * @route   GET /api/batches/stats
 * @desc    Get batch statistics
 * @access  Admin
 */
router.get('/stats',
  roleMiddleware(['admin']),
  batchController.getBatchStats
);

/**
 * @route   POST /api/batches
 * @desc    Create new batch
 * @access  Admin
 */
router.post('/',
  createBatchValidation,
  roleMiddleware(['admin']),
  batchController.createBatch
);

/**
 * @route   GET /api/batches/:id
 * @desc    Get single batch by ID
 * @access  Admin/Instructor/Student (enrolled students only)
 */
router.get('/:id',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor', 'student']),
  batchEnrollmentMiddleware('id'),
  batchController.getBatch
);

/**
 * @route   PUT /api/batches/:id
 * @desc    Update batch
 * @access  Admin
 */
router.put('/:id',
  mongoIdValidation,
  updateBatchValidation,
  roleMiddleware(['admin']),
  batchController.updateBatch
);

/**
 * @route   DELETE /api/batches/:id
 * @desc    Delete batch
 * @access  Admin
 */
router.delete('/:id',
  mongoIdValidation,
  roleMiddleware(['admin']),
  batchController.deleteBatch
);

/**
 * @route   GET /api/batches/course/:courseId
 * @desc    Get batches by course
 * @access  Admin/Instructor
 */
router.get('/course/:courseId',
  courseIdValidation,
  roleMiddleware(['admin', 'instructor']),
  batchController.getBatchesByCourse
);


/**
 * @route   GET /api/batches/course/:courseId
 * @desc    Get batches by course
 * @access  Admin/Instructor
 */
router.get('/mybatches/:courseId',
  courseIdValidation,
  roleMiddleware(['student']),
  batchController.getBatchesByCourseForStudents
);

/**
 * @route   GET /api/batches/:id/classes
 * @desc    Get all classes for a specific batch
 * @access  Admin/Instructor/Student (enrolled students only)
 */
router.get('/:id/classes',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor', 'student']),
  batchEnrollmentMiddleware('id'),
  batchController.getBatchClasses
);

/**
 * @route   POST /api/batches/:id/enroll
 * @desc    Enroll student in batch
 * @access  Admin
 */
router.post('/:id/enroll',
  mongoIdValidation,
  body('studentId').isMongoId().withMessage('Valid student ID is required'),
  roleMiddleware(['admin']),
  batchController.enrollStudent
);

// Class scheduling routes

/**
 * @route   GET /api/batches/:id/classes
 * @desc    Get scheduled classes for a batch
 * @access  Admin/Instructor/Student (enrolled students only)
 */
router.get('/:id/classes',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor', 'student']),
  batchEnrollmentMiddleware('id'),
  batchController.getBatchClasses
);

/**
 * @route   POST /api/batches/:id/classes
 * @desc    Schedule a new class for a batch
 * @access  Admin/Instructor
 */
router.post('/:id/classes',
  mongoIdValidation,
  scheduleClassValidation,
  roleMiddleware(['admin', 'instructor']),
  batchController.scheduleClass
);

/**
 * @route   PUT /api/batches/:id/classes/:classId
 * @desc    Update a scheduled class
 * @access  Admin/Instructor
 */
router.put('/:id/classes/:classId',
  mongoIdValidation,
  classIdValidation,
  scheduleClassValidation,
  roleMiddleware(['admin', 'instructor']),
  batchController.updateScheduledClass
);

/**
 * @route   DELETE /api/batches/:id/classes/:classId
 * @desc    Delete a scheduled class
 * @access  Admin/Instructor
 */
router.delete('/:id/classes/:classId',
  mongoIdValidation,
  classIdValidation,
  roleMiddleware(['admin', 'instructor']),
  batchController.deleteScheduledClass
);

/**
 * @route   POST /api/batches/:id/classes/:classId/cancel
 * @desc    Cancel a scheduled class
 * @access  Admin/Instructor
 */
router.post('/:id/classes/:classId/cancel',
  mongoIdValidation,
  classIdValidation,
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  roleMiddleware(['admin', 'instructor']),
  batchController.cancelScheduledClass
);

/**
 * @route   POST /api/batches/:id/classes/auto-generate
 * @desc    Auto-generate classes for a batch based on schedule
 * @access  Admin
 */
router.post('/:id/classes/auto-generate',
  mongoIdValidation,
  autoGenerateClassesValidation,
  roleMiddleware(['admin']),
  batchController.autoGenerateClasses
);

module.exports = router;
