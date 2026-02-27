const { validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getClassAttendanceRoster,
  getRecentClassStats,
  getAttendanceAnalytics
} = require('../services/liveClassAnalyticsService');
const { rebaselineHistoricalAttendance } = require('../services/liveClassHistoricalAttendanceService');

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const ensureValidRequest = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return false;
  }
  return true;
};

const getClassAttendanceReport = asyncHandler(async (req, res) => {
  if (!ensureValidRequest(req, res)) return;

  const result = await getClassAttendanceRoster({
    classId: req.params.classId,
    userRole: req.userRole,
    userId: req.userId,
    status: req.query.status,
    minPercent: parseOptionalNumber(req.query.minPercent),
    maxPercent: parseOptionalNumber(req.query.maxPercent),
    search: req.query.search,
    page: parseOptionalNumber(req.query.page) || 1,
    limit: parseOptionalNumber(req.query.limit) || 50
  });

  res.json({
    success: true,
    data: result
  });
});

const getRecentAttendanceStats = asyncHandler(async (req, res) => {
  if (!ensureValidRequest(req, res)) return;

  const rows = await getRecentClassStats({
    userRole: req.userRole,
    userId: req.userId,
    limit: parseOptionalNumber(req.query.limit) || 7,
    batchId: req.query.batchId
  });

  res.json({
    success: true,
    data: {
      rows
    }
  });
});

const getAttendanceAnalyticsReport = asyncHandler(async (req, res) => {
  if (!ensureValidRequest(req, res)) return;

  const data = await getAttendanceAnalytics({
    userRole: req.userRole,
    userId: req.userId,
    view: req.query.view,
    batchId: req.query.batchId,
    from: req.query.from,
    to: req.query.to,
    limit: parseOptionalNumber(req.query.limit) || 100
  });

  res.json({
    success: true,
    data
  });
});

const rebaselineHistoricalAttendanceReport = asyncHandler(async (req, res) => {
  if (!ensureValidRequest(req, res)) return;

  const result = await rebaselineHistoricalAttendance({
    batchId: req.body.batchId || null,
    dryRun: req.body.dryRun === true,
    limit: parseOptionalNumber(req.body.limit) || 500
  });

  res.json({
    success: true,
    message: result.dryRun ? 'Historical attendance dry-run completed' : 'Historical attendance re-baseline completed',
    data: result
  });
});

module.exports = {
  getClassAttendanceReport,
  getRecentAttendanceStats,
  getAttendanceAnalyticsReport,
  rebaselineHistoricalAttendanceReport
};
