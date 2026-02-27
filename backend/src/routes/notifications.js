const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const NotificationRepository = require('../repositories/NotificationRepository');
const notificationService = require('../services/notificationService');
const notificationDigestService = require('../services/notificationDigestService');
const { requirePermission } = require('../middleware/auth');
const { userRepository, enrollmentRepository, courseRepository, batchRepository } = require('../repositories');
const { normalizeNotificationSettings } = require('../utils/notificationSettings');
const systemSettingsStore = require('../services/systemSettingsStore');
const { telemetryLicensingService } = require('../services/telemetryLicensingService');

const router = express.Router();
const notificationRepository = new NotificationRepository();
const ADMIN_NOTICE_SYNC_MIN_SECONDS = Math.max(
  30,
  Number(process.env.ADMIN_NOTICE_SYNC_MIN_SECONDS || 90)
);

const isTruthyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeUniqueIds = (ids = []) =>
  [...new Set((ids || []).filter(Boolean).map((id) => id.toString()))];

const maybeSyncControlPlaneNoticesForAdmin = async (req) => {
  if (req.userRole?.name !== 'ADMIN') return;

  const telemetry = await systemSettingsStore.getTelemetryLicensingSettings();
  const controlPlaneEnabled = Boolean(telemetry?.controlPlane?.enabled);
  const controlPlaneUrl = String(telemetry?.controlPlane?.baseUrl || '').trim();
  if (!controlPlaneEnabled || !controlPlaneUrl) return;

  const lastSyncAt = telemetry?.lastSyncAt ? new Date(telemetry.lastSyncAt) : null;
  const lastSyncMs = lastSyncAt && !Number.isNaN(lastSyncAt.getTime()) ? lastSyncAt.getTime() : 0;
  if (lastSyncMs > 0 && (Date.now() - lastSyncMs) < ADMIN_NOTICE_SYNC_MIN_SECONDS * 1000) return;

  const result = await telemetryLicensingService.syncHeartbeatNow('admin_notifications_pull');
  if (!result?.ok && !result?.skipped) {
    console.error('[NOTIFICATIONS] Control-plane sync failed before admin read:', result?.message || result);
  }
};

const resolveRecipientsByTarget = async ({ targetType, roleNames = [], courseId, batchId, userIds = [] }) => {
  if (targetType === 'USERS') {
    return normalizeUniqueIds(userIds);
  }

  if (targetType === 'ROLES') {
    const users = await userRepository.find(
      { isActive: true },
      { populate: { path: 'roleId', select: 'name' }, select: '_id roleId' }
    );

    return normalizeUniqueIds(
      users
        .filter((user) => roleNames.includes(user.roleId?.name))
        .map((user) => user.id || user._id?.toString())
    );
  }

  if (targetType === 'COURSE') {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      const error = new Error('Course not found');
      error.statusCode = 404;
      throw error;
    }

    const enrollments = await enrollmentRepository.find(
      { courseId, status: 'ENROLLED' },
      { select: 'studentId' }
    );

    // Course-targeted custom notifications are student-scoped by default.
    // Instructors/managers/admins should be targeted explicitly via ROLES/USERS.
    return normalizeUniqueIds(enrollments.map((enrollment) => enrollment.studentId?.toString()));
  }

  if (targetType === 'BATCH') {
    const batch = await batchRepository.findById(batchId);
    if (!batch) {
      const error = new Error('Batch not found');
      error.statusCode = 404;
      throw error;
    }

    const enrollments = await enrollmentRepository.find(
      { batchId, status: 'ENROLLED' },
      { select: 'studentId' }
    );

    // Batch-targeted custom notifications are student-scoped by default.
    return normalizeUniqueIds(enrollments.map((enrollment) => enrollment.studentId?.toString()));
  }

  const users = await userRepository.find({ isActive: true }, { select: '_id' });
  return normalizeUniqueIds(users.map((user) => user.id || user._id?.toString()));
};

router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean()
], asyncHandler(async (req, res) => {
  await maybeSyncControlPlaneNoticesForAdmin(req);

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const unreadOnly = String(req.query.unreadOnly || 'false') === 'true';

  const result = await notificationRepository.findForUser(req.userId, {
    page,
    limit,
    unreadOnly
  });

  res.json({
    success: true,
    data: result.documents,
    pagination: result.pagination
  });
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  await maybeSyncControlPlaneNoticesForAdmin(req);

  const count = await notificationRepository.getUnreadCount(req.userId);
  res.json({
    success: true,
    data: { unreadCount: count }
  });
}));

router.get('/preferences', asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.userId, { select: 'notificationSettings' });
  res.json({
    success: true,
    data: normalizeNotificationSettings(user?.notificationSettings || {})
  });
}));

router.put('/preferences', [
  body('inAppEnabled').optional().isBoolean(),
  body('browserPushEnabled').optional().isBoolean(),
  body('digestEnabled').optional().isBoolean(),
  body('digestFrequency').optional().isIn(['DAILY', 'WEEKLY']),
  body('digestHourUTC').optional().isInt({ min: 0, max: 23 }),
  body('mutedTypes').optional().isArray(),
  body('mutedPriorities').optional().isArray(),
  body('quietHours').optional().isObject(),
  body('quietHours.enabled').optional().isBoolean(),
  body('quietHours.startHourUTC').optional().isInt({ min: 0, max: 23 }),
  body('quietHours.endHourUTC').optional().isInt({ min: 0, max: 23 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const user = await userRepository.findById(req.userId, { select: 'notificationSettings' });
  const settings = normalizeNotificationSettings(req.body || {}, user?.notificationSettings || {});

  await userRepository.updateById(req.userId, { notificationSettings: settings });

  res.json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: settings
  });
}));

router.get('/digest/preview', asyncHandler(async (req, res) => {
  const preview = await notificationDigestService.getDigestPreviewForUser(req.userId);
  res.json({
    success: true,
    data: preview
  });
}));

router.get('/digest/status', asyncHandler(async (req, res) => {
  const status = await notificationDigestService.getDigestStatusForUser(req.userId);
  res.json({
    success: true,
    data: status
  });
}));

router.post('/digest/send-now', asyncHandler(async (req, res) => {
  const result = await notificationDigestService.sendDigestForUser(req.userId, {
    force: true
  });

  res.json({
    success: true,
    message: result.sent
      ? 'Digest sent successfully'
      : (result.reason === 'NO_ITEMS' ? 'No unread items available for digest' : 'Digest evaluated'),
    data: result
  });
}));

router.patch('/:id/read', [param('id').isMongoId()], asyncHandler(async (req, res) => {
  const notification = await notificationRepository.markAsRead(req.params.id, req.userId);
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: notification
  });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  const result = await notificationRepository.markAllAsRead(req.userId);
  res.json({
    success: true,
    message: 'All notifications marked as read',
    data: result
  });
}));

router.patch('/:id/archive', [param('id').isMongoId()], asyncHandler(async (req, res) => {
  const notification = await notificationRepository.archive(req.params.id, req.userId);
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  res.json({
    success: true,
    message: 'Notification archived',
    data: notification
  });
}));

router.post('/custom', [
  requirePermission('NOTIFICATION_MANAGEMENT_SEND'),
  body('title').trim().isLength({ min: 3, max: 200 }),
  body('message').trim().isLength({ min: 3, max: 1000 }),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('type').optional().isIn([
    'SYSTEM',
    'CLASS_SCHEDULED',
    'CLASS_CANCELLED',
    'ASSESSMENT_PUBLISHED',
    'SUPPORT_TICKET_UPDATED',
    'CUSTOM_ANNOUNCEMENT'
  ]),
  body('targetType').isIn(['ALL_USERS', 'ROLES', 'COURSE', 'BATCH', 'USERS']),
  body('roleNames').optional().isArray(),
  body('courseId').optional().isMongoId(),
  body('batchId').optional().isMongoId(),
  body('userIds').optional().isArray(),
  body('linkUrl').optional().custom((value) => {
    if (!value) return true;
    if (typeof value !== 'string') {
      throw new Error('linkUrl must be a string');
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('/')) return true;
    if (/^https?:\/\/.+/i.test(trimmed)) return true;
    throw new Error('linkUrl must be a valid absolute URL or app-relative path');
  })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    title,
    message,
    priority = 'normal',
    type = 'CUSTOM_ANNOUNCEMENT',
    targetType,
    roleNames = [],
    courseId,
    batchId,
    userIds = [],
    linkUrl
  } = req.body;

  if (targetType === 'ROLES' && (!Array.isArray(roleNames) || roleNames.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'roleNames is required when targetType is ROLES'
    });
  }

  if (targetType === 'COURSE' && !courseId) {
    return res.status(400).json({
      success: false,
      message: 'courseId is required when targetType is COURSE'
    });
  }

  if (targetType === 'BATCH' && !batchId) {
    return res.status(400).json({
      success: false,
      message: 'batchId is required when targetType is BATCH'
    });
  }

  if (targetType === 'USERS' && (!Array.isArray(userIds) || userIds.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'userIds is required when targetType is USERS'
    });
  }

  const recipientIds = await resolveRecipientsByTarget({
    targetType,
    roleNames,
    courseId,
    batchId,
    userIds
  });

  if (recipientIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No recipients found for the selected target'
    });
  }

  const notifications = await notificationService.createForUsers(recipientIds, {
    actorId: req.userId,
    type,
    title,
    message,
    priority,
    data: {
      linkUrl: isTruthyString(linkUrl) ? linkUrl.trim() : null,
      targetType,
      roleNames: Array.isArray(roleNames) ? roleNames : [],
      courseId: courseId || null,
      batchId: batchId || null
    }
  });

  res.status(201).json({
    success: true,
    message: 'Custom notification sent successfully',
    data: {
      sentCount: notifications.length,
      targetType
    }
  });
}));

module.exports = router;
