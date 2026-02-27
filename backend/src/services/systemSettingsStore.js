const fs = require('fs/promises');
const path = require('path');

const SETTINGS_DIR = path.join(__dirname, '../../data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'system-settings.json');

const DEFAULT_SETTINGS = {
  database: {
    mode: 'mongodb',
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/lms_futureproof',
    postgresUri: '',
    postgresSameServer: {
      host: 'postgres',
      port: 5432,
      database: 'lms_futureproof',
      user: 'postgres',
      password: 'postgres',
      ssl: false
    },
    updatedAt: null,
    updatedBy: null
  },
  setup: {
    completed: false,
    completedAt: null,
    completedBy: null,
    institute: {
      name: 'Institute',
      website: '',
      supportEmail: '',
      supportPhone: '',
      address: ''
    },
    branding: {
      appName: 'Institute LMS',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#2563EB',
      accentColor: '#0EA5E9',
      whiteLabelEnabled: false,
      showCoderCrafterWatermark: true
    },
    defaults: {
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      locale: 'en-US'
    },
    customDomains: [],
    marketing: null
  },
  telemetryLicensing: {
    instanceId: '',
    licenseKey: '',
    edition: 'SELF_HOSTED',
    licenseType: 'FREE',
    planCode: 'free_self_hosted',
    status: 'ACTIVE',
    firstSeenAt: null,
    activatedAt: null,
    lastHeartbeatAt: null,
    lastSyncAt: null,
    lastSyncStatus: 'NEVER',
    lastSyncError: '',
    controlPlane: {
      enabled: false,
      baseUrl: '',
      registerPath: '/api/v1/instances/register',
      heartbeatPath: '/api/v1/instances/heartbeat',
      usagePath: '/api/v1/instances/usage',
      signingKeyId: 'default',
      syncIntervalMinutes: 60
    },
    metadata: {
      appVersion: '1.0.0',
      buildChannel: 'stable',
      runtime: 'docker',
      deploymentTag: '',
      regionHint: '',
      instituteName: '',
      timezone: 'UTC'
    },
    policyCache: {
      version: null,
      fetchedAt: null,
      expiresAt: null,
      features: {},
      limits: {},
      raw: null
    }
  },
  smtp: {
    enabled: false,
    provider: 'smtp',
    host: '',
    port: 587,
    secure: false,
    requireTLS: false,
    authUser: '',
    authPass: '',
    fromName: 'LMS',
    fromEmail: '',
    replyTo: '',
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDeltaMs: 1000,
    rateLimit: 10,
    rejectUnauthorized: false,
    updatedAt: null,
    updatedBy: null
  }
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

const deepMerge = (target, source) => {
  const output = { ...target };
  if (!source || typeof source !== 'object') {
    return output;
  }

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(targetValue, sourceValue);
      return;
    }

    output[key] = sourceValue;
  });

  return output;
};

class SystemSettingsStore {
  async ensureStore() {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
  }

  async read() {
    await this.ensureStore();
    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return deepMerge(cloneDefaults(), parsed);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const defaults = cloneDefaults();
        await this.write(defaults);
        return defaults;
      }
      throw error;
    }
  }

  async write(nextSettings) {
    await this.ensureStore();
    const merged = deepMerge(cloneDefaults(), nextSettings || {});
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  async getDatabaseSettings() {
    const settings = await this.read();
    return settings.database;
  }

  async updateDatabaseSettings(nextDatabaseSettings) {
    const settings = await this.read();
    settings.database = deepMerge(settings.database, nextDatabaseSettings || {});
    await this.write(settings);
    return settings.database;
  }

  async getSetupSettings() {
    const settings = await this.read();
    return settings.setup;
  }

  async updateSetupSettings(nextSetupSettings) {
    const settings = await this.read();
    settings.setup = deepMerge(settings.setup, nextSetupSettings || {});
    await this.write(settings);
    return settings.setup;
  }

  async getPublicAppSettings() {
    const settings = await this.read();
    return {
      completed: Boolean(settings.setup?.completed),
      institute: settings.setup?.institute || {},
      branding: settings.setup?.branding || {},
      defaults: settings.setup?.defaults || {}
    };
  }

  async getTelemetryLicensingSettings() {
    const settings = await this.read();
    return settings.telemetryLicensing;
  }

  async updateTelemetryLicensingSettings(nextTelemetrySettings) {
    const settings = await this.read();
    settings.telemetryLicensing = deepMerge(
      settings.telemetryLicensing,
      nextTelemetrySettings || {}
    );
    await this.write(settings);
    return settings.telemetryLicensing;
  }

  async getSmtpSettings() {
    const settings = await this.read();
    return settings.smtp;
  }

  async updateSmtpSettings(nextSmtpSettings) {
    const settings = await this.read();
    settings.smtp = deepMerge(settings.smtp, nextSmtpSettings || {});
    await this.write(settings);
    return settings.smtp;
  }
}

module.exports = new SystemSettingsStore();
