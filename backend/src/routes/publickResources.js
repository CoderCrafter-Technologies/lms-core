const express = require('express');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { body, param, query } = require('express-validator');
const {
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  downloadResource,
  getResourcesByCourse,
  getResourcesByBatch,
  getResourceForPreview,
  streamResourceForPreview,
  getResourceStats,
  archiveResource,
  upload,
  getPublicResource,
  previewPublicResource,
  downloadPublicResource,
  getAllPublicResources
} = require('../controllers/resourceController');

const router = express.Router();

// Validation middlewares
const mongoIdValidation = param('id').isMongoId().withMessage('Valid resource ID is required');
const courseIdValidation = param('courseId').isMongoId().withMessage('Valid course ID is required');
const batchIdValidation = param('batchId').isMongoId().withMessage('Valid batch ID is required');

const createResourceValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('resourceLevel').isIn(['COURSE', 'BATCH', 'CLASS', 'course', 'batch', 'class']).withMessage('Valid resource level is required'),
  body('accessLevel').optional().isIn(['PUBLIC', 'ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY']).withMessage('Valid access level is required'),
  body('courseId').optional().isMongoId().withMessage('Valid course ID is required'),
  body('batchId').optional().isMongoId().withMessage('Valid batch ID is required'),
  body('liveClassId').optional().isMongoId().withMessage('Valid live class ID is required'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('expiresAt').optional().isISO8601().withMessage('Valid expiry date is required')
];

const updateResourceValidation = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('accessLevel').optional().isIn(['PUBLIC', 'ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY']).withMessage('Valid access level is required'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('expiresAt').optional().isISO8601().withMessage('Valid expiry date is required')
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('resourceType').optional().isIn(['PDF', 'VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT', 'PRESENTATION', 'SPREADSHEET', 'ARCHIVE', 'OTHER']).withMessage('Invalid resource type'),
  query('level').optional().isIn(['course', 'batch', 'class']).withMessage('Invalid resource level'),
  query('courseId').optional().isMongoId().withMessage('Valid course ID is required'),
  query('batchId').optional().isMongoId().withMessage('Valid batch ID is required')
];


// Add this route before the protected routes
router.get('/', getAllPublicResources);
router.get('/:id', mongoIdValidation, getPublicResource);
router.get('/:id/preview', mongoIdValidation, previewPublicResource);
router.get('/:id/download', mongoIdValidation, mongoIdValidation, downloadPublicResource)


module.exports = router;