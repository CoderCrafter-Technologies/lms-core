const express = require('express');
const { body, param, query } = require('express-validator');
const studentController = require('../controllers/studentController');
const { authenticateToken: authMiddleware } = require('../middleware/auth');
const { roleMiddleware, selfOrRoleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

// Validation schemas
const createStudentValidation = [
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
    .withMessage('Password must be at least 6 characters long')
];

const updateStudentValidation = [
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
    .withMessage('Valid phone number is required')
];

const enrollStudentValidation = [
  body('studentId')
    .isMongoId()
    .withMessage('Valid student ID is required'),
  body('batchId')
    .isMongoId()
    .withMessage('Valid batch ID is required')
];

const updateProgressValidation = [
  body('completedClasses')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Completed classes must be a non-negative integer'),
  body('totalClasses')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total classes must be a non-negative integer'),
  body('attendedClasses')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Attended classes must be a non-negative integer')
];

// Parameter validation
const mongoIdValidation = param('id').isMongoId().withMessage('Valid ID is required');
const enrollmentIdValidation = param('enrollmentId').isMongoId().withMessage('Valid enrollment ID is required');
const courseIdValidation = param('courseId').isMongoId().withMessage('Valid course ID is required');
const batchIdValidation = param('batchId').isMongoId().withMessage('Valid batch ID is required');

// Query validation
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term cannot be empty'),
  query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  query('batchId').optional().isMongoId().withMessage('Valid batch ID is required'),
  query('courseId').optional().isMongoId().withMessage('Valid course ID is required')
];

// New validation schemas for enrolled courses search
const enrolledCoursesValidation = [
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term cannot be empty'),
  query('status').optional().isIn(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']).withMessage('Invalid enrollment status'),
  query('category').optional().trim().isLength({ min: 1 }).withMessage('Category cannot be empty'),
  query('level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid course level'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
];

const searchCoursesValidation = [
  query('query').optional().trim().isLength({ min: 1 }).withMessage('Search query cannot be empty'),
  query('category').optional().trim().isLength({ min: 1 }).withMessage('Category cannot be empty'),
  query('level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid course level'),
  query('status').optional().isIn(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']).withMessage('Invalid enrollment status'),
  query('progress').optional().isIn(['not-started', 'in-progress', 'completed']).withMessage('Invalid progress filter'),
  query('sortBy').optional().isIn(['title', 'progress', 'enrollmentDate', 'category']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
];

const quickSearchValidation = [
  query('q').trim().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters long')
];

// Apply authentication middleware to all routes
router.use(authMiddleware);

// ============================================================================
// STUDENT-SPECIFIC ROUTES (for logged-in students accessing their own data)
// ============================================================================

// Enrollment and Course Management Routes
/**
 * @route   GET /api/students/my/enrollments
 * @desc    Get current student's enrollments
 * @access  Student
 */
router.get('/my-enrollments',
  roleMiddleware(['student']),
  studentController.getMyEnrollments
);

/**
 * @route   GET /api/students/my/courses
 * @desc    Get enrolled courses for current user with search functionality
 * @access  Student
 */
router.get('/courses',
  enrolledCoursesValidation,
  roleMiddleware(['student']),
  studentController.getMyEnrolledCourses
);

/**
 * @route   GET /api/students/my/courses/search
 * @desc    Search enrolled courses with advanced filtering
 * @access  Student
 */
router.get('/courses/search',
  searchCoursesValidation,
  roleMiddleware(['student']),
  studentController.searchEnrolledCourses
);

/**
 * @route   GET /api/students/my/courses/quick-search
 * @desc    Quick search for enrolled courses (search bar suggestions)
 * @access  Student
 */
router.get('/courses/quick-search',
  quickSearchValidation,
  roleMiddleware(['student']),
  studentController.quickSearchEnrolledCourses
);

/**
 * @route   GET /api/students/my/courses/:courseId
 * @desc    Get detailed information about a specific enrolled course
 * @access  Student
 */
router.get('/courses/:courseId',
  courseIdValidation,
  roleMiddleware(['student']),
  studentController.getEnrolledCourse
);

// Class Schedule Routes
/**
 * @route   GET /api/students/my/upcoming-classes
 * @desc    Get upcoming live classes for current student
 * @access  Student
 */
router.get('/upcoming-classes',
  roleMiddleware(['student']),
  studentController.getUpcomingClasses
);

/**
 * @route   GET /api/students/my/past-classes
 * @desc    Get past classes for current student
 * @access  Student
 */
router.get('/past-classes',
  roleMiddleware(['student']),
  studentController.getPastClasses
);

/**
 * @route   GET /api/students/my/live-classes
 * @desc    Get currently live classes for current student
 * @access  Student
 */
router.get('/live-classes',
  roleMiddleware(['student']),
  studentController.getLiveClasses
);

// Dashboard and Resources Routes
/**
 * @route   GET /api/students/my/dashboard
 * @desc    Get student dashboard data
 * @access  Student
 */
router.get('/dashboard',
  roleMiddleware(['student']),
  studentController.getStudentDashboard
);

/**
 * @route   GET /api/students/my/batch/:batchId/resources
 * @desc    Get course resources for enrolled batch
 * @access  Student
 */
router.get('/batch/:batchId/resources',
  batchIdValidation,
  roleMiddleware(['student']),
  studentController.getCourseResources
);

// ============================================================================
// ADMIN/INSTRUCTOR ROUTES (for managing students)
// ============================================================================

// Student Management Routes
/**
 * @route   GET /api/students
 * @desc    Get all students with filtering and pagination
 * @access  Admin/Instructor
 */
router.get('/', 
  paginationValidation,
  roleMiddleware(['admin', 'instructor']),
  studentController.getStudents
);

/**
 * @route   GET /api/students/stats
 * @desc    Get student statistics
 * @access  Admin
 */
router.get('/stats',
  roleMiddleware(['admin']),
  studentController.getStudentStats
);

/**
 * @route   POST /api/students
 * @desc    Create new student
 * @access  Admin
 */
router.post('/',
  createStudentValidation,
  roleMiddleware(['admin']),
  studentController.createStudent
);

// Enrollment Management Routes (Admin)
/**
 * @route   POST /api/students/enroll
 * @desc    Enroll student in a batch
 * @access  Admin
 */
router.post('/enroll',
  enrollStudentValidation,
  roleMiddleware(['admin']),
  studentController.enrollStudent
);

/**
 * @route   POST /api/students/unenroll
 * @desc    Remove student from batch
 * @access  Admin
 */
router.post('/unenroll',
  enrollStudentValidation,
  roleMiddleware(['admin']),
  studentController.unenrollStudent
);

// Individual Student Routes
/**
 * @route   GET /api/students/:id
 * @desc    Get single student by ID
 * @access  Admin/Instructor/Student (own profile)
 */
router.get('/:id',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor', 'student']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin', 'instructor'] }),
  studentController.getStudent
);

/**
 * @route   PUT /api/students/:id
 * @desc    Update student information
 * @access  Admin/Student (own profile)
 */
router.put('/:id',
  mongoIdValidation,
  updateStudentValidation,
  roleMiddleware(['admin', 'student']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin'] }),
  studentController.updateStudent
);

/**
 * @route   PATCH /api/students/:id/status
 * @desc    Update student active status
 * @access  Admin
 */
router.patch('/:id/status',
  mongoIdValidation,
  roleMiddleware(['admin']),
  studentController.updateStudentStatus
);

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete/deactivate student
 * @access  Admin
 */
router.delete('/:id',
  mongoIdValidation,
  roleMiddleware(['admin']),
  studentController.deleteStudent
);

// Student Enrollment Routes (Admin/Instructor)
/**
 * @route   GET /api/students/:id/enrollments
 * @desc    Get student enrollments
 * @access  Admin/Instructor/Student (own enrollments)
 */
router.get('/:id/enrollments',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor', 'student']),
  selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin', 'instructor'] }),
  studentController.getStudentEnrollments
);

/**
 * @route   POST /api/students/:id/reset-password
 * @desc    Reset student password
 * @access  Admin
 */
router.post('/:id/reset-password',
  mongoIdValidation,
  roleMiddleware(['admin']),
  studentController.resetStudentPassword
);

// Progress and Analytics Routes
/**
 * @route   PUT /api/students/enrollments/:enrollmentId/progress
 * @desc    Update student progress
 * @access  Admin/Instructor
 */
router.put('/enrollments/:enrollmentId/progress',
  enrollmentIdValidation,
  updateProgressValidation,
  roleMiddleware(['admin', 'instructor']),
  studentController.updateStudentProgress
);

// Batch and Course Student Lists
/**
 * @route   GET /api/students/batch/:batchId
 * @desc    Get students by batch
 * @access  Admin/Instructor
 */
router.get('/batch/:batchId',
  batchIdValidation,
  roleMiddleware(['admin', 'instructor']),
  studentController.getStudentsByBatch
);

/**
 * @route   GET /api/students/course/:courseId
 * @desc    Get students by course
 * @access  Admin/Instructor
 */
router.get('/course/:courseId',
  courseIdValidation,
  roleMiddleware(['admin', 'instructor']),
  studentController.getStudentsByCourse
);

module.exports = router;
