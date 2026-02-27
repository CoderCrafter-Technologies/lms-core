const express = require('express');
const { body, param, query } = require('express-validator');
const instructorController = require('../controllers/instructorController');
const { authenticateToken: authMiddleware } = require('../middleware/auth');
const { roleMiddleware, selfOrRoleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

// Validation schemas
const createInstructorValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('expertise')
    .optional()
    .isString()
    .withMessage('Expertise must be a string')
];

const updateInstructorValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('expertise')
    .optional()
    .isString()
    .withMessage('Expertise must be a string'),
  body('bio')
    .optional()
    .isString()
    .withMessage('Bio must be a string'),
  body('qualifications')
    .optional()
    .isArray()
    .withMessage('Qualifications must be an array')
];

const assignToBatchValidation = [
  body('instructorId')
    .isMongoId()
    .withMessage('Valid instructor ID is required'),
  body('batchId')
    .isMongoId()
    .withMessage('Valid batch ID is required')
];

// Parameter validation
const mongoIdValidation = param('id').isMongoId().withMessage('Valid ID is required');
const batchIdValidation = param('batchId').isMongoId().withMessage('Valid batch ID is required');

// Query validation
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term cannot be empty'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
];

const classStatusValidation = [
  query('status').optional().isIn(['upcoming', 'completed', 'ongoing']).withMessage('Status must be upcoming, completed or ongoing')
];

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Instructor-specific routes (for logged-in instructors accessing their own data)

/**
 * @route   GET /api/instructors/my-batches
 * @desc    Get current instructor's batches
 * @access  Instructor
 */
router.get('/my-batches',
  roleMiddleware(['instructor']),
  instructorController.getMyBatches
);

/**
 * @route   GET /api/instructors/my-batches
 * @desc    Get current instructor's batches
 * @access  Instructor
 */
router.get('/my-enrollments',
  roleMiddleware(['instructor']),
  instructorController.getMyEnrollments 
);

/**
 * @route   GET /api/instructors/my-courses
 * @desc    Get current instructor's courses
 * @access  Instructor
 */
router.get('/my-courses',
  roleMiddleware(['instructor']),
  instructorController.getInstructorCourses
);

/**
 * @route   GET /api/instructors/my-classes
 * @desc    Get current instructor's live classes
 * @access  Instructor
 */
router.get('/my-classes',
  roleMiddleware(['instructor']),
  instructorController.getMyClasses
);

/**
 * @route   GET /api/instructors/dashboard
 * @desc    Get instructor dashboard data
 * @access  Instructor
 */
router.get('/dashboard',
  roleMiddleware(['instructor']),
  instructorController.getInstructorDashboard
);

/**
 * @route   GET /api/instructor/batches/:id/details
 * @desc    Get detailed view for one instructor-owned batch
 * @access  Instructor
 */
router.get('/batches/:id/details',
  mongoIdValidation,
  roleMiddleware(['instructor']),
  instructorController.getMyBatchDetails
);

// Admin routes

/**
 * @route   GET /api/instructors
 * @desc    Get all instructors with filtering and pagination
 * @access  Admin
 */
router.get('/', 
  paginationValidation,
  roleMiddleware(['admin']),
  instructorController.getInstructors
);

/**
 * @route   GET /api/instructors/stats
 * @desc    Get instructor statistics
 * @access  Admin
 */
router.get('/stats',
  roleMiddleware(['admin']),
  instructorController.getInstructorStats
);

/**
 * @route   POST /api/instructors
 * @desc    Create new instructor
 * @access  Admin
 */
router.post('/',
  createInstructorValidation,
  roleMiddleware(['admin']),
  instructorController.createInstructor
);

/**
 * @route   POST /api/instructors/assign-to-batch
 * @desc    Assign instructor to a batch
 * @access  Admin
 */
router.post('/assign-to-batch',
  assignToBatchValidation,
  roleMiddleware(['admin']),
  instructorController.assignToBatch
);

/**
 * @route   DELETE /api/instructors/remove-from-batch/:batchId
 * @desc    Remove instructor from batch
 * @access  Admin
 */
router.delete('/remove-from-batch/:batchId',
  batchIdValidation,
  roleMiddleware(['admin']),
  instructorController.removeFromBatch
);

/**
 * @route   GET /api/instructors/:id
 * @desc    Get single instructor by ID with details
 * @access  Admin/Instructor (own profile)
 */
router.get('/:id',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin'] }),
  instructorController.getInstructor
);

/**
 * @route   PUT /api/instructors/:id
 * @desc    Update instructor information
 * @access  Admin/Instructor (own profile)
 */
router.put('/:id',
  mongoIdValidation,
  updateInstructorValidation,
  roleMiddleware(['admin', 'instructor']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin'] }),
  instructorController.updateInstructor
);

/**
 * @route   DELETE /api/instructors/:id
 * @desc    Delete/deactivate instructor
 * @access  Admin
 */
router.delete('/:id',
  mongoIdValidation,
  roleMiddleware(['admin']),
  instructorController.deleteInstructor
);

/**
 * @route   GET /api/instructors/:id/classes
 * @desc    Get instructor classes
 * @access  Admin/Instructor (own classes)
 */
router.get('/:id/classes',
  mongoIdValidation,
  classStatusValidation,
  roleMiddleware(['admin', 'instructor']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin'] }),
  instructorController.getInstructorClasses
);

/**
 * @route   GET /api/instructors/:id/batches
 * @desc    Get instructor batches
 * @access  Admin/Instructor (own batches)
 */
router.get('/:id/batches',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin'] }),
  instructorController.getInstructorBatches
);

/**
 * @route   POST /api/instructors/:id/reset-password
 * @desc    Reset instructor password
 * @access  Admin
 */
router.post('/:id/reset-password',
  mongoIdValidation,
  roleMiddleware(['admin']),
  instructorController.resetInstructorPassword
);

/**
 * @route   PATCH /api/instructors/:id/toggle-status
 * @desc    Toggle instructor active/inactive status
 * @access  Admin
 */
router.patch('/:id/toggle-status',
  mongoIdValidation,
  roleMiddleware(['admin']),
  instructorController.toggleInstructorStatus
);

module.exports = router;
