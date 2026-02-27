const express = require('express');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { 
  getLiveClassesByBatch, 
  getLiveClasses, 
  getLiveClass,
  createLiveClass,
  updateLiveClass,
  deleteLiveClass,
  startLiveClass,
  endLiveClass,
  cancelLiveClass,
  getLiveClassStats,
  getLiveClassByRoomId,
  getLiveClassesByFilter
} = require('../controllers/liveClassController');
const {
  getClassAttendanceReport,
  getRecentAttendanceStats,
  getAttendanceAnalyticsReport,
  rebaselineHistoricalAttendanceReport
} = require('../controllers/liveClassAnalyticsController');
const { body, param, query } = require('express-validator');
const router = express.Router();

// Validation middlewares
const mongoIdValidation = param('id').isMongoId().withMessage('Valid ID is required');
const batchIdValidation = param('batchId').isMongoId().withMessage('Valid batch ID is required');
const roomIdValidation = param('roomId').isString().trim().isLength({ min: 3 }).withMessage('Valid room ID is required');

const createLiveClassValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('batchId').isMongoId().withMessage('Valid batch ID is required'),
  body('scheduledStartTime').isISO8601().withMessage('Valid start time is required'),
  body('scheduledEndTime').isISO8601().withMessage('Valid end time is required'),
  body('instructorId').optional().isMongoId().withMessage('Valid instructor ID required'),
];

const attendanceAnalyticsValidation = [
  query('view').optional().isIn(['class', 'week', 'month']),
  query('batchId').optional().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 500 })
];

const attendanceRecentValidation = [
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('batchId').optional().isMongoId()
];

const attendanceClassValidation = [
  param('classId').isMongoId().withMessage('Valid class ID is required'),
  query('status').optional().isIn(['ALL', 'PRESENT', 'LEFT_EARLY', 'ABSENT', 'LATE_JOINER', 'LATE_JOINER_LEFT_EARLY']),
  query('minPercent').optional().isInt({ min: 0, max: 100 }),
  query('maxPercent').optional().isInt({ min: 0, max: 100 }),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 })
];

const attendanceRebaselineValidation = [
  body('batchId').optional().isMongoId(),
  body('dryRun').optional().isBoolean(),
  body('limit').optional().isInt({ min: 1, max: 2000 })
];

// Routes
router.get('/', roleMiddleware(['admin', 'instructor', 'manager']), getLiveClasses);
router.get('/filtered-classes', roleMiddleware(['admin', 'manager']), getLiveClassesByFilter);
router.get('/stats', roleMiddleware(['admin', 'manager']), getLiveClassStats);
router.get('/attendance/recent', attendanceRecentValidation, roleMiddleware(['admin', 'instructor', 'manager']), getRecentAttendanceStats);
router.get('/attendance/analytics', attendanceAnalyticsValidation, roleMiddleware(['admin', 'instructor', 'manager']), getAttendanceAnalyticsReport);
router.get('/attendance/classes/:classId', attendanceClassValidation, roleMiddleware(['admin', 'instructor', 'manager']), getClassAttendanceReport);
router.post('/attendance/rebaseline-historical', attendanceRebaselineValidation, roleMiddleware(['admin', 'manager']), rebaselineHistoricalAttendanceReport);
router.get('/batch/:batchId', batchIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getLiveClassesByBatch);
router.get('/room/:roomId', roomIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getLiveClassByRoomId);
router.get('/:id', mongoIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getLiveClass);

router.post('/', createLiveClassValidation, roleMiddleware(['admin', 'instructor']), createLiveClass);
router.put('/:id', mongoIdValidation, roleMiddleware(['admin', 'instructor']), updateLiveClass);
router.delete('/:id', mongoIdValidation, roleMiddleware(['admin', 'instructor']), deleteLiveClass);

router.patch('/:id/start', mongoIdValidation, roleMiddleware(['admin', 'instructor']), startLiveClass);
router.patch('/:id/end', mongoIdValidation, roleMiddleware(['admin', 'instructor']), endLiveClass);
router.patch('/:id/cancel', mongoIdValidation, roleMiddleware(['admin', 'instructor']), cancelLiveClass);

module.exports = router;
