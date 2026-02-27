const nodemailer = require('nodemailer');
const systemSettingsStore = require('./systemSettingsStore');

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const toNum = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeHost = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    if (raw.includes('://')) {
      const parsed = new URL(raw);
      return String(parsed.hostname || '').trim().toLowerCase();
    }
  } catch {
    // fallback below
  }

  const withoutPath = raw.split('/')[0];
  const withoutPort = withoutPath.split(':')[0];
  return String(withoutPort || '').trim().toLowerCase();
};

const normalizeSmtpSettings = (incoming = {}) => {
  const base = {
    enabled: toBool(incoming.enabled, false),
    provider: String(incoming.provider || 'smtp').trim().toLowerCase() || 'smtp',
    host: normalizeHost(incoming.host),
    port: toNum(incoming.port, 587),
    secure: toBool(incoming.secure, false),
    requireTLS: toBool(incoming.requireTLS, false),
    authUser: String(incoming.authUser || '').trim(),
    authPass: String(incoming.authPass || '').trim(),
    fromName: String(incoming.fromName || 'LMS').trim(),
    fromEmail: String(incoming.fromEmail || '').trim(),
    replyTo: String(incoming.replyTo || '').trim(),
    pool: toBool(incoming.pool, true),
    maxConnections: toNum(incoming.maxConnections, 5),
    maxMessages: toNum(incoming.maxMessages, 100),
    rateDeltaMs: toNum(incoming.rateDeltaMs, 1000),
    rateLimit: toNum(incoming.rateLimit, 10),
    rejectUnauthorized: false,
    updatedAt: incoming.updatedAt || null,
    updatedBy: incoming.updatedBy || null
  };
  return base;
};

const shouldForceAuthSender = () =>
  String(process.env.SMTP_FORCE_AUTH_SENDER || 'true').toLowerCase() === 'true';

const resolveFromEmail = (settings) => {
  const configured = String(settings.fromEmail || '').trim().toLowerCase();
  const authUser = String(settings.authUser || '').trim().toLowerCase();
  const forceAuthSender = shouldForceAuthSender();
  if (forceAuthSender && authUser) return authUser;
  return configured || authUser;
};

class SmtpService {
  async getSettings({ includeSecrets = false } = {}) {
    const saved = await systemSettingsStore.getSmtpSettings();
    const normalized = normalizeSmtpSettings(saved || {});

    // Env fallback only if not configured in settings
    if (!normalized.host && process.env.SMTP_HOST) normalized.host = process.env.SMTP_HOST;
    if (!saved?.port && process.env.SMTP_PORT) normalized.port = toNum(process.env.SMTP_PORT, normalized.port);
    if (!saved?.authUser && process.env.SMTP_USER) normalized.authUser = process.env.SMTP_USER;
    if (!saved?.authPass && process.env.SMTP_PASS) normalized.authPass = process.env.SMTP_PASS;
    if (!saved?.fromEmail && process.env.EMAIL_FROM) normalized.fromEmail = process.env.EMAIL_FROM;
    if (!saved?.enabled) normalized.enabled = toBool(process.env.SMTP_ENABLED, normalized.enabled);

    if (!includeSecrets) {
      return { ...normalized, authPass: normalized.authPass ? '********' : '' };
    }
    return normalized;
  }

  validateSettings(settings) {
    if (!settings.enabled) return;
    if (!settings.host) throw new Error('SMTP host is required when SMTP is enabled.');
    if (!settings.port || settings.port < 1 || settings.port > 65535) throw new Error('SMTP port must be between 1 and 65535.');
    if (!settings.authUser) throw new Error('SMTP username is required when SMTP is enabled.');
    if (!settings.authPass) throw new Error('SMTP password is required when SMTP is enabled.');
    if (!resolveFromEmail(settings)) throw new Error('From email or SMTP username is required when SMTP is enabled.');
  }

  async updateSettings(patch = {}, { updatedBy = null } = {}) {
    const current = await this.getSettings({ includeSecrets: true });
    const next = normalizeSmtpSettings({
      ...current,
      ...patch,
      authPass: patch.authPass ? String(patch.authPass) : current.authPass,
      updatedAt: new Date().toISOString(),
      updatedBy
    });
    if (shouldForceAuthSender() && next.authUser) {
      next.fromEmail = next.authUser;
    }
    this.validateSettings(next);
    return systemSettingsStore.updateSmtpSettings(next);
  }

  buildTransportOptions(settings) {
    return {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: settings.requireTLS,
      auth: {
        user: settings.authUser,
        pass: settings.authPass
      },
      pool: settings.pool,
      maxConnections: settings.maxConnections,
      maxMessages: settings.maxMessages,
      rateDelta: settings.rateDeltaMs,
      rateLimit: settings.rateLimit,
      tls: {
        rejectUnauthorized: false
      }
    };
  }

  async createTransporter(settingsOverride = null) {
    const settings = settingsOverride || (await this.getSettings({ includeSecrets: true }));
    this.validateSettings(settings);
    return nodemailer.createTransport(this.buildTransportOptions(settings));
  }

  async testConnection(settingsOverride = null) {
    const settings = settingsOverride
      ? normalizeSmtpSettings(settingsOverride)
      : await this.getSettings({ includeSecrets: true });
    this.validateSettings(settings);
    const transporter = await this.createTransporter(settings);
    await transporter.verify();
    return { success: true };
  }

  async sendMail(payload, settingsOverride = null) {
    const settings = settingsOverride
      ? normalizeSmtpSettings(settingsOverride)
      : await this.getSettings({ includeSecrets: true });
    if (!settings.enabled) {
      return { success: false, skipped: true, message: 'SMTP is disabled' };
    }

    this.validateSettings(settings);
    const transporter = await this.createTransporter(settings);
    const effectiveFromEmail = resolveFromEmail(settings);
    const info = await transporter.sendMail({
      from: `"${settings.fromName || 'LMS'}" <${effectiveFromEmail}>`,
      replyTo: settings.replyTo || undefined,
      ...payload
    });
    return { success: true, messageId: info.messageId };
  }
}

module.exports = {
  smtpService: new SmtpService(),
  normalizeSmtpSettings
};
