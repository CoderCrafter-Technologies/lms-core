const express = require('express');
const { body, param, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const courseController = require('../controllers/courseController');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

const courseUploadPath = path.join(__dirname, '../../uploads/courses');
fs.mkdirSync(courseUploadPath, { recursive: true });

const courseThumbnailStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, courseUploadPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `thumbnail-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const courseThumbnailUpload = multer({
  storage: courseThumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for course thumbnail'));
    }
    cb(null, true);
  }
});

// Validation schemas
const createCourseValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Course title is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Course title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Course description is required')
    .isLength({ min: 10 })
    .withMessage('Course description must be at least 10 characters'),
  body('category')
    .isIn(['PROGRAMMING', 'DATA_SCIENCE', 'DESIGN', 'BUSINESS', 'MARKETING', 'LANGUAGE', 'OTHER'])
    .withMessage('Valid category is required'),
  body('level')
    .isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
    .withMessage('Valid level is required'),
  body('pricing.type')
    .isIn(['FREE', 'PAID', 'SUBSCRIPTION'])
    .withMessage('Valid pricing type is required'),
  body('pricing.amount')
    .optional()
    .isNumeric()
    .withMessage('Pricing amount must be a number')
];

const updateCourseValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Course title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Course description must be at least 10 characters'),
  body('category')
    .optional()
    .isIn(['PROGRAMMING', 'DATA_SCIENCE', 'DESIGN', 'BUSINESS', 'MARKETING', 'LANGUAGE', 'OTHER'])
    .withMessage('Valid category is required'),
  body('level')
    .optional()
    .isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
    .withMessage('Valid level is required')
];

// Parameter validation
const mongoIdValidation = param('id').isMongoId().withMessage('Valid course ID is required');

// Query validation
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search term cannot be empty'),
  query('category').optional().isIn(['PROGRAMMING', 'DATA_SCIENCE', 'DESIGN', 'BUSINESS', 'MARKETING', 'LANGUAGE', 'OTHER']).withMessage('Invalid category'),
  query('level').optional().isIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).withMessage('Invalid level'),
  query('status').optional().isIn(['DRAFT', 'PUBLISHED', 'ARCHIVED']).withMessage('Invalid status')
];

// Routes

/**
 * @route   GET /api/courses
 * @desc    Get all courses with filtering and pagination
 * @access  Public (for published courses) / Admin (for all courses)
 */
router.get('/', 
  paginationValidation,
  courseController.getCourses
);

/**
 * @route   GET /api/courses/stats
 * @desc    Get course statistics
 * @access  Admin
 */
router.get('/stats',
  roleMiddleware(['admin']),
  courseController.getCourseStats
);

/**
 * @route   POST /api/courses
 * @desc    Create new course
 * @access  Admin
 */
router.post('/',
  courseThumbnailUpload.single('thumbnail'),
  createCourseValidation,
  roleMiddleware(['admin']),
  courseController.createCourse
);

/**
 * @route   GET /api/courses/:id
 * @desc    Get single course by ID
 * @access  Public (for published courses) / Admin (for all courses)
 */
router.get('/:id',
  mongoIdValidation,
  courseController.getCourse
);

/**
 * @route   PUT /api/courses/:id
 * @desc    Update course
 * @access  Admin
 */
router.put('/:id',
  courseThumbnailUpload.single('thumbnail'),
  mongoIdValidation,
  updateCourseValidation,
  roleMiddleware(['admin']),
  courseController.updateCourse
);

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete course
 * @access  Admin
 */
router.delete('/:id',
  mongoIdValidation,
  roleMiddleware(['admin']),
  courseController.deleteCourse
);

/**
 * @route   POST /api/courses/:id/publish
 * @desc    Publish course
 * @access  Admin
 */
router.post('/:id/publish',
  mongoIdValidation,
  roleMiddleware(['admin']),
  courseController.publishCourse
);

/**
 * @route   POST /api/courses/:id/submit-review
 * @desc    Submit course for draft-review-approval workflow
 * @access  Admin/Instructor
 */
router.post('/:id/submit-review',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor']),
  courseController.submitCourseForReview
);

/**
 * @route   POST /api/courses/:id/approve
 * @desc    Approve a course under review
 * @access  Admin
 */
router.post('/:id/approve',
  mongoIdValidation,
  roleMiddleware(['admin']),
  courseController.approveCourse
);

/**
 * @route   POST /api/courses/:id/reject
 * @desc    Reject a course under review
 * @access  Admin
 */
router.post('/:id/reject',
  mongoIdValidation,
  roleMiddleware(['admin']),
  courseController.rejectCourse
);

/**
 * @route   GET /api/courses/:id/curriculum/versions
 * @desc    List curriculum versions for a course
 * @access  Admin/Instructor
 */
router.get('/:id/curriculum/versions',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor']),
  courseController.listCurriculumVersions
);

/**
 * @route   POST /api/courses/:id/curriculum/versions
 * @desc    Create a curriculum version snapshot
 * @access  Admin/Instructor
 */
router.post('/:id/curriculum/versions',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor']),
  courseController.createCurriculumVersion
);

/**
 * @route   POST /api/courses/:id/curriculum/versions/:versionNumber/activate
 * @desc    Activate a curriculum version
 * @access  Admin/Instructor
 */
router.post('/:id/curriculum/versions/:versionNumber/activate',
  mongoIdValidation,
  param('versionNumber').isInt({ min: 1 }).withMessage('Valid version number is required'),
  roleMiddleware(['admin', 'instructor']),
  courseController.activateCurriculumVersion
);

/**
 * @route   GET /api/courses/:id/batches
 * @desc    Get batches for a course
 * @access  Admin/Instructor
 */
router.get('/:id/batches',
  mongoIdValidation,
  roleMiddleware(['admin', 'instructor']),
  courseController.getCourseBatches
);

module.exports = router;
