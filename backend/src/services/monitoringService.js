const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const MonitoringRecord = require('../models/MonitoringRecord');
const User = require('../models/User');
const { getSocketHandler } = require('./socketBridge');
const database = require('../config/database');

const MONITORING_ROOM_EVENT = 'monitoring:record';
const MONITORING_PERMISSION = 'MONITORING_READ';
const MONITORING_RECIPIENT_CACHE_TTL_MS = 30 * 1000;

const monitoringRecipientCache = {
  ids: [],
  expiresAt: 0
};

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value.toString === 'function') return value.toString();
  return null;
};

async function getDirectorySize(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      return stat.size;
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const childSizes = await Promise.all(entries.map(async (entry) => {
      const childPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) return getDirectorySize(childPath);
      const childStat = await fs.stat(childPath);
      return childStat.size;
    }));

    return childSizes.reduce((acc, size) => acc + size, 0);
  } catch {
    return 0;
  }
}

async function resolveMonitoringRecipientIds() {
  const now = Date.now();
  if (monitoringRecipientCache.expiresAt > now && monitoringRecipientCache.ids.length > 0) {
    return monitoringRecipientCache.ids;
  }

  const users = await User.find({ isActive: true })
    .select('_id roleId managerPermissions')
    .populate({ path: 'roleId', select: 'name' })
    .lean();

  const ids = users
    .filter((user) => {
      const roleName = user.roleId?.name;
      if (roleName === 'ADMIN') return true;
      if (roleName === 'MANAGER') {
        return Array.isArray(user.managerPermissions) && user.managerPermissions.includes(MONITORING_PERMISSION);
      }
      return false;
    })
    .map((user) => user._id?.toString())
    .filter(Boolean);

  monitoringRecipientCache.ids = ids;
  monitoringRecipientCache.expiresAt = now + MONITORING_RECIPIENT_CACHE_TTL_MS;

  return ids;
}

function emitLiveRecord(record) {
  const socketHandler = getSocketHandler();
  if (!socketHandler) return;

  resolveMonitoringRecipientIds()
    .then((recipientIds) => {
      if (recipientIds.length > 0) {
        socketHandler.emitToUsers(recipientIds, MONITORING_ROOM_EVENT, record);
      }
    })
    .catch(() => {});
}

async function createRecord(payload = {}) {
  const record = await MonitoringRecord.create(payload);
  const jsonRecord = record.toJSON ? record.toJSON() : record;
  emitLiveRecord(jsonRecord);
  return jsonRecord;
}

function captureLog(payload = {}) {
  return createRecord({
    category: 'LOG',
    level: payload.level || 'info',
    source: payload.source || 'SYSTEM',
    action: payload.action || '',
    entityType: payload.entityType || '',
    entityId: payload.entityId || '',
    message: payload.message || 'Application log',
    actorId: normalizeId(payload.actorId),
    request: payload.request || {},
    metadata: payload.metadata || {}
  }).catch(() => null);
}

function captureEvent(payload = {}) {
  return createRecord({
    category: 'EVENT',
    level: payload.level || 'info',
    source: payload.source || 'SYSTEM',
    action: payload.action || '',
    entityType: payload.entityType || '',
    entityId: payload.entityId || '',
    message: payload.message || 'Application event',
    actorId: normalizeId(payload.actorId),
    request: payload.request || {},
    metadata: payload.metadata || {}
  }).catch(() => null);
}

function captureError(payload = {}) {
  return createRecord({
    category: 'ERROR',
    level: payload.level || 'error',
    source: payload.source || 'SYSTEM',
    action: payload.action || '',
    entityType: payload.entityType || '',
    entityId: payload.entityId || '',
    message: payload.message || 'Unhandled application error',
    actorId: normalizeId(payload.actorId),
    request: payload.request || {},
    metadata: payload.metadata || {}
  }).catch(() => null);
}

async function getSystemHealth() {
  const memoryUsage = process.memoryUsage();
  const uploadsPath = path.join(__dirname, '../../uploads');
  const logsPath = path.join(__dirname, '../logs');
  const [uploadsBytes, logsBytes, monitoringCount, dbHealthy] = await Promise.all([
    getDirectorySize(uploadsPath),
    getDirectorySize(logsPath),
    MonitoringRecord.countDocuments({}),
    database.isHealthy()
  ]);

  return {
    timestamp: new Date().toISOString(),
    app: {
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      pid: process.pid
    },
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg()
    },
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      process: memoryUsage
    },
    database: {
      healthy: dbHealthy,
      mongooseReadyState: mongoose.connection.readyState
    },
    storage: {
      uploadsBytes,
      logsBytes,
      totalAppStorageBytes: uploadsBytes + logsBytes,
      monitoringRecordCount: monitoringCount
    }
  };
}

module.exports = {
  MONITORING_PERMISSION,
  MONITORING_ROOM_EVENT,
  createRecord,
  captureLog,
  captureEvent,
  captureError,
  getSystemHealth
};
