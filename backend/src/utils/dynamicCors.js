const systemSettingsStore = require('../services/systemSettingsStore');

const DEFAULT_TTL_MS = 30000;

const normalizeOrigin = (origin = '') => {
  const raw = String(origin || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;
  } catch {
    return raw.replace(/\/$/, '').toLowerCase();
  }
};

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

const isIpOrLocalhost = (origin = '') => {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
};

const cache = {
  origins: [],
  expiresAt: 0,
  refreshing: null,
  setupCompleted: false,
  strictMode: false
};

const isProduction = () => String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const strictCorsAfterSetup = () =>
  String(process.env.STRICT_CORS_AFTER_SETUP || 'true').toLowerCase() !== 'false';

const toOriginsFromWebsite = (website = '') => {
  const raw = String(website || '').trim();
  if (!raw) return [];
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    const base = `${parsed.protocol}//${parsed.host}`;
    // Include both schemes so HTTP->HTTPS transition during setup does not break.
    const alt = parsed.protocol === 'https:' ? `http://${parsed.host}` : `https://${parsed.host}`;
    return [base, alt];
  } catch {
    return [];
  }
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
      cache.strictMode = cache.setupCompleted && strictCorsAfterSetup();
      const activeDomains = customDomains.filter((entry) => entry?.savedAt || entry?.status === 'verified');
      const instituteWebsiteOrigins = toOriginsFromWebsite(setupSettings?.institute?.website || '');
      const origins = [
        ...buildOriginsFromEnv(),
        ...instituteWebsiteOrigins,
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
  if (!cache.strictMode) return true;

  if (!isProduction() && isIpOrLocalhost(origin)) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const allowed = getAllowedOrigins();
  if (!allowed.length) return false;
  return allowed.includes(normalized);
};

const ensureFreshCache = () => {
  if (Date.now() > cache.expiresAt && !cache.refreshing) {
    refreshAllowedOrigins().catch(() => null);
  }
};

const getRequestHost = (req) => {
  const forwarded = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase();
  const direct = String(req?.headers?.host || '').trim().toLowerCase();
  return forwarded || direct;
};

const getOriginHost = (origin = '') => {
  try {
    return new URL(String(origin || '').trim()).host.toLowerCase();
  } catch {
    return '';
  }
};

const isSameHostOrigin = (origin, req) => {
  const requestHost = getRequestHost(req);
  const originHost = getOriginHost(origin);
  if (!requestHost || !originHost) return false;
  return requestHost === originHost;
};

const isSetupRoute = (req) => String(req?.path || '').startsWith('/api/setup/');

const evaluateOrigin = (origin, req, callback) => {
  const runCheck = () => {
    // Setup stays fully public only until initial setup is completed.
    if (isSetupRoute(req) && !cache.strictMode) {
      callback(null, true);
      return;
    }
    if (isSameHostOrigin(origin, req)) {
      callback(null, true);
      return;
    }
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  };

  if (Date.now() > cache.expiresAt || cache.refreshing) {
    refreshAllowedOrigins()
      .catch(() => null)
      .finally(runCheck);
    return;
  }

  runCheck();
};

const corsOptions = {
  origin: (origin, callback) => {
    ensureFreshCache();
    evaluateOrigin(origin, null, callback);
  },
  credentials: true
};

const corsOptionsDelegate = (req, callback) => {
  ensureFreshCache();
  const origin = String(req?.headers?.origin || '');
  evaluateOrigin(origin, req, (error, allow) => {
    callback(error, {
      origin: allow,
      credentials: true
    });
  });
};

const socketCorsOptions = {
  origin: (origin, callback) => {
    ensureFreshCache();
    evaluateOrigin(origin, null, callback);
  },
  credentials: true
};

module.exports = {
  refreshAllowedOrigins,
  getAllowedOrigins,
  corsOptions,
  corsOptionsDelegate,
  socketCorsOptions
};
