const MonitoringPolicy = require('../models/MonitoringPolicy');
const MonitoringRecord = require('../models/MonitoringRecord');
const { getSystemHealth } = require('./monitoringService');

const POLICY_SCOPE = 'GLOBAL';

const DEFAULT_POLICY = {
  scope: POLICY_SCOPE,
  retentionDays: 90,
  archiveWindowDays: 30,
  exportMaxRecords: 5000,
  alertThresholds: {
    warnPerHour: 100,
    errorPerHour: 30,
    criticalPerHour: 10,
    memoryRssMb: 2048
  }
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max, fallback) => {
  const parsed = toNumber(value, fallback);
  return Math.max(min, Math.min(max, parsed));
};

const normalizePolicyInput = (incoming = {}, current = DEFAULT_POLICY) => {
  const merged = {
    ...DEFAULT_POLICY,
    ...(current || {}),
    ...(incoming || {}),
    alertThresholds: {
      ...DEFAULT_POLICY.alertThresholds,
      ...(current?.alertThresholds || {}),
      ...(incoming?.alertThresholds || {})
    }
  };

  return {
    scope: POLICY_SCOPE,
    retentionDays: clamp(merged.retentionDays, 1, 3650, DEFAULT_POLICY.retentionDays),
    archiveWindowDays: clamp(merged.archiveWindowDays, 1, 365, DEFAULT_POLICY.archiveWindowDays),
    exportMaxRecords: clamp(merged.exportMaxRecords, 100, 100000, DEFAULT_POLICY.exportMaxRecords),
    alertThresholds: {
      warnPerHour: clamp(merged.alertThresholds.warnPerHour, 1, 50000, DEFAULT_POLICY.alertThresholds.warnPerHour),
      errorPerHour: clamp(merged.alertThresholds.errorPerHour, 1, 50000, DEFAULT_POLICY.alertThresholds.errorPerHour),
      criticalPerHour: clamp(merged.alertThresholds.criticalPerHour, 1, 50000, DEFAULT_POLICY.alertThresholds.criticalPerHour),
      memoryRssMb: clamp(merged.alertThresholds.memoryRssMb, 128, 131072, DEFAULT_POLICY.alertThresholds.memoryRssMb)
    }
  };
};

const getPolicy = async () => {
  try {
    const policy = await MonitoringPolicy.findOneAndUpdate(
      { scope: POLICY_SCOPE },
      { $setOnInsert: DEFAULT_POLICY },
      { new: true, upsert: true }
    ).lean();
    return policy;
  } catch (error) {
    if (error?.code === 11000) {
      const policy = await MonitoringPolicy.findOne({ scope: POLICY_SCOPE }).lean();
      if (policy) return policy;
    }
    throw error;
  }
};

const updatePolicy = async (updates = {}, actorId = null) => {
  const current = await getPolicy();
  const normalized = normalizePolicyInput(updates, current);

  const policy = await MonitoringPolicy.findOneAndUpdate(
    { scope: POLICY_SCOPE },
    { ...normalized, updatedBy: actorId || null },
    { new: true, upsert: true }
  );

  return policy.toJSON ? policy.toJSON() : policy;
};

const buildCriteriaFromFilters = (filters = {}) => {
  const criteria = { isArchived: { $ne: true } };

  if (filters.category) criteria.category = filters.category;
  if (filters.level) criteria.level = filters.level;
  if (filters.source) criteria.source = filters.source;
  if (filters.search) {
    criteria.$or = [
      { message: { $regex: filters.search, $options: 'i' } },
      { action: { $regex: filters.search, $options: 'i' } },
      { entityType: { $regex: filters.search, $options: 'i' } },
    ];
  }

  if (filters.from || filters.to) {
    criteria.createdAt = {};
    if (filters.from) criteria.createdAt.$gte = new Date(filters.from);
    if (filters.to) criteria.createdAt.$lte = new Date(filters.to);
  }

  return criteria;
};

const getAlertStatus = async () => {
  const policy = await getPolicy();
  const from = new Date(Date.now() - 60 * 60 * 1000);

  const [warnCount, errorCount, criticalCount, health] = await Promise.all([
    MonitoringRecord.countDocuments({ level: 'warn', createdAt: { $gte: from }, isArchived: { $ne: true } }),
    MonitoringRecord.countDocuments({ level: 'error', createdAt: { $gte: from }, isArchived: { $ne: true } }),
    MonitoringRecord.countDocuments({ level: 'critical', createdAt: { $gte: from }, isArchived: { $ne: true } }),
    getSystemHealth()
  ]);

  const rssMb = Math.round((health?.memory?.process?.rss || 0) / (1024 * 1024));
  const breaches = [];
  if (warnCount >= policy.alertThresholds.warnPerHour) breaches.push('WARN_PER_HOUR');
  if (errorCount >= policy.alertThresholds.errorPerHour) breaches.push('ERROR_PER_HOUR');
  if (criticalCount >= policy.alertThresholds.criticalPerHour) breaches.push('CRITICAL_PER_HOUR');
  if (rssMb >= policy.alertThresholds.memoryRssMb) breaches.push('MEMORY_RSS_MB');

  return {
    window: {
      from,
      to: new Date()
    },
    metrics: {
      warnPerHour: warnCount,
      errorPerHour: errorCount,
      criticalPerHour: criticalCount,
      memoryRssMb: rssMb
    },
    thresholds: policy.alertThresholds,
    breaches,
    healthy: breaches.length === 0
  };
};

const runRetentionCleanup = async () => {
  const policy = await getPolicy();
  const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
  const result = await MonitoringRecord.deleteMany({ createdAt: { $lt: cutoff } });

  return {
    retentionDays: policy.retentionDays,
    cutoff,
    deletedCount: result.deletedCount || 0
  };
};

const exportMonitoringBundle = async (filters = {}, format = 'json') => {
  const policy = await getPolicy();
  const criteria = buildCriteriaFromFilters(filters);
  const limit = Math.max(1, Math.min(policy.exportMaxRecords, Number(filters.limit || policy.exportMaxRecords)));

  const records = await MonitoringRecord.find(criteria)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (format === 'csv') {
    const rows = [
      ['createdAt', 'category', 'level', 'source', 'action', 'entityType', 'entityId', 'message']
    ];

    records.forEach((item) => {
      rows.push([
        item.createdAt ? new Date(item.createdAt).toISOString() : '',
        item.category || '',
        item.level || '',
        item.source || '',
        item.action || '',
        item.entityType || '',
        item.entityId || '',
        (item.message || '').replace(/\r?\n/g, ' ')
      ]);
    });

    const csv = rows.map((row) =>
      row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    return {
      format: 'csv',
      mimeType: 'text/csv',
      filename: `monitoring_export_${Date.now()}.csv`,
      content: csv,
      recordCount: records.length
    };
  }

  return {
    format: 'json',
    mimeType: 'application/json',
    filename: `monitoring_export_${Date.now()}.json`,
    content: JSON.stringify({
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      filters,
      records
    }, null, 2),
    recordCount: records.length
  };
};

module.exports = {
  getPolicy,
  updatePolicy,
  getAlertStatus,
  runRetentionCleanup,
  exportMonitoringBundle,
  normalizePolicyInput
};
