const systemSettingsStore = require('../services/systemSettingsStore');

const DEFAULT_TTL_MS = 30000;

const normalizeOrigin = (origin = '') => String(origin || '').trim().replace(/\/$/, '');

const normalizeDomain = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0];
  const withoutPort = withoutPath.replace(/:\d+$/, '');
  return withoutPort.trim();
};

const buildOriginsFromDomains = (domains = []) =>
  domains
    .map((entry) => normalizeDomain(entry?.domain || ''))
    .filter(Boolean)
    .flatMap((domain) => [`https://${domain}`, `http://${domain}`]);

const buildOriginsFromEnv = () =>
  String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const cache = {
  origins: [],
  expiresAt: 0,
  refreshing: null,
  setupCompleted: false,
  hasCustomDomain: false
};

const refreshAllowedOrigins = async () => {
  if (cache.refreshing) {
    return cache.refreshing;
  }

  cache.refreshing = (async () => {
    try {
      const setupSettings = await systemSettingsStore.getSetupSettings();
      const customDomains = Array.isArray(setupSettings?.customDomains)
        ? setupSettings.customDomains
        : [];
      cache.setupCompleted = Boolean(setupSettings?.completed);
      const activeDomains = customDomains.filter((entry) => entry?.savedAt || entry?.status === 'verified');
      cache.hasCustomDomain = activeDomains.length > 0;
      const origins = [
        ...buildOriginsFromEnv(),
        ...buildOriginsFromDomains(activeDomains)
      ]
        .map(normalizeOrigin)
        .filter(Boolean);

      cache.origins = Array.from(new Set(origins));
      cache.expiresAt = Date.now() + DEFAULT_TTL_MS;
    } finally {
      cache.refreshing = null;
    }
  })();

  return cache.refreshing;
};

const getAllowedOrigins = () => cache.origins;

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!cache.setupCompleted) return true;
  if (!cache.hasCustomDomain) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  const allowed = getAllowedOrigins();
  if (!allowed.length) return true;
  return allowed.includes(normalized);
};

const ensureFreshCache = () => {
  if (Date.now() > cache.expiresAt && !cache.refreshing) {
    refreshAllowedOrigins().catch(() => null);
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    ensureFreshCache();
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

const socketCorsOptions = {
  origin: (origin, callback) => {
    ensureFreshCache();
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

module.exports = {
  refreshAllowedOrigins,
  getAllowedOrigins,
  corsOptions,
  socketCorsOptions
};
