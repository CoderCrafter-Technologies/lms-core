const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { setupService } = require('../services/setupService');
const systemSettingsStore = require('../services/systemSettingsStore');
const { smtpService } = require('../services/smtpService');

const router = express.Router();
const setupBrandingUploadPath = path.join(__dirname, '../../uploads/setup-branding');
fs.mkdirSync(setupBrandingUploadPath, { recursive: true });

const setupBrandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, setupBrandingUploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '.png';
    cb(null, `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const setupBrandingUpload = multer({
  storage: setupBrandingStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

const completeSetupValidation = [
  body('institute.name').trim().notEmpty().withMessage('Institute name is required'),
  body('admin.email').isEmail().withMessage('Valid admin email is required'),
  body('admin.firstName').trim().notEmpty().withMessage('Admin first name is required'),
  body('admin.lastName').trim().notEmpty().withMessage('Admin last name is required'),
  body('admin.password')
    .isLength({ min: 8 })
    .withMessage('Admin password must be at least 8 characters'),
  body('defaults.timezone').trim().notEmpty().withMessage('Default timezone is required'),
  body('database.mode')
    .isIn(['mongodb', 'postgres_uri', 'postgres_same_server'])
    .withMessage('Valid database mode is required'),
  body('smtp.enabled').optional().isBoolean(),
  body('smtp.host').optional().trim(),
  body('smtp.port').optional().isInt({ min: 1, max: 65535 }),
  body('smtp.fromEmail').optional().isEmail(),
];

router.get('/status', async (req, res, next) => {
  try {
    const status = await setupService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

router.get('/prefill', async (req, res, next) => {
  try {
    const data = await setupService.getPrefill();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});


router.get('/public-settings', async (req, res, next) => {
  try {
    const status = await setupService.getStatus();
    const publicSettings = await systemSettingsStore.getPublicAppSettings();
    res.json({
      success: true,
      data: {
        ...publicSettings,
        completed: status.completed,
        watermark: {
          text: 'Powered by CoderCrafter',
          forceVisible: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/brand-assets',
  setupBrandingUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
  ]),
  async (req, res) => {
    const files = req.files || {};
    const logo = files.logo?.[0];
    const favicon = files.favicon?.[0];

    const logoUrl = logo ? `/uploads/setup-branding/${logo.filename}` : '';
    const faviconUrl = favicon
      ? `/uploads/setup-branding/${favicon.filename}`
      : (logoUrl || '');

    return res.status(201).json({
      success: true,
      message: 'Brand assets uploaded successfully',
      data: {
        logoUrl,
        faviconUrl
      }
    });
  }
);

router.post('/smtp/test', async (req, res) => {
  try {
    await smtpService.testConnection(req.body || {});
    const testEmail = String(req.body?.testEmail || '').trim();
    if (testEmail) {
      await smtpService.sendMail({
        to: testEmail,
        subject: 'LMS setup SMTP test',
        html: '<p>Your SMTP configuration is working.</p>'
      }, req.body || {});
    }
    return res.json({
      success: true,
      message: testEmail
        ? `SMTP verified and test email sent to ${testEmail}`
        : 'SMTP connection verified'
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'SMTP test failed'
    });
  }
});

router.post('/complete', completeSetupValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const status = await setupService.completeSetup(req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Setup completed successfully',
      data: status
    });
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('already completed')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to complete setup'
    });
  }
});

module.exports = router;
