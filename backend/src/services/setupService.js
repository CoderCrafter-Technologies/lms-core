const { databaseSettingsService } = require('./databaseSettingsService');
const systemSettingsStore = require('./systemSettingsStore');
const { telemetryLicensingService } = require('./telemetryLicensingService');
const { smtpService } = require('./smtpService');
const { Role, User } = require('../models');

const DEFAULT_ROLES = [
  {
    name: 'ADMIN',
    displayName: 'Administrator',
    description: 'System administrator with full access',
    level: 1,
    isActive: true,
    isSystemRole: true
  },
  {
    name: 'MANAGER',
    displayName: 'Manager',
    description: 'Operations manager with delegated permissions',
    level: 2,
    isActive: true,
    isSystemRole: true
  },
  {
    name: 'INSTRUCTOR',
    displayName: 'Instructor',
    description: 'Instructor role for class and content management',
    level: 3,
    isActive: true,
    isSystemRole: true
  },
  {
    name: 'STUDENT',
    displayName: 'Student',
    description: 'Student role for course participation',
    level: 4,
    isActive: true,
    isSystemRole: true
  }
];

const isValidTimezone = (value) => {
  if (!value || typeof value !== 'string') return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
};

const ensureDefaultRoles = async () => {
  for (const roleData of DEFAULT_ROLES) {
    await Role.findOneAndUpdate(
      { name: roleData.name },
      roleData,
      { upsert: true, new: true }
    );
  }
};

const ensureAdminUser = async (adminInput) => {
  const adminRole = await Role.findOne({ name: 'ADMIN' });
  if (!adminRole) {
    throw new Error('Failed to create ADMIN role');
  }

  const email = String(adminInput.email || '').trim().toLowerCase();
  const firstName = String(adminInput.firstName || '').trim();
  const lastName = String(adminInput.lastName || '').trim();
  const password = String(adminInput.password || '');

  if (!email || !firstName || !lastName || password.length < 8) {
    throw new Error('Admin email, name, and password (min 8 chars) are required');
  }

  let adminUser = await User.findOne({ email });
  if (!adminUser) {
    adminUser = new User({
      email,
      firstName,
      lastName,
      password,
      roleId: adminRole._id,
      isActive: true,
      isEmailVerified: true
    });
    await adminUser.save();
    return adminUser;
  }

  adminUser.firstName = firstName;
  adminUser.lastName = lastName;
  adminUser.password = password;
  adminUser.roleId = adminRole._id;
  adminUser.isActive = true;
  adminUser.isEmailVerified = true;
  await adminUser.save();
  return adminUser;
};

class SetupService {
  async getStatus() {
    await telemetryLicensingService.ensureIdentity();
    const setupSettings = await systemSettingsStore.getSetupSettings();
    const adminRole = await Role.findOne({ name: 'ADMIN' }).lean();
    const adminExists = adminRole
      ? Boolean(await User.exists({ roleId: adminRole._id, isActive: true }))
      : false;

    // Auto-heal setup flag if settings file was reset but an active ADMIN already exists.
    let completed = Boolean(setupSettings?.completed && adminExists);
    if (!completed && adminExists) {
      const healedSetup = {
        completed: true,
        completedAt: setupSettings?.completedAt || new Date().toISOString(),
        completedBy: setupSettings?.completedBy || null
      };
      await systemSettingsStore.updateSetupSettings(healedSetup);
      completed = true;
    }

    return {
      completed,
      completedAt: setupSettings?.completedAt || null,
      hasAdmin: adminExists,
      appName: setupSettings?.branding?.appName || 'Institute LMS',
      whiteLabelEnabled: Boolean(setupSettings?.branding?.whiteLabelEnabled),
      watermarkForced: true
    };
  }

  async getPrefill() {
    const [setupSettings, databaseSettings, smtpSettings] = await Promise.all([
      systemSettingsStore.getSetupSettings(),
      databaseSettingsService.getDatabaseSettings({ includeSecrets: true }),
      smtpService.getSettings({ includeSecrets: true })
    ]);

    return {
      setup: setupSettings,
      database: databaseSettings,
      smtp: smtpSettings
    };
  }

  async completeSetup(payload) {
    const status = await this.getStatus();
    if (status.completed) {
      throw new Error('Setup is already completed');
    }

    const timezone = payload?.defaults?.timezone || 'UTC';
    if (!isValidTimezone(timezone)) {
      throw new Error('Invalid timezone');
    }

    const databasePayload = payload?.database;
    if (databasePayload) {
      await databaseSettingsService.updateDatabaseSettings(databasePayload, {
        updatedBy: null
      });
    }

    const smtpPayload = payload?.smtp;
    if (smtpPayload && typeof smtpPayload === 'object') {
      await smtpService.updateSettings(smtpPayload, { updatedBy: null });
    }

    await ensureDefaultRoles();
    const adminUser = await ensureAdminUser(payload?.admin || {});

    const nextSetup = {
      completed: true,
      completedAt: new Date().toISOString(),
      completedBy: adminUser._id.toString(),
      institute: {
        name: String(payload?.institute?.name || 'Institute').trim(),
        website: String(payload?.institute?.website || '').trim(),
        supportEmail: String(payload?.institute?.supportEmail || '').trim(),
        supportPhone: String(payload?.institute?.supportPhone || '').trim(),
        address: String(payload?.institute?.address || '').trim()
      },
      branding: {
        appName: String(payload?.branding?.appName || 'Institute LMS').trim(),
        logoUrl: String(payload?.branding?.logoUrl || '').trim(),
        faviconUrl: String(payload?.branding?.faviconUrl || payload?.branding?.logoUrl || '').trim(),
        primaryColor: String(payload?.branding?.primaryColor || '#2563EB').trim(),
        accentColor: String(payload?.branding?.accentColor || '#0EA5E9').trim(),
        whiteLabelEnabled: Boolean(payload?.branding?.whiteLabelEnabled),
        // Always keep brand watermark enabled.
        showCoderCrafterWatermark: true
      },
      defaults: {
        timezone,
        dateFormat: String(payload?.defaults?.dateFormat || 'YYYY-MM-DD').trim(),
        timeFormat: String(payload?.defaults?.timeFormat || '24h').trim(),
        locale: String(payload?.defaults?.locale || 'en-US').trim()
      },
      customDomains: []
    };

    await telemetryLicensingService.updateStatusMetadata({
      edition: 'SELF_HOSTED',
      licenseType: 'FREE',
      status: 'ACTIVE',
      planCode: 'free_self_hosted',
      metadata: {
        deploymentTag: 'self_hosted'
      }
    });

    await systemSettingsStore.updateSetupSettings(nextSetup);

    await telemetryLicensingService.ensureIdentity({
      activate: true,
      instituteName: nextSetup.institute.name,
      timezone: nextSetup.defaults.timezone
    });
    // Push first heartbeat immediately after successful setup so control-plane
    // reflects this instance without waiting for the next cron window.
    await telemetryLicensingService.syncHeartbeatNow('setup_completed');
    return this.getStatus();
  }
}

module.exports = {
  setupService: new SetupService()
};
