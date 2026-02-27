const crypto = require('crypto');
const fs = require('fs');
const systemSettingsStore = require('./systemSettingsStore');
const {
  User,
  Role,
  Course,
  Batch,
  LiveClass,
  Enrollment,
  Assessment,
  AssessmentSubmission,
  Notification
} = require('../models');

const packageJson = require('../../package.json');
const emailService = require('./emailService');

const HEARTBEAT_TIMEOUT_MS = 10000;
const MIN_SYNC_INTERVAL_MINUTES = 5;
const MAX_SYNC_INTERVAL_MINUTES = 1440;
const DEFAULT_OFFLINE_GRACE_HOURS = 168;

const detectRuntime = () => {
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return 'k8s';
  }

  if (process.env.LMS_RUNTIME_TYPE) {
    return String(process.env.LMS_RUNTIME_TYPE).trim().toLowerCase();
  }

  if (fs.existsSync('/.dockerenv')) {
    return 'docker';
  }

  return 'node';
};

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const clampSyncInterval = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 60;
  return Math.min(MAX_SYNC_INTERVAL_MINUTES, Math.max(MIN_SYNC_INTERVAL_MINUTES, Math.round(numeric)));
};

const safeJsonParse = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const sha256Hex = (input) => crypto.createHash('sha256').update(input).digest('hex');
const hmacHex = (secret, input) => crypto.createHmac('sha256', secret).update(input).digest('hex');

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hoursFromNow = (date) => {
  if (!date) return null;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
};

class TelemetryLicensingService {
  constructor() {
    this.syncInFlight = false;
    this.lastPayload = null;
  }

  buildFreeLicenseKey(instanceId) {
    const digest = crypto
      .createHash('sha256')
      .update(`${instanceId}:${process.env.JWT_SECRET || 'cc-free'}`)
      .digest('hex')
      .slice(0, 28)
      .toUpperCase();
    return `CC-FREE-${digest}`;
  }

  async ensureIdentity(options = {}) {
    const current = await systemSettingsStore.getTelemetryLicensingSettings();
    const now = new Date().toISOString();
    const nextInstanceId = current.instanceId || crypto.randomUUID();
    const nextLicenseKey = current.licenseKey || this.buildFreeLicenseKey(nextInstanceId);
    const setupSettings = await systemSettingsStore.getSetupSettings();
    const envControlPlaneUrl = normalizeUrl(process.env.CONTROL_PLANE_URL || '');
    const envEnableSyncRaw = process.env.ENABLE_CONTROL_PLANE_SYNC;
    const envEnableSync =
      typeof envEnableSyncRaw === 'string'
        ? envEnableSyncRaw.trim().toLowerCase() === 'true'
        : null;
    const currentRegisterPath = String(current.controlPlane?.registerPath || '').trim();
    const currentHeartbeatPath = String(current.controlPlane?.heartbeatPath || '').trim();
    const currentUsagePath = String(current.controlPlane?.usagePath || '').trim();
    const normalizeApiPath = (value, fallback) => {
      const pathValue = String(value || fallback || '').trim();
      if (!pathValue) return fallback;
      if (pathValue.startsWith('/api/')) return pathValue;
      if (pathValue.startsWith('/v1/')) return `/api${pathValue}`;
      if (pathValue.startsWith('v1/')) return `/api/${pathValue}`;
      return pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
    };

    const nextSettings = {
      instanceId: nextInstanceId,
      licenseKey: nextLicenseKey,
      firstSeenAt: current.firstSeenAt || now,
      activatedAt: options.activate
        ? (current.activatedAt || now)
        : (current.activatedAt || null),
      metadata: {
        appVersion: packageJson.version || '1.0.0',
        buildChannel: String(process.env.APP_BUILD_CHANNEL || current.metadata?.buildChannel || 'stable').trim(),
        runtime: detectRuntime(),
        instituteName: String(
          options.instituteName
            || setupSettings?.institute?.name
            || current.metadata?.instituteName
            || ''
        ).trim(),
        timezone: String(
          options.timezone
            || setupSettings?.defaults?.timezone
            || current.metadata?.timezone
            || 'UTC'
        ).trim()
      },
      controlPlane: {
        // Environment values should win when explicitly provided so Docker/env
        // configuration can enable control-plane sync deterministically.
        baseUrl: envControlPlaneUrl || normalizeUrl(current.controlPlane?.baseUrl || ''),
        enabled: envEnableSync !== null
          ? envEnableSync
          : Boolean(current.controlPlane?.enabled),
        registerPath: normalizeApiPath(currentRegisterPath, '/api/v1/instances/register'),
        heartbeatPath: normalizeApiPath(currentHeartbeatPath, '/api/v1/instances/heartbeat'),
        usagePath: normalizeApiPath(currentUsagePath, '/api/v1/instances/usage')
      }
    };

    return systemSettingsStore.updateTelemetryLicensingSettings(nextSettings);
  }

  async updateStatusMetadata(patch = {}) {
    const next = {};
    if (patch.edition) next.edition = String(patch.edition).trim().toUpperCase();
    if (patch.licenseType) next.licenseType = String(patch.licenseType).trim().toUpperCase();
    if (patch.planCode) next.planCode = String(patch.planCode).trim();
    if (patch.status) next.status = String(patch.status).trim().toUpperCase();

    if (patch.controlPlane && typeof patch.controlPlane === 'object') {
      const controlPlane = {};
      if (typeof patch.controlPlane.enabled === 'boolean') {
        controlPlane.enabled = patch.controlPlane.enabled;
      }
      if (Object.prototype.hasOwnProperty.call(patch.controlPlane, 'baseUrl')) {
        controlPlane.baseUrl = normalizeUrl(patch.controlPlane.baseUrl);
      }
      if (Object.prototype.hasOwnProperty.call(patch.controlPlane, 'registerPath')) {
        controlPlane.registerPath = String(patch.controlPlane.registerPath || '/api/v1/instances/register').trim();
      }
      if (Object.prototype.hasOwnProperty.call(patch.controlPlane, 'heartbeatPath')) {
        controlPlane.heartbeatPath = String(patch.controlPlane.heartbeatPath || '/api/v1/instances/heartbeat').trim();
      }
      if (Object.prototype.hasOwnProperty.call(patch.controlPlane, 'usagePath')) {
        controlPlane.usagePath = String(patch.controlPlane.usagePath || '/api/v1/instances/usage').trim();
      }
      if (Object.prototype.hasOwnProperty.call(patch.controlPlane, 'signingKeyId')) {
        controlPlane.signingKeyId = String(patch.controlPlane.signingKeyId || 'default').trim();
      }
      if (Object.prototype.hasOwnProperty.call(patch.controlPlane, 'syncIntervalMinutes')) {
        controlPlane.syncIntervalMinutes = clampSyncInterval(patch.controlPlane.syncIntervalMinutes);
      }
      if (Object.keys(controlPlane).length > 0) {
        next.controlPlane = controlPlane;
      }
    }

    if (patch.metadata && typeof patch.metadata === 'object') {
      const metadataPatch = {};
      if (Object.prototype.hasOwnProperty.call(patch.metadata, 'deploymentTag')) {
        metadataPatch.deploymentTag = String(patch.metadata.deploymentTag || '').trim();
      }
      if (Object.prototype.hasOwnProperty.call(patch.metadata, 'regionHint')) {
        metadataPatch.regionHint = String(patch.metadata.regionHint || '').trim();
      }
      if (Object.keys(metadataPatch).length > 0) {
        next.metadata = metadataPatch;
      }
    }

    if (Object.keys(next).length === 0) {
      return systemSettingsStore.getTelemetryLicensingSettings();
    }

    return systemSettingsStore.updateTelemetryLicensingSettings(next);
  }

  mapNoticePriority(severity) {
    const value = String(severity || '').trim().toLowerCase();
    if (value === 'critical') return 'urgent';
    if (value === 'warning') return 'high';
    return 'normal';
  }

  async deliverControlPlaneNoticesToAdmins(settings, notices = []) {
    if (!Array.isArray(notices) || notices.length === 0) return { delivered: 0, skipped: 0 };

    const adminRole = await Role.findOne({ name: 'ADMIN' }).lean();
    if (!adminRole?._id) return { delivered: 0, skipped: notices.length };

    const adminUsers = await User.find(
      { roleId: adminRole._id, isActive: true },
      { _id: 1, email: 1, firstName: 1, lastName: 1 }
    ).lean();
    if (!adminUsers.length) return { delivered: 0, skipped: notices.length };

    const adminIds = adminUsers.map((user) => user._id.toString());
    const noticeIds = notices
      .map((notice) => String(notice?.id || '').trim())
      .filter(Boolean);

    const existing = noticeIds.length
      ? await Notification.find(
          {
            recipientId: { $in: adminIds },
            type: 'SYSTEM',
            'data.controlPlaneNoticeId': { $in: noticeIds }
          },
          { recipientId: 1, 'data.controlPlaneNoticeId': 1 }
        ).lean()
      : [];

    const deliveredKeys = new Set(
      existing.map((entry) => `${String(entry.recipientId)}:${String(entry?.data?.controlPlaneNoticeId || '')}`)
    );

    const docs = [];
    const emailJobs = [];
    for (const notice of notices) {
      const noticeId = String(notice?.id || '').trim();
      if (!noticeId) continue;
      const shouldEmail = Boolean(notice?.sendEmail);

      for (const adminId of adminIds) {
        const key = `${adminId}:${noticeId}`;
        if (deliveredKeys.has(key)) continue;
        deliveredKeys.add(key);

        docs.push({
          recipientId: adminId,
          actorId: null,
          type: 'SYSTEM',
          title: String(notice.title || 'Platform Notice').trim().slice(0, 200),
          message: String(notice.message || 'New platform update is available.').trim().slice(0, 1000),
          priority: this.mapNoticePriority(notice.severity),
          data: {
            source: 'CONTROL_PLANE',
            controlPlaneNoticeId: noticeId,
            severity: String(notice.severity || 'info'),
            target: notice.target || {},
            instanceId: settings.instanceId || null,
            licenseType: settings.licenseType || null,
            planCode: settings.planCode || null
          }
        });

        if (shouldEmail) {
          emailJobs.push({ adminId, notice });
        }
      }
    }

    if (docs.length > 0) {
      await Notification.insertMany(docs, { ordered: false });
    }

    if (emailJobs.length > 0) {
      const adminById = new Map(adminUsers.map((u) => [u._id.toString(), u]));
      for (const job of emailJobs) {
        const admin = adminById.get(job.adminId);
        if (!admin?.email) continue;
        try {
          await emailService.sendControlPlaneNoticeEmail(admin, job.notice);
        } catch (error) {
          console.error('[TELEMETRY] Failed sending control-plane notice email:', error?.message || error);
        }
      }
    }

    return { delivered: docs.length, skipped: existing.length };
  }

  getSigningSecret(settings) {
    const envSecret = String(process.env.CONTROL_PLANE_SIGNING_SECRET || '').trim();
    if (envSecret) return envSecret;
    return String(settings.licenseKey || '').trim();
  }

  buildSignedHeaders(settings, method, requestPath, payloadBody) {
    const timestamp = new Date().toISOString();
    const bodyHash = sha256Hex(String(payloadBody || ''));
    const canonical = [
      String(method || 'POST').toUpperCase(),
      String(requestPath || '/'),
      timestamp,
      bodyHash,
      String(settings.instanceId || '')
    ].join('\n');
    const signature = hmacHex(this.getSigningSecret(settings), canonical);
    return {
      'x-instance-id': settings.instanceId,
      'x-license-key': settings.licenseKey,
      'x-signature-alg': 'hmac-sha256',
      'x-signature-ts': timestamp,
      'x-signature': signature,
      'x-signature-kid': String(settings.controlPlane?.signingKeyId || 'default')
    };
  }

  async getPolicyState() {
    const telemetry = await this.ensureIdentity();
    const policy = telemetry.policyCache || {};
    const now = new Date();
    const graceHours = Number(process.env.POLICY_OFFLINE_GRACE_HOURS || DEFAULT_OFFLINE_GRACE_HOURS);
    const graceWindowHours = Number.isFinite(graceHours) && graceHours > 0
      ? graceHours
      : DEFAULT_OFFLINE_GRACE_HOURS;

    const expiresAt = parseDate(policy.expiresAt);
    const lastSyncAt = parseDate(telemetry.lastSyncAt);
    const hasPolicy = Boolean(policy.version || policy.raw || (policy.features && Object.keys(policy.features).length > 0));

    const syncAgeHours = hoursFromNow(lastSyncAt);
    const expiredHours = expiresAt ? hoursFromNow(expiresAt) : null;

    const strictMode = process.env.STRICT_POLICY_ENFORCEMENT === 'true';

    if (!hasPolicy) {
      return {
        hasPolicy,
        strictMode,
        status: strictMode ? 'MISSING_BLOCKED' : 'MISSING_ALLOWED',
        expiresAt: null,
        graceRemainingHours: strictMode ? 0 : graceWindowHours
      };
    }

    if (expiresAt && expiresAt > now) {
      return {
        hasPolicy,
        strictMode,
        status: 'VALID',
        expiresAt: expiresAt.toISOString(),
        syncAgeHours,
        graceRemainingHours: graceWindowHours
      };
    }

    const graceRemainingHours = Math.max(0, graceWindowHours - (expiredHours || 0));
    if (graceRemainingHours > 0) {
      return {
        hasPolicy,
        strictMode,
        status: 'GRACE',
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        syncAgeHours,
        graceRemainingHours
      };
    }

    return {
      hasPolicy,
      strictMode,
      status: strictMode ? 'EXPIRED_BLOCKED' : 'EXPIRED_STALE_ALLOWED',
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      syncAgeHours,
      graceRemainingHours: 0
    };
  }

  async checkEntitlement(featureKey, options = {}) {
    const telemetry = await this.ensureIdentity();
    const policyState = await this.getPolicyState();
    const policyFeatures = telemetry.policyCache?.features || {};
    const featureName = String(featureKey || '').trim();
    const hasExplicitFeature = Object.prototype.hasOwnProperty.call(policyFeatures, featureName);
    const explicitValue = hasExplicitFeature ? Boolean(policyFeatures[featureName]) : null;
    const defaultAllowed = Boolean(options.defaultAllowed);
    const requiresValidPolicy = Boolean(options.requiresValidPolicy);

    const isHardBlockedPolicyState = policyState.status === 'MISSING_BLOCKED' || policyState.status === 'EXPIRED_BLOCKED';
    if (isHardBlockedPolicyState) {
      return {
        allowed: false,
        reason: `POLICY_${policyState.status}`,
        feature: featureName,
        policyState
      };
    }

    if (requiresValidPolicy && policyState.status !== 'VALID') {
      return {
        allowed: false,
        reason: 'POLICY_NOT_VALID',
        feature: featureName,
        policyState
      };
    }

    if (hasExplicitFeature) {
      return {
        allowed: explicitValue,
        reason: explicitValue ? 'POLICY_FEATURE_ENABLED' : 'POLICY_FEATURE_DISABLED',
        feature: featureName,
        policyState
      };
    }

    return {
      allowed: defaultAllowed,
      reason: defaultAllowed ? 'DEFAULT_ALLOWED' : 'DEFAULT_DENIED',
      feature: featureName,
      policyState
    };
  }

  async collectUsageSnapshot() {
    const [
      totalUsers,
      activeUsers,
      totalCourses,
      totalBatches,
      totalLiveClasses,
      liveNow,
      totalEnrollments,
      totalAssessments,
      totalSubmissions,
      pendingNotifications
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      Course.countDocuments({}),
      Batch.countDocuments({}),
      LiveClass.countDocuments({}),
      LiveClass.countDocuments({ status: 'LIVE' }),
      Enrollment.countDocuments({}),
      Assessment.countDocuments({}),
      AssessmentSubmission.countDocuments({}),
      Notification.countDocuments({ readAt: null, isArchived: false })
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers
      },
      courses: totalCourses,
      batches: totalBatches,
      liveClasses: {
        total: totalLiveClasses,
        active: liveNow
      },
      enrollments: totalEnrollments,
      assessments: totalAssessments,
      submissions: totalSubmissions,
      pendingNotifications
    };
  }

  async buildHeartbeatPayload(reason = 'manual') {
    const telemetry = await this.ensureIdentity();
    const usage = await this.collectUsageSnapshot();
    const setup = await systemSettingsStore.getSetupSettings();
    const now = new Date().toISOString();

    const payload = {
      instanceId: telemetry.instanceId,
      licenseKey: telemetry.licenseKey,
      edition: telemetry.edition,
      licenseType: telemetry.licenseType,
      planCode: telemetry.planCode,
      status: telemetry.status,
      reason,
      timestamp: now,
      app: {
        name: setup?.branding?.appName || 'Institute LMS',
        version: telemetry.metadata?.appVersion || packageJson.version || '1.0.0',
        buildChannel: telemetry.metadata?.buildChannel || 'stable'
      },
      institute: {
        name: setup?.institute?.name || telemetry.metadata?.instituteName || '',
        timezone: setup?.defaults?.timezone || telemetry.metadata?.timezone || 'UTC'
      },
      deployment: {
        runtime: telemetry.metadata?.runtime || detectRuntime(),
        deploymentTag: telemetry.metadata?.deploymentTag || '',
        regionHint: telemetry.metadata?.regionHint || ''
      },
      usage,
      runtime: {
        node: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        env: process.env.NODE_ENV || 'development'
      }
    };

    this.lastPayload = payload;
    await systemSettingsStore.updateTelemetryLicensingSettings({
      lastHeartbeatAt: now
    });
    return payload;
  }

  async syncHeartbeatNow(reason = 'manual', options = {}) {
    if (this.syncInFlight) {
      return {
        ok: false,
        skipped: true,
        message: 'Telemetry sync already in progress'
      };
    }

    this.syncInFlight = true;
    try {
      const setupSettings = await systemSettingsStore.getSetupSettings();
      const setupCompleted = Boolean(setupSettings?.completed);
      const allowBeforeSetup = Boolean(options.allowBeforeSetup);
      if (!setupCompleted && !allowBeforeSetup) {
        await systemSettingsStore.updateTelemetryLicensingSettings({
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'SKIPPED',
          lastSyncError: 'SETUP_NOT_COMPLETED'
        });
        return {
          ok: true,
          skipped: true,
          message: 'Setup not completed; heartbeat sync skipped until setup wizard is completed.'
        };
      }

      const settings = await this.ensureIdentity();
      const payload = await this.buildHeartbeatPayload(reason);
      const baseUrl = normalizeUrl(settings.controlPlane?.baseUrl);
      const isEnabled = Boolean(settings.controlPlane?.enabled);

      if (!isEnabled || !baseUrl) {
        await systemSettingsStore.updateTelemetryLicensingSettings({
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'SKIPPED',
          lastSyncError: isEnabled ? 'CONTROL_PLANE_URL_MISSING' : 'CONTROL_PLANE_DISABLED'
        });
        return {
          ok: true,
          skipped: true,
          message: isEnabled ? 'Control plane URL is missing' : 'Control plane sync is disabled',
          payload
        };
      }

      if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this Node runtime');
      }

      const controller = new AbortController();
      const heartbeatPath = String(settings.controlPlane?.heartbeatPath || '/api/v1/instances/heartbeat').trim();
      const requestUrl = `${baseUrl}${heartbeatPath.startsWith('/') ? '' : '/'}${heartbeatPath}`;

      const requestBody = JSON.stringify(payload);
      const requestPath = `/${heartbeatPath.replace(/^\/+/, '')}`;
      const headers = {
        'Content-Type': 'application/json',
        ...this.buildSignedHeaders(settings, 'POST', requestPath, requestBody)
      };
      if (process.env.CONTROL_PLANE_API_KEY) {
        headers.Authorization = `Bearer ${process.env.CONTROL_PLANE_API_KEY}`;
      }

      const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: requestBody,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const responseBody = await safeJsonParse(response);
      const now = new Date().toISOString();

      if (!response.ok) {
        const errorMessage = responseBody?.message || response.statusText || 'Telemetry sync failed';
        await systemSettingsStore.updateTelemetryLicensingSettings({
          lastSyncAt: now,
          lastSyncStatus: 'FAILED',
          lastSyncError: `${response.status}:${errorMessage}`.slice(0, 500)
        });
        return {
          ok: false,
          skipped: false,
          message: errorMessage,
          statusCode: response.status,
          payload,
          response: responseBody
        };
      }

      const policyPatch = responseBody?.data?.policy
        ? {
            policyCache: {
              version: String(responseBody.data.policy.version || '').trim() || null,
              fetchedAt: now,
              expiresAt: responseBody.data.policy.expiresAt || null,
              features: responseBody.data.policy.features || {},
              limits: responseBody.data.policy.limits || {},
              raw: responseBody.data.policy
            }
          }
        : {};

      await systemSettingsStore.updateTelemetryLicensingSettings({
        lastSyncAt: now,
        lastSyncStatus: 'SUCCESS',
        lastSyncError: '',
        ...policyPatch
      });

      const notices = Array.isArray(responseBody?.data?.notices) ? responseBody.data.notices : [];
      if (notices.length > 0) {
        await this.deliverControlPlaneNoticesToAdmins(settings, notices);
      }

      return {
        ok: true,
        skipped: false,
        message: 'Telemetry sync successful',
        statusCode: response.status,
        payload,
        response: responseBody
      };
    } catch (error) {
      const now = new Date().toISOString();
      await systemSettingsStore.updateTelemetryLicensingSettings({
        lastSyncAt: now,
        lastSyncStatus: 'FAILED',
        lastSyncError: String(error.message || error).slice(0, 500)
      });
      return {
        ok: false,
        skipped: false,
        message: error.message || 'Telemetry sync failed'
      };
    } finally {
      this.syncInFlight = false;
    }
  }
}

module.exports = {
  telemetryLicensingService: new TelemetryLicensingService()
};
