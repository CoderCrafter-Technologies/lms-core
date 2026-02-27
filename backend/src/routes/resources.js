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
  downloadPublicResource
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

// Resource routes
router.get('/', queryValidation, roleMiddleware(['admin', 'instructor', 'student']), getResources);
router.get('/stats', roleMiddleware(['admin', 'instructor']), getResourceStats);

// Course and batch specific routes
router.get('/course/:courseId', courseIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getResourcesByCourse);
router.get('/batch/:batchId', batchIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getResourcesByBatch);

// Individual resource routes
router.get('/:id', mongoIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getResource);
router.get('/:id/download', mongoIdValidation, roleMiddleware(['admin', 'instructor', 'student']), downloadResource);

// Add this route before the protected routes
router.get('/public/:id', mongoIdValidation, getPublicResource);
router.get('/public/:id/preview', mongoIdValidation, previewPublicResource);
router.get('/public/:id/download', mongoIdValidation, mongoIdValidation, downloadPublicResource)

// Preview routes
router.get('/:id/preview', mongoIdValidation, roleMiddleware(['admin', 'instructor', 'student']), getResourceForPreview);
router.get('/:id/stream', mongoIdValidation, roleMiddleware(['admin', 'instructor', 'student']), streamResourceForPreview);

// Resource management routes (Admin and Instructor only)
router.post('/', upload.single('file'), createResourceValidation, roleMiddleware(['admin', 'instructor']), createResource);
router.put('/:id', mongoIdValidation, updateResourceValidation, roleMiddleware(['admin', 'instructor']), updateResource);
router.delete('/:id', mongoIdValidation, roleMiddleware(['admin', 'instructor']), deleteResource);
router.patch('/:id/archive', mongoIdValidation, roleMiddleware(['admin', 'instructor']), archiveResource);

module.exports = router;