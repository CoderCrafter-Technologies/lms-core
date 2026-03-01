const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const crypto = require('crypto');
const net = require('net');
const { execFile } = require('child_process');
const fsPromises = require('fs/promises');
const { setupService } = require('../services/setupService');
const systemSettingsStore = require('../services/systemSettingsStore');
const { smtpService } = require('../services/smtpService');
const { requestJson } = require('../utils/httpJson');

const router = express.Router();
const setupBrandingUploadPath = path.join(__dirname, '../../uploads/setup-branding');
fs.mkdirSync(setupBrandingUploadPath, { recursive: true });

const setupBrandingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, setupBrandingUploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '.png';
    cb(null, `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const setupBrandingUpload = multer({
  storage: setupBrandingStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

const completeSetupValidation = [
  body('institute.name').trim().notEmpty().withMessage('Institute name is required'),
  body('admin.email').isEmail().withMessage('Valid admin email is required'),
  body('admin.firstName').trim().notEmpty().withMessage('Admin first name is required'),
  body('admin.lastName').trim().notEmpty().withMessage('Admin last name is required'),
  body('admin.password')
    .isLength({ min: 8 })
    .withMessage('Admin password must be at least 8 characters'),
  body('defaults.timezone').trim().notEmpty().withMessage('Default timezone is required'),
  body('database.mode')
    .isIn(['mongodb', 'postgres_uri', 'postgres_same_server'])
    .withMessage('Valid database mode is required'),
  body('smtp.enabled').optional().isBoolean(),
  body('smtp.host').optional().trim(),
  body('smtp.port').optional().isInt({ min: 1, max: 65535 }),
  body('smtp.fromEmail').optional().isEmail(),
];

const normalizeDomain = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutProtocol = raw.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0];
  const withoutPort = withoutPath.replace(/:\d+$/, '');
  return withoutPort.trim();
};

const getDnsHostLabel = (domain = '') => {
  const normalized = normalizeDomain(domain);
  if (!normalized) return '@';
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length <= 2) return '@';
  return parts.slice(0, -2).join('.');
};

const getTxtHostLabel = (domain = '') => {
  const normalized = normalizeDomain(domain);
  if (!normalized) return '_lms-verify';
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length <= 2) return '_lms-verify';
  const sub = parts.slice(0, -2).join('.');
  return `_lms-verify.${sub}`;
};

const upsertCustomDomain = (customDomains = [], entry) => {
  const filtered = (customDomains || []).filter((item) => item?.domain !== entry.domain);
  return [...filtered, entry];
};

const removeCustomDomain = (customDomains = [], domain) =>
  (customDomains || []).filter((item) => item?.domain !== domain);

const detectServerIp = async () => {
  const services = [
    'https://api.ipify.org?format=json',
    'https://ifconfig.co/json',
    'https://ipinfo.io/json'
  ];

  for (const url of services) {
    try {
      const result = await requestJson({ url, timeoutMs: 6000 });
      const ip = result?.data?.ip || result?.data?.ip_addr || result?.data?.address;
      if (result.ok && ip && net.isIP(ip)) {
        return { ip, source: url };
      }
    } catch {
      // try next service
    }
  }

  return { ip: '', source: '' };
};

const getNginxConfig = ({ domain, frontendPort, backendPort }) => {
  const safeDomain = String(domain || '').trim();
  const fePort = Number(frontendPort || process.env.NGINX_FRONTEND_PORT || 3001);
  const bePort = Number(backendPort || process.env.NGINX_BACKEND_PORT || 5001);
  return `
server {
  listen 80;
  server_name ${safeDomain};

  client_max_body_size 50M;

  location / {
    proxy_pass http://127.0.0.1:${fePort};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:${bePort};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:${bePort};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
`.trim();
};

const getCaddyfile = ({ domain, email, frontendUpstream, backendUpstream }) => {
  const safeDomain = String(domain || '').trim();
  const safeEmail = String(email || '').trim();
  const fe = String(frontendUpstream || 'frontend:3000').trim();
  const be = String(backendUpstream || 'backend:5000').trim();
  return `
{
  email ${safeEmail}
}

${safeDomain} {
  encode gzip

  @api path /api/*
  reverse_proxy @api http://${be}

  @uploads path /uploads/*
  reverse_proxy @uploads http://${be}

  @socket path /socket.io/*
  reverse_proxy @socket http://${be}

  reverse_proxy http://${fe}
}
`.trim();
};

const postText = async (url, text, contentType = 'text/plain') => {
  const body = String(text || '');
  return requestJson({
    method: 'POST',
    url,
    headers: {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(body)
    },
    body
  });
};

router.get('/status', async (req, res, next) => {
  try {
    const status = await setupService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

router.get('/prefill', async (req, res, next) => {
  try {
    const data = await setupService.getPrefill();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});


router.get('/public-settings', async (req, res, next) => {
  try {
    const status = await setupService.getStatus();
    const publicSettings = await systemSettingsStore.getPublicAppSettings();
    res.json({
      success: true,
      data: {
        ...publicSettings,
        completed: status.completed,
        watermark: {
          text: 'Powered by CoderCrafter',
          forceVisible: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/brand-assets',
  setupBrandingUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
  ]),
  async (req, res) => {
    const files = req.files || {};
    const logo = files.logo?.[0];
    const favicon = files.favicon?.[0];

    const logoUrl = logo ? `/uploads/setup-branding/${logo.filename}` : '';
    const faviconUrl = favicon
      ? `/uploads/setup-branding/${favicon.filename}`
      : (logoUrl || '');

    return res.status(201).json({
      success: true,
      message: 'Brand assets uploaded successfully',
      data: {
        logoUrl,
        faviconUrl
      }
    });
  }
);

router.post('/smtp/test', async (req, res) => {
  try {
    await smtpService.testConnection(req.body || {});
    const testEmail = String(req.body?.testEmail || '').trim();
    if (testEmail) {
      await smtpService.sendMail({
        to: testEmail,
        subject: 'LMS setup SMTP test',
        html: '<p>Your SMTP configuration is working.</p>'
      }, req.body || {});
    }
    return res.json({
      success: true,
      message: testEmail
        ? `SMTP verified and test email sent to ${testEmail}`
        : 'SMTP connection verified'
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'SMTP test failed'
    });
  }
});

router.post('/custom-domains/prepare', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  let serverIp = String(req.body?.serverIp || '').trim();

  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  if (!serverIp) {
    const detected = await detectServerIp();
    serverIp = detected.ip || '';
  }

  if (serverIp && net.isIP(serverIp) === 0) {
    return res.status(400).json({ success: false, message: 'Server IP must be a valid IP address' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const existing = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);
  const token = existing?.verificationToken || crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();

  const entry = {
    domain,
    status: existing?.status || 'pending',
    verificationToken: token,
    expectedIp: serverIp || existing?.expectedIp || '',
    createdAt: existing?.createdAt || now,
    verifiedAt: existing?.verifiedAt || null,
    lastCheckedAt: existing?.lastCheckedAt || null
  };

  const updatedDomains = upsertCustomDomain(setupSettings?.customDomains || [], entry);
  await systemSettingsStore.updateSetupSettings({ customDomains: updatedDomains });

  const records = [
    ...(entry.expectedIp
      ? [{ type: 'A', host: getDnsHostLabel(entry.domain), value: entry.expectedIp }]
      : []),
    { type: 'TXT', host: getTxtHostLabel(entry.domain), value: entry.verificationToken }
  ];

  return res.json({
    success: true,
    data: {
      domain: entry.domain,
      status: entry.status,
      expectedIp: entry.expectedIp,
      verificationToken: entry.verificationToken,
      records
    }
  });
});

router.get('/server-ip', async (_req, res) => {
  const detected = await detectServerIp();
  if (detected.ip) {
    return res.json({ success: true, data: { ip: detected.ip, source: detected.source } });
  }

  return res.status(500).json({
    success: false,
    message: 'Unable to detect server public IP'
  });
});

router.post('/custom-domains/verify', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  const serverIp = String(req.body?.serverIp || '').trim();

  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  if (serverIp && net.isIP(serverIp) === 0) {
    return res.status(400).json({ success: false, message: 'Server IP must be a valid IP address' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const existing = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Domain not prepared yet' });
  }

  const expectedIp = serverIp || existing?.expectedIp || '';
  let txtMatch = false;
  let aMatch = !expectedIp;
  let txtError = null;
  let aError = null;

  try {
    const txtRecords = await dns.resolveTxt(`_lms-verify.${domain}`);
    const flattened = txtRecords.flat().map((v) => String(v || '').trim());
    txtMatch = flattened.includes(String(existing.verificationToken || '').trim());
  } catch {
    txtMatch = false;
    txtError = 'TXT lookup failed';
  }

  if (expectedIp) {
    try {
      const aRecords = await dns.resolve4(domain);
      aMatch = aRecords.includes(expectedIp);
    } catch {
      aMatch = false;
      aError = 'A lookup failed';
    }
  }

  const verified = Boolean(txtMatch && aMatch);
  const now = new Date().toISOString();

  const updatedEntry = {
    ...existing,
    expectedIp: expectedIp || existing.expectedIp || '',
    status: verified ? 'verified' : 'pending',
    verifiedAt: verified ? now : existing.verifiedAt || null,
    lastCheckedAt: now
  };

  const updatedDomains = upsertCustomDomain(setupSettings?.customDomains || [], updatedEntry);
  await systemSettingsStore.updateSetupSettings({ customDomains: updatedDomains });

  return res.json({
    success: true,
    data: {
      domain,
      verified,
      checks: {
        txt: txtMatch,
        a: expectedIp ? aMatch : null,
        txtError,
        aError,
        expectedTxtHost: `_lms-verify.${domain}`,
        expectedAHost: domain
      },
      status: updatedEntry.status,
      lastCheckedAt: updatedEntry.lastCheckedAt
    }
  });
});

router.post('/custom-domains/diagnose', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const existing = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Domain not prepared yet' });
  }

  const expectedIp = existing?.expectedIp || '';
  const expectedToken = String(existing?.verificationToken || '').trim();
  const expectedTxtHost = `_lms-verify.${domain}`;
  const now = new Date().toISOString();

  let txtRecords = [];
  let aRecords = [];
  let txtError = null;
  let aError = null;

  try {
    const rawTxt = await dns.resolveTxt(expectedTxtHost);
    txtRecords = rawTxt.flat().map((v) => String(v || '').trim()).filter(Boolean);
  } catch (error) {
    txtError = error?.message || 'TXT lookup failed';
  }

  if (expectedIp) {
    try {
      aRecords = await dns.resolve4(domain);
    } catch (error) {
      aError = error?.message || 'A lookup failed';
    }
  }

  const txtMatch = expectedToken ? txtRecords.includes(expectedToken) : false;
  const aMatch = expectedIp ? aRecords.includes(expectedIp) : true;

  return res.json({
    success: true,
    data: {
      checkedAt: now,
      domain,
      expected: {
        aHost: domain,
        aValue: expectedIp || null,
        txtHost: expectedTxtHost,
        txtValue: expectedToken || null
      },
      resolved: {
        aRecords,
        txtRecords
      },
      matches: {
        a: aMatch,
        txt: txtMatch
      },
      errors: {
        a: aError,
        txt: txtError
      }
    }
  });
});

router.post('/custom-domains/nginx-config', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  const config = getNginxConfig({
    domain,
    frontendPort: req.body?.frontendPort,
    backendPort: req.body?.backendPort
  });

  return res.json({
    success: true,
    data: {
      domain,
      config
    }
  });
});

router.post('/custom-domains/enable-ssl', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  const email = String(req.body?.email || '').trim();
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required for certbot' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const entry = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);
  if (!entry || entry.status !== 'verified') {
    return res.status(400).json({ success: false, message: 'Domain must be verified before enabling SSL' });
  }

  const command = ['certbot', '--nginx', '-d', domain, '--non-interactive', '--agree-tos', '-m', email, '--redirect'];

  if (process.env.ENABLE_CERTBOT_AUTOMATION !== 'true') {
    return res.status(200).json({
      success: true,
      data: {
        automated: false,
        command: command.join(' ')
      },
      message: 'Automation is disabled. Run the command on your server to enable SSL.'
    });
  }

  execFile(command[0], command.slice(1), { timeout: 120000 }, async (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Certbot failed',
        error: String(stderr || error.message || 'Unknown error').trim()
      });
    }

    const now = new Date().toISOString();
    const updated = {
      ...entry,
      sslStatus: 'enabled',
      sslEnabledAt: now,
      sslLastError: ''
    };
    const updatedDomains = upsertCustomDomain(setupSettings?.customDomains || [], updated);
    await systemSettingsStore.updateSetupSettings({ customDomains: updatedDomains });

    return res.json({
      success: true,
      data: {
        automated: true,
        output: String(stdout || '').trim()
      },
      message: 'SSL enabled successfully'
    });
  });
});

router.post('/custom-domains/apply-caddy', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const entry = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);
  if (!entry || entry.status !== 'verified') {
    return res.status(400).json({ success: false, message: 'Domain must be verified before applying Caddy config' });
  }

  const supportEmail = String(req.body?.email || setupSettings?.institute?.supportEmail || '').trim();
  if (!supportEmail) {
    return res.status(400).json({ success: false, message: 'Institute support email is required to enable HTTPS' });
  }

  const frontendUpstream = process.env.CADDY_FRONTEND_UPSTREAM || 'frontend:3000';
  const backendUpstream = process.env.CADDY_BACKEND_UPSTREAM || 'backend:5000';
  const caddyfile = getCaddyfile({
    domain,
    email: supportEmail,
    frontendUpstream,
    backendUpstream
  });

  const caddyfilePath = process.env.CADDYFILE_PATH || '/app/caddy/Caddyfile';
  await fsPromises.mkdir(require('path').dirname(caddyfilePath), { recursive: true });
  await fsPromises.writeFile(caddyfilePath, `${caddyfile}\n`, 'utf8');

  const adminUrl = process.env.CADDY_ADMIN_URL || 'http://caddy:2019';
  const reloadUrl = `${adminUrl.replace(/\/$/, '')}/load?adapter=caddyfile`;

  let reloadResult;
  try {
    reloadResult = await postText(reloadUrl, caddyfile, 'text/caddyfile');
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'Caddy admin API is not reachable. Ensure the caddy service is running.',
      error: error?.message || String(error)
    });
  }
  if (!reloadResult.ok) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reload Caddy',
      error: reloadResult.data || reloadResult.status
    });
  }

  const now = new Date().toISOString();
  const updated = {
    ...entry,
    caddyAppliedAt: now,
    caddyLastError: ''
  };
  const updatedDomains = upsertCustomDomain(setupSettings?.customDomains || [], updated);
  await systemSettingsStore.updateSetupSettings({ customDomains: updatedDomains });

  return res.json({
    success: true,
    message: 'Caddy configuration applied successfully'
  });
});

router.post('/custom-domains/save', async (req, res) => {
  const domain = normalizeDomain(req.body?.domain || '');
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const entry = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);
  if (!entry) {
    return res.status(404).json({ success: false, message: 'Domain not found' });
  }
  if (entry.status !== 'verified') {
    return res.status(400).json({ success: false, message: 'Verify DNS before saving domain' });
  }

  const now = new Date().toISOString();
  const updated = {
    ...entry,
    savedAt: now
  };
  const updatedDomains = upsertCustomDomain(setupSettings?.customDomains || [], updated);
  await systemSettingsStore.updateSetupSettings({ customDomains: updatedDomains });

  return res.json({
    success: true,
    message: 'Domain saved successfully',
    data: updated
  });
});

router.delete('/custom-domains/:domain', async (req, res) => {
  const domain = normalizeDomain(req.params?.domain || '');
  if (!domain) {
    return res.status(400).json({ success: false, message: 'Domain is required' });
  }

  const setupSettings = await systemSettingsStore.getSetupSettings();
  const existing = (setupSettings?.customDomains || []).find((item) => item?.domain === domain);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Domain not found' });
  }

  const updatedDomains = removeCustomDomain(setupSettings?.customDomains || [], domain);
  await systemSettingsStore.updateSetupSettings({ customDomains: updatedDomains });

  return res.json({
    success: true,
    message: 'Domain removed successfully'
  });
});

router.post('/complete', completeSetupValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const status = await setupService.completeSetup(req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Setup completed successfully',
      data: status
    });
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('already completed')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to complete setup'
    });
  }
});

module.exports = router;
