const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const { monitoringRepository } = require('../repositories');
const { getSystemHealth } = require('../services/monitoringService');
const {
  getPolicy,
  updatePolicy,
  getAlertStatus,
  runRetentionCleanup,
  exportMonitoringBundle
} = require('../services/monitoringPolicyService');

const router = express.Router();

router.use(requirePermission('MONITORING_READ'));

router.get('/records', [
  query('category').optional().isIn(['LOG', 'EVENT', 'ERROR']),
  query('level').optional().isIn(['debug', 'info', 'warn', 'error', 'critical']),
  query('source').optional().isString(),
  query('search').optional().isString(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('includeArchived').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 25);

  const result = await monitoringRepository.findRecords({
    category: req.query.category,
    level: req.query.level,
    source: req.query.source,
    search: req.query.search,
    from: req.query.from,
    to: req.query.to,
    includeArchived: String(req.query.includeArchived || 'false') === 'true'
  }, { page, limit });

  res.json({
    success: true,
    data: result.documents,
    pagination: result.pagination
  });
}));

router.get('/policy', asyncHandler(async (_req, res) => {
  const policy = await getPolicy();
  res.json({
    success: true,
    data: policy
  });
}));

router.put('/policy', [
  body('retentionDays').optional().isInt({ min: 1, max: 3650 }),
  body('archiveWindowDays').optional().isInt({ min: 1, max: 365 }),
  body('exportMaxRecords').optional().isInt({ min: 100, max: 100000 }),
  body('alertThresholds').optional().isObject(),
  body('alertThresholds.warnPerHour').optional().isInt({ min: 1, max: 50000 }),
  body('alertThresholds.errorPerHour').optional().isInt({ min: 1, max: 50000 }),
  body('alertThresholds.criticalPerHour').optional().isInt({ min: 1, max: 50000 }),
  body('alertThresholds.memoryRssMb').optional().isInt({ min: 128, max: 131072 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const policy = await updatePolicy(req.body || {}, req.userId);
  res.json({
    success: true,
    message: 'Monitoring policy updated successfully',
    data: policy
  });
}));

router.get('/alerts/status', asyncHandler(async (_req, res) => {
  const status = await getAlertStatus();
  res.json({
    success: true,
    data: status
  });
}));

router.post('/archive/run', asyncHandler(async (_req, res) => {
  const policy = await getPolicy();
  const cutoff = new Date(Date.now() - policy.archiveWindowDays * 24 * 60 * 60 * 1000);
  const result = await monitoringRepository.archiveOlderThan(cutoff);

  res.json({
    success: true,
    message: 'Archive window execution completed',
    data: {
      archiveWindowDays: policy.archiveWindowDays,
      cutoff,
      archivedCount: result.modifiedCount || 0
    }
  });
}));

router.post('/retention/run', asyncHandler(async (_req, res) => {
  const result = await runRetentionCleanup();
  res.json({
    success: true,
    message: 'Retention cleanup completed',
    data: result
  });
}));

router.post('/export', [
  body('format').optional().isIn(['json', 'csv']),
  body('category').optional().isIn(['LOG', 'EVENT', 'ERROR']),
  body('level').optional().isIn(['debug', 'info', 'warn', 'error', 'critical']),
  body('source').optional().isString(),
  body('search').optional().isString(),
  body('from').optional().isISO8601(),
  body('to').optional().isISO8601(),
  body('includeArchived').optional().isBoolean(),
  body('limit').optional().isInt({ min: 1, max: 100000 }),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const format = req.body.format || 'json';
  const bundle = await exportMonitoringBundle(req.body || {}, format);

  res.setHeader('Content-Type', bundle.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename=\"${bundle.filename}\"`);
  res.status(200).send(bundle.content);
}));

router.get('/health', asyncHandler(async (_req, res) => {
  const health = await getSystemHealth();
  res.json({
    success: true,
    data: health
  });
}));

module.exports = router;
