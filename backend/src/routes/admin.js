const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { randomInt, createHash } = require('crypto');
const adminController = require('../controllers/adminController');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { databaseSettingsService } = require('../services/databaseSettingsService');
const { telemetryLicensingService } = require('../services/telemetryLicensingService');
const systemSettingsStore = require('../services/systemSettingsStore');
const { smtpService } = require('../services/smtpService');
const { User, Role, RolePermission, Permission, Course, Batch, LiveClass, Enrollment, PastEnrollment, Assessment, AssessmentSubmission, RefreshSession, Notification, MonitoringRecord, MonitoringPolicy, Resource, Ticket } = require('../models');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const path = require('path');
const emailService = require('../services/emailService');

const router = express.Router();
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  return next();
};

// All admin routes require admin role
router.use(roleMiddleware(['admin']));

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get comprehensive dashboard statistics
 * @access  Admin
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @route   GET /api/admin/instructors
 * @desc    Get all instructors for selection
 * @access  Admin
 */
router.get('/instructors', adminController.getInstructors);

/**
 * @route   POST /api/admin/instructors
 * @desc    Create new instructor
 * @access  Admin
 */
router.post('/instructors', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('sendEmail').optional().isBoolean()
], validateRequest, adminController.createInstructor);

/**
 * @route   GET /api/admin/instructors/:id
 * @desc    Get instructor profile with performance stats
 * @access  Admin
 */
router.get('/instructors/:id', [
  param('id').isMongoId().withMessage('Valid instructor ID required')
], validateRequest, adminController.getInstructorProfile);

/**
 * @route   GET /api/admin/manager-permissions
 * @desc    Get manager permission catalog for provisioning
 * @access  Admin
 */
router.get('/manager-permissions', adminController.getManagerPermissionCatalog);

/**
 * @route   POST /api/admin/managers
 * @desc    Create manager with custom permissions
 * @access  Admin
 */
router.post('/managers', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('managerPermissions').optional().isArray().withMessage('managerPermissions must be an array'),
  body('sendEmail').optional().isBoolean()
], validateRequest, adminController.createManager);

/**
 * @route   GET /api/admin/courses-with-batches
 * @desc    Get all courses with their batches and classes
 * @access  Admin
 */
router.get('/courses-with-batches', adminController.getCoursesWithBatches);

/**
 * @route   POST /api/admin/create-student
 * @desc    Create student and optionally enroll in batch
 * @access  Admin
 */
router.post('/create-student', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('batchId').optional().isMongoId().withMessage('Valid batch ID required'),
  body('sendEmail').optional().isBoolean()
], validateRequest, adminController.createStudentWithEnrollment);

/**
 * @route   GET /api/admin/batches/:id/details
 * @desc    Get batch details with students and classes
 * @access  Admin
 */
router.get('/batches/:id/details', [
  param('id').isMongoId().withMessage('Valid batch ID required')
], validateRequest, adminController.getBatchDetails);

/**
 * @route   POST /api/admin/batches/:batchId/auto-generate-classes
 * @desc    Auto-generate classes for batch
 * @access  Admin
 */
router.post('/batches/:batchId/auto-generate-classes', [
  param('batchId').isMongoId().withMessage('Valid batch ID required'),
  body('sessionDuration').optional().isInt({ min: 15, max: 480 }),
  body('totalSessions').optional().isInt({ min: 1, max: 200 })
], validateRequest, adminController.autoGenerateClasses);

/**
 * @route   POST /api/admin/bulk-enroll
 * @desc    Bulk enroll students in batch
 * @access  Admin
 */
router.post('/bulk-enroll', [
  body('studentIds').isArray().withMessage('Student IDs array required'),
  body('batchId').isMongoId().withMessage('Valid batch ID required')
], validateRequest, adminController.bulkEnrollStudents);

/**
 * @route   GET /api/admin/database-settings
 * @desc    Get system database settings (admin only)
 * @access  Admin
 */
router.get('/database-settings', async (req, res, next) => {
  try {
    const settings = await databaseSettingsService.getDatabaseSettings({ includeSecrets: true });
    const runtime = await databaseSettingsService.getRuntimeDatabaseContext();

    res.json({
      success: true,
      settings,
      runtime,
      note: 'Database provider changes are saved now and applied on restart/setup wizard runtime.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/landing-page
 * @desc    Get public landing page appearance settings
 * @access  Admin
 */
router.get('/landing-page', async (req, res, next) => {
  try {
    const setupSettings = await systemSettingsStore.getSetupSettings();
    res.json({
      success: true,
      settings: setupSettings?.publicLanding || {}
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/landing-page
 * @desc    Update public landing page appearance settings
 * @access  Admin
 */
router.put('/landing-page', async (req, res) => {
  try {
    const payload = req.body || {};
    const updated = await systemSettingsStore.updateSetupSettings({
      publicLanding: payload
    });
    res.json({
      success: true,
      message: 'Landing page settings updated',
      settings: updated.publicLanding || {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update landing page settings'
    });
  }
});

/**
 * @route   GET /api/admin/dashboard-theme
 * @desc    Get dashboard theme overrides
 * @access  Admin
 */
router.get('/dashboard-theme', async (req, res, next) => {
  try {
    const setupSettings = await systemSettingsStore.getSetupSettings();
    res.json({
      success: true,
      settings: setupSettings?.dashboardTheme || {}
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/dashboard-theme
 * @desc    Update dashboard theme overrides
 * @access  Admin
 */
router.put('/dashboard-theme', async (req, res) => {
  try {
    const payload = req.body || {};
    const updated = await systemSettingsStore.updateSetupSettings({
      dashboardTheme: payload
    });
    res.json({
      success: true,
      message: 'Dashboard theme updated',
      settings: updated.dashboardTheme || {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update dashboard theme'
    });
  }
});

/**
 * @route   GET /api/admin/smtp-settings
 * @desc    Get SMTP configuration
 * @access  Admin
 */
router.get('/smtp-settings', async (req, res, next) => {
  try {
    const settings = await smtpService.getSettings({ includeSecrets: false });
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/smtp-settings
 * @desc    Update SMTP configuration
 * @access  Admin
 */
router.put('/smtp-settings', async (req, res) => {
  try {
    const updated = await smtpService.updateSettings(req.body || {}, {
      updatedBy: req.userId || null
    });
    res.json({
      success: true,
      message: 'SMTP settings updated successfully',
      settings: { ...updated, authPass: updated.authPass ? '********' : '' }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update SMTP settings'
    });
  }
});

/**
 * @route   POST /api/admin/smtp-settings/test
 * @desc    Test SMTP connectivity with optional test email delivery
 * @access  Admin
 */
router.post('/smtp-settings/test', async (req, res) => {
  try {
    const payload = req.body || {};
    const override = Object.keys(payload).length > 0 ? payload : null;
    await smtpService.testConnection(override);

    const testRecipient = String(payload.testEmail || '').trim();
    let sendResult = null;
    if (testRecipient) {
      sendResult = await smtpService.sendMail({
        to: testRecipient,
        subject: 'SMTP test email',
        html: '<p>SMTP test successful.</p>'
      }, override);
    }

    res.json({
      success: true,
      message: testRecipient
        ? `SMTP verified and test email sent to ${testRecipient}`
        : 'SMTP connection verified successfully',
      data: sendResult || { verified: true }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'SMTP test failed'
    });
  }
});

/**
 * @route   POST /api/admin/users/:id/request-password-otp
 * @desc    Admin-triggered password setup OTP for any user role
 * @access  Admin
 */
router.post('/users/:id/request-password-otp', [
  param('id').isMongoId().withMessage('Valid user ID is required')
], validateRequest, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('email firstName lastName isActive');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send OTP to an inactive user'
      });
    }

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + Math.max(3, Number(process.env.PASSWORD_SETUP_OTP_EXP_MINUTES || 10)) * 60 * 1000);
    const codeHash = createHash('sha256').update(otp).digest('hex');

    user.emailVerificationOtp = {
      codeHash,
      expiresAt,
      purpose: 'password_setup_by_admin'
    };
    await user.save();

    await emailService.sendOtpEmail(user.email, otp, 'password_setup');

    return res.json({
      success: true,
      message: `OTP sent to ${user.email}. It expires in ${Math.max(3, Number(process.env.PASSWORD_SETUP_OTP_EXP_MINUTES || 10))} minutes.`,
      ...(process.env.NODE_ENV === 'development' ? { data: { otp } } : {})
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send password setup OTP'
    });
  }
});

/**
 * @route   PUT /api/admin/database-settings
 * @desc    Update system database settings and validate connectivity
 * @access  Admin
 */
router.put('/database-settings', async (req, res, next) => {
  try {
    const updated = await databaseSettingsService.updateDatabaseSettings(req.body || {}, {
      updatedBy: req.userId || null
    });
    const runtime = await databaseSettingsService.getRuntimeDatabaseContext();

    res.json({
      success: true,
      message: 'Database settings updated and connectivity verified. Restart required to apply runtime provider.',
      settings: updated,
      runtime
    });
  } catch (error) {
    if (error.message?.toLowerCase().includes('required') || error.message?.toLowerCase().includes('invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(400).json({
      success: false,
      message: `Database connectivity validation failed: ${error.message}`
    });
  }
});

/**
 * @route   GET /api/admin/licensing
 * @desc    Get telemetry/licensing metadata and last sync status
 * @access  Admin
 */
router.get('/licensing', async (req, res, next) => {
  try {
    const settings = await telemetryLicensingService.ensureIdentity();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/licensing
 * @desc    Update telemetry/licensing metadata and control-plane sync config
 * @access  Admin
 */
router.put('/licensing', async (req, res) => {
  try {
    const updated = await telemetryLicensingService.updateStatusMetadata(req.body || {});
    res.json({
      success: true,
      message: 'Licensing and telemetry settings updated',
      data: updated
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update licensing settings'
    });
  }
});

/**
 * @route   GET /api/admin/licensing/heartbeat-preview
 * @desc    Build heartbeat payload preview without forcing remote sync
 * @access  Admin
 */
router.get('/licensing/heartbeat-preview', async (req, res, next) => {
  try {
    const payload = await telemetryLicensingService.buildHeartbeatPayload('preview');
    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/licensing/sync
 * @desc    Trigger immediate telemetry heartbeat sync
 * @access  Admin
 */
router.post('/licensing/sync', async (req, res, next) => {
  try {
    const allowBeforeSetup = String(req.query.force || '').toLowerCase() === 'true';
    const result = await telemetryLicensingService.syncHeartbeatNow('manual', { allowBeforeSetup });
    const statusCode = result.ok ? 200 : 400;
    res.status(statusCode).json({
      success: result.ok,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/licensing/public-summary
 * @desc    Quick anonymous-safe summary for support/debug screens
 * @access  Admin
 */
router.get('/licensing/public-summary', async (req, res, next) => {
  try {
    const settings = await systemSettingsStore.getTelemetryLicensingSettings();
    res.json({
      success: true,
      data: {
        instanceId: settings.instanceId,
        edition: settings.edition,
        licenseType: settings.licenseType,
        planCode: settings.planCode,
        status: settings.status,
        appVersion: settings.metadata?.appVersion || null,
        runtime: settings.metadata?.runtime || null,
        lastHeartbeatAt: settings.lastHeartbeatAt,
        lastSyncAt: settings.lastSyncAt,
        lastSyncStatus: settings.lastSyncStatus
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/reset
 * @desc    Reset institute data (wipe or full)
 * @access  Admin
 */
router.post('/reset', [
  body('mode').isIn(['wipe', 'full']).withMessage('Reset mode must be wipe or full')
], validateRequest, async (req, res) => {
  const mode = String(req.body?.mode || 'wipe').toLowerCase();
  const uploadsDir = path.join(__dirname, '../../uploads');
  const dataDir = path.join(__dirname, '../../data');

  try {
    if (mode === 'full') {
      if (mongoose.connection?.db) {
        await mongoose.connection.db.dropDatabase();
      }
      await systemSettingsStore.resetToDefaults();
      await fs.rm(uploadsDir, { recursive: true, force: true });
      await fs.rm(dataDir, { recursive: true, force: true });
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.mkdir(dataDir, { recursive: true });

      return res.json({
        success: true,
        message: 'Full reset completed. Setup wizard will be required on next load.'
      });
    }

    const adminRole = await Role.findOne({ name: /admin/i }).select('_id');
    const adminIds = adminRole
      ? await User.find({ roleId: adminRole._id }).select('_id')
      : [];
    const adminIdList = adminIds.map((doc) => doc._id);

    await Promise.all([
      Course.deleteMany({}),
      Batch.deleteMany({}),
      LiveClass.deleteMany({}),
      Enrollment.deleteMany({}),
      PastEnrollment.deleteMany({}),
      Assessment.deleteMany({}),
      AssessmentSubmission.deleteMany({}),
      Resource.deleteMany({}),
      Ticket.deleteMany({}),
      Notification.deleteMany({}),
      MonitoringRecord.deleteMany({}),
      MonitoringPolicy.deleteMany({}),
      RefreshSession.deleteMany({}),
      User.deleteMany(adminIdList.length ? { _id: { $nin: adminIdList } } : {}),
      RolePermission.deleteMany({}),
      Permission.deleteMany({})
    ]);

    return res.json({
      success: true,
      message: 'Data wiped successfully. Admin accounts were preserved.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset institute'
    });
  }
});

/**
 * @route   GET /api/admin/licensing/policy-state
 * @desc    Get local policy validity + offline grace state
 * @access  Admin
 */
router.get('/licensing/policy-state', async (req, res, next) => {
  try {
    const policyState = await telemetryLicensingService.getPolicyState();
    res.json({
      success: true,
      data: policyState
    });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
