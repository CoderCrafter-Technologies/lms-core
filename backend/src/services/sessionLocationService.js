const net = require('net');
const { requestJson } = require('../utils/httpJson');

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const cache = new Map();
const inFlight = new Map();

const GEO_LOOKUP_ENABLED = String(process.env.ENABLE_SESSION_GEO_LOOKUP || 'true').toLowerCase() === 'true';

const normalizeIp = (value) => {
  let ip = String(value || '').trim();
  if (!ip) return '';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'));
  }
  ip = ip.split('%')[0];
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }
  return net.isIP(ip) ? ip : '';
};

const isPrivateIp = (ip) => {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '0.0.0.0') return true;

  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map((v) => Number(v));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  const lower = ip.toLowerCase();
  return (
    lower === '::1'
    || lower.startsWith('fc')
    || lower.startsWith('fd')
    || lower.startsWith('fe80')
  );
};

const formatLocation = (city, region, country) => {
  const parts = [city, region, country]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : 'Unknown location';
};

const readIpApiLocation = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  if (payload?.error || payload?.reserved || payload?.bogon) return '';
  return formatLocation(payload.city, payload.region || payload.region_name, payload.country_name || payload.country);
};

const readIpWhoIsLocation = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  if (payload?.success === false) return '';
  return formatLocation(payload.city, payload.region, payload.country);
};

const fetchRemoteLocation = async (ip) => {
  const providers = [
    {
      url: `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      parser: readIpApiLocation
    },
    {
      url: `https://ipwho.is/${encodeURIComponent(ip)}`,
      parser: readIpWhoIsLocation
    }
  ];

  for (const provider of providers) {
    try {
      const result = await requestJson({ url: provider.url, timeoutMs: 1600 });
      if (!result?.ok) continue;
      const location = provider.parser(result.data);
      if (location) return location;
    } catch {
      // try next provider
    }
  }
  return 'Unknown location';
};

const resolveIpLocation = async (rawIp) => {
  const ip = normalizeIp(rawIp);
  if (!ip) return 'Unknown location';
  if (isPrivateIp(ip)) return 'Local Network';
  if (!GEO_LOOKUP_ENABLED) return 'Location lookup disabled';

  const now = Date.now();
  const cached = cache.get(ip);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (inFlight.has(ip)) {
    return inFlight.get(ip);
  }

  const pending = (async () => {
    const location = await fetchRemoteLocation(ip);
    cache.set(ip, { value: location, expiresAt: now + CACHE_TTL_MS });
    return location;
  })()
    .finally(() => {
      inFlight.delete(ip);
    });

  inFlight.set(ip, pending);
  return pending;
};

module.exports = {
  resolveIpLocation
};

