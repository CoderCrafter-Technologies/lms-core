const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID, randomInt, createHash } = require('crypto');
const { body, validationResult } = require('express-validator');

const config = require('../config');
const { userRepository, roleRepository, refreshSessionRepository } = require('../repositories');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();
const REFRESH_COOKIE_NAME = 'refreshToken';
const REGISTRATION_OTP_EXP_MINUTES = Math.max(3, Number(process.env.REGISTRATION_OTP_EXP_MINUTES || 10));
const PASSWORD_SETUP_OTP_EXP_MINUTES = Math.max(3, Number(process.env.PASSWORD_SETUP_OTP_EXP_MINUTES || 10));
const FORGOT_PASSWORD_OTP_EXP_MINUTES = Math.max(3, Number(process.env.FORGOT_PASSWORD_OTP_EXP_MINUTES || 10));

const createAccessToken = (user) => jwt.sign(
  { userId: user.id, email: user.email, type: 'access' },
  config.jwt.secret,
  { expiresIn: config.jwt.expiresIn }
);

const createRefreshToken = (user, sessionId, tokenVersion) => jwt.sign(
  { userId: user.id, email: user.email, type: 'refresh', sid: sessionId, ver: tokenVersion },
  config.jwt.refreshSecret,
  { expiresIn: config.jwt.refreshExpiresIn }
);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeLegacyGmailEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email.includes('@')) return email;
  const [localRaw, domainRaw] = email.split('@');
  const domain = String(domainRaw || '').trim().toLowerCase();
  if (!localRaw || !['gmail.com', 'googlemail.com'].includes(domain)) {
    return email;
  }
  const local = String(localRaw).split('+')[0].replace(/\./g, '');
  return `${local}@gmail.com`;
};
const hashOtpCode = (code) => createHash('sha256').update(String(code || '')).digest('hex');
const generateOtpCode = () => String(randomInt(100000, 1000000));

const parseExpiryToMs = (value) => {
  if (typeof value === 'number') return value * 1000;
  if (!value || typeof value !== 'string') return 7 * 24 * 60 * 60 * 1000;

  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * unitMs[unit];
};

const getRefreshCookieOptions = () => {
  const isProduction = config.nodeEnv === 'production';
  const sameSite = process.env.JWT_REFRESH_COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax');
  const secure = process.env.JWT_REFRESH_COOKIE_SECURE
    ? process.env.JWT_REFRESH_COOKIE_SECURE === 'true'
    : isProduction;
  const domain = process.env.JWT_REFRESH_COOKIE_DOMAIN;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/auth',
    maxAge: parseExpiryToMs(config.jwt.refreshExpiresIn),
    ...(domain ? { domain } : {})
  };
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
};

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || null;
};

const detectDeviceName = (userAgent = '') => {
  const ua = String(userAgent).toLowerCase();
  const isMobile = /android|iphone|ipad|mobile/i.test(ua);
  const browser = ua.includes('edg') ? 'Edge'
    : ua.includes('chrome') ? 'Chrome'
    : ua.includes('safari') ? 'Safari'
    : ua.includes('firefox') ? 'Firefox'
    : 'Unknown Browser';
  const platform = ua.includes('windows') ? 'Windows'
    : ua.includes('mac os') ? 'macOS'
    : ua.includes('linux') ? 'Linux'
    : ua.includes('android') ? 'Android'
    : ua.includes('iphone') || ua.includes('ipad') ? 'iOS'
    : 'Unknown OS';
  return `${isMobile ? 'Mobile' : 'Desktop'} • ${platform} • ${browser}`;
};

const getUserSecuritySettings = (user) => ({
  allowConcurrentSessions: user?.securitySettings?.allowConcurrentSessions !== false,
  loginAlerts: user?.securitySettings?.loginAlerts !== false,
  requireReauthForSensitiveActions: user?.securitySettings?.requireReauthForSensitiveActions === true
});

const sendPasswordSetupOtpForUser = async (user, purpose = 'password_setup_by_admin') => {
  const otp = generateOtpCode();
  const expiresAt = new Date(Date.now() + PASSWORD_SETUP_OTP_EXP_MINUTES * 60 * 1000);
  const codeHash = hashOtpCode(otp);

  await User.updateOne(
    { _id: user._id || user.id },
    {
      $set: {
        emailVerificationOtp: {
          codeHash,
          expiresAt,
          purpose
        }
      }
    }
  );

  await emailService.sendOtpEmail(user.email, otp, 'password_setup');
  return { expiresInMinutes: PASSWORD_SETUP_OTP_EXP_MINUTES, otp };
};

const createSessionForUser = async (req, res, user) => {
  const userAgent = req.get('user-agent') || null;
  const ipAddress = getClientIp(req);
  const sessionId = randomUUID();
  const tokenVersion = 1;
  const expiresAt = new Date(Date.now() + parseExpiryToMs(config.jwt.refreshExpiresIn));

  await refreshSessionRepository.create({
    userId: user.id,
    sessionId,
    tokenVersion,
    deviceName: detectDeviceName(userAgent),
    ipAddress,
    userAgent,
    lastUsedAt: new Date(),
    expiresAt
  });

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user, sessionId, tokenVersion);
  setRefreshTokenCookie(res, refreshToken);

  return { token };
};

/**
 * @route   POST /api/auth/register/request-otp
 * @desc    Send registration OTP to email
 * @access  Public
 */
router.post('/register/request-otp', [
  body('email').isEmail().customSanitizer(normalizeEmail)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const email = normalizeEmail(req.body.email);
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists',
      message: 'A user with this email already exists'
    });
  }

  const otp = generateOtpCode();
  const challengeToken = jwt.sign(
    {
      purpose: 'registration-otp',
      email,
      otpHash: hashOtpCode(otp)
    },
    config.jwt.secret,
    { expiresIn: `${REGISTRATION_OTP_EXP_MINUTES}m` }
  );

  await emailService.sendOtpEmail(email, otp, 'registration');

  return res.json({
    success: true,
    message: 'OTP sent successfully',
    data: {
      challengeToken,
      expiresInMinutes: REGISTRATION_OTP_EXP_MINUTES,
      ...(config.nodeEnv === 'development' ? { otp } : {})
    }
  });
}));

/**
 * @route   POST /api/auth/register/verify-otp
 * @desc    Verify registration OTP and create account
 * @access  Public
 */
router.post('/register/verify-otp', [
  body('challengeToken').isString().notEmpty(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('email').isEmail().customSanitizer(normalizeEmail),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').optional().isIn(['MANAGER', 'INSTRUCTOR', 'STUDENT'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const {
    challengeToken,
    otp,
    email,
    password,
    firstName,
    lastName,
    role = 'STUDENT'
  } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(challengeToken, config.jwt.secret);
  } catch {
    return res.status(401).json({
      error: 'OTP expired',
      message: 'OTP challenge is invalid or expired'
    });
  }

  if (decoded?.purpose !== 'registration-otp') {
    return res.status(401).json({
      error: 'Invalid OTP challenge',
      message: 'OTP challenge purpose mismatch'
    });
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizeEmail(decoded.email) !== normalizedEmail) {
    return res.status(401).json({
      error: 'Invalid OTP challenge',
      message: 'Email does not match OTP challenge'
    });
  }

  const providedOtpHash = hashOtpCode(otp);
  if (providedOtpHash !== String(decoded.otpHash || '')) {
    return res.status(401).json({
      error: 'Invalid OTP',
      message: 'OTP is incorrect'
    });
  }

  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists',
      message: 'A user with this email already exists'
    });
  }

  const userRole = await roleRepository.findOne({ name: String(role).toUpperCase() });
  if (!userRole) {
    return res.status(400).json({
      error: 'Invalid role',
      message: 'The specified role does not exist'
    });
  }

  const user = await userRepository.create({
    email: normalizedEmail,
    password,
    firstName,
    lastName,
    roleId: userRole.id || userRole._id,
    isEmailVerified: true
  });

  const { token } = await createSessionForUser(req, res, user);

  return res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roleId,
      managerPermissions: user.managerPermissions || []
    },
    token
  });
}));

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', [
  body('email').isEmail().customSanitizer(normalizeEmail),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').optional().isIn(['ADMIN', 'MANAGER', 'INSTRUCTOR', 'STUDENT'])
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const requireOtpRegistration = String(process.env.REQUIRE_REGISTRATION_OTP || 'true').toLowerCase() === 'true';
  if (requireOtpRegistration) {
    return res.status(400).json({
      error: 'OTP required',
      message: 'Use /api/auth/register/request-otp and /api/auth/register/verify-otp for registration.'
    });
  }

  const { email, password, firstName, lastName, role = 'STUDENT' } = req.body;

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists',
      message: 'A user with this email already exists'
    });
  }

  // Get role
  const userRole = await roleRepository.findOne({ name: role.toUpperCase() });
  if (!userRole) {
    return res.status(400).json({
      error: 'Invalid role',
      message: 'The specified role does not exist'
    });
  }

  // Create user
  const userData = {
    email,
    password,
    firstName,
    lastName,
    roleId: userRole.id
  };

  const user = await userRepository.create({
    ...userData,
    roleId: userRole.id || userRole._id
  });

  const { token } = await createSessionForUser(req, res, user);

  res.status(201).json({
    message: 'User registered successfully',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roleId,
      managerPermissions: user.managerPermissions || []
    },
    token
  });
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('email').isEmail().customSanitizer(normalizeEmail),
  body('password').notEmpty()
], asyncHandler(async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email: emailInput, password } = req.body;
  const email = normalizeEmail(emailInput);

  // Find user
  let user = await userRepository.findByEmail(email);
  if (!user) {
    const legacyEmail = normalizeLegacyGmailEmail(emailInput);
    if (legacyEmail && legacyEmail !== email) {
      user = await userRepository.findByEmail(legacyEmail);
    }
  }
  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Email or password is incorrect'
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    return res.status(423).json({
      error: 'Account locked',
      message: 'Account is temporarily locked due to too many failed login attempts'
    });
  }

  if (!user.isActive) {
    return res.status(401).json({
      error: 'Account disabled',
      message: 'Your account has been disabled'
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    // Increment login attempts - handle through repository
    const loginAttempts = (user.loginAttempts || 0) + 1;
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours
    
    const updates = { loginAttempts };
    
    // Lock account if max attempts reached
    if (loginAttempts >= maxAttempts) {
      updates.lockUntil = new Date(Date.now() + lockTime);
    }
    
    await userRepository.updateById(user.id, updates);
    
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Email or password is incorrect'
    });
  }

  if (user.mustSetPassword) {
    try {
      const otpPayload = await sendPasswordSetupOtpForUser(user, 'password_setup_first_login');
      return res.status(403).json({
        code: 'PASSWORD_SETUP_REQUIRED',
        error: 'Password setup required',
        message: 'Please verify OTP sent to your email and set a new password before login.',
        data: {
          email: user.email,
          expiresInMinutes: otpPayload.expiresInMinutes,
          ...(config.nodeEnv === 'development' ? { otp: otpPayload.otp } : {})
        }
      });
    } catch (otpError) {
      return res.status(500).json({
        code: 'PASSWORD_SETUP_OTP_FAILED',
        error: 'OTP delivery failed',
        message: `Unable to send OTP for password setup: ${otpError.message}`
      });
    }
  }

  // Update last login
  await userRepository.updateLastLogin(user.id);

  const securitySettings = getUserSecuritySettings(user);
  if (!securitySettings.allowConcurrentSessions) {
    await refreshSessionRepository.revokeAllForUser(user.id, 'new-login');
  }

  const { token } = await createSessionForUser(req, res, user);

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roleId,
      managerPermissions: user.managerPermissions || [],
      notificationSettings: user.notificationSettings || null
    },
    token
  });
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return res.status(401).json({
      code: 'REFRESH_TOKEN_MISSING',
      error: 'Access denied',
      message: 'No refresh token provided'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const sessionId = decoded?.sid;
    const tokenVersion = Number(decoded?.ver || 0);

    if (!sessionId || !tokenVersion) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        code: 'REFRESH_TOKEN_INVALID',
        error: 'Access denied',
        message: 'Invalid refresh token payload'
      });
    }

    if (decoded.type && decoded.type !== 'refresh') {
      return res.status(401).json({
        code: 'REFRESH_TOKEN_INVALID',
        error: 'Access denied',
        message: 'Invalid refresh token type'
      });
    }

    const session = await refreshSessionRepository.findActiveBySessionId(sessionId);
    if (!session || session.userId?.toString() !== decoded.userId || session.tokenVersion !== tokenVersion) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        code: 'REFRESH_TOKEN_REVOKED',
        error: 'Access denied',
        message: 'Session has been revoked'
      });
    }

    const user = await userRepository.findById(decoded.userId, {
      populate: { path: 'roleId', select: 'name displayName level' },
      select: '-password'
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        code: 'REFRESH_TOKEN_INVALID',
        error: 'Access denied',
        message: 'Invalid refresh token'
      });
    }

    const nextTokenVersion = session.tokenVersion + 1;
    await refreshSessionRepository.updateById(session.id, {
      tokenVersion: nextTokenVersion,
      lastUsedAt: new Date(),
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || session.userAgent,
      expiresAt: new Date(Date.now() + parseExpiryToMs(config.jwt.refreshExpiresIn))
    });

    const token = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user, session.sessionId, nextTokenVersion);
    setRefreshTokenCookie(res, nextRefreshToken);

    return res.json({
      message: 'Token refreshed successfully',
      token
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        code: 'REFRESH_TOKEN_EXPIRED',
        error: 'Access denied',
        message: 'Refresh token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        code: 'REFRESH_TOKEN_INVALID',
        error: 'Access denied',
        message: 'Invalid refresh token'
      });
    }

    throw error;
  }
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      avatar: req.user.avatar,
      phone: req.user.phone,
      role: req.userRole,
      managerPermissions: Array.isArray(req.user.managerPermissions) ? req.user.managerPermissions : [],
      notificationSettings: req.user.notificationSettings || null,
      isEmailVerified: req.user.isEmailVerified,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt
    }
  });
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear refresh cookie)
 * @access  Public
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      if (decoded?.sid) {
        await refreshSessionRepository.revokeBySessionId(decoded.sid, 'logout');
      }
    } catch {
      // no-op: cookie may already be invalid/expired
    }
  }
  clearRefreshTokenCookie(res);
  res.json({
    message: 'Logout successful'
  });
}));

/**
 * @route   GET /api/auth/sessions
 * @desc    Get active sign-in sessions/devices
 * @access  Private
 */
router.get('/sessions', authenticateToken, asyncHandler(async (req, res) => {
  const sessions = await refreshSessionRepository.findActiveByUser(req.user.id);
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  let currentSessionId = null;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      currentSessionId = decoded?.sid || null;
    } catch {
      currentSessionId = null;
    }
  }

  res.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      sessionId: session.sessionId,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      isCurrent: session.sessionId === currentSessionId
    }))
  });
}));

/**
 * @route   POST /api/auth/sessions/revoke-all
 * @desc    Revoke all active sessions for current user
 * @access  Private
 */
router.post('/sessions/revoke-all', authenticateToken, asyncHandler(async (req, res) => {
  const keepCurrent = req.body?.keepCurrent !== false;
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  let currentSessionId = null;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      currentSessionId = decoded?.sid || null;
    } catch {
      currentSessionId = null;
    }
  }

  await refreshSessionRepository.revokeAllForUser(
    req.user.id,
    'revoke-all',
    keepCurrent ? currentSessionId : null
  );

  if (!keepCurrent) {
    clearRefreshTokenCookie(res);
  }

  res.json({
    message: keepCurrent
      ? 'Signed out from all other devices'
      : 'Signed out from all devices'
  });
}));

/**
 * @route   POST /api/auth/sessions/:sessionId/revoke
 * @desc    Revoke a specific session
 * @access  Private
 */
router.post('/sessions/:sessionId/revoke', authenticateToken, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await refreshSessionRepository.findActiveBySessionId(sessionId);

  if (!session || session.userId?.toString() !== req.user.id.toString()) {
    return res.status(404).json({
      error: 'Session not found',
      message: 'The requested session does not exist'
    });
  }

  await refreshSessionRepository.revokeBySessionId(sessionId, 'manual-revoke');

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      if (decoded?.sid === sessionId) {
        clearRefreshTokenCookie(res);
      }
    } catch {
      // ignore cookie decode errors
    }
  }

  res.json({
    message: 'Session revoked successfully'
  });
}));

/**
 * @route   GET /api/auth/security-settings
 * @desc    Get security/sign-in settings for current user
 * @access  Private
 */
router.get('/security-settings', authenticateToken, asyncHandler(async (req, res) => {
  const settings = getUserSecuritySettings(req.user);
  res.json({ settings });
}));

/**
 * @route   PUT /api/auth/security-settings
 * @desc    Update security/sign-in settings for current user
 * @access  Private
 */
router.put('/security-settings', authenticateToken, asyncHandler(async (req, res) => {
  const current = getUserSecuritySettings(req.user);
  const settings = {
    allowConcurrentSessions: typeof req.body?.allowConcurrentSessions === 'boolean'
      ? req.body.allowConcurrentSessions
      : current.allowConcurrentSessions,
    loginAlerts: typeof req.body?.loginAlerts === 'boolean'
      ? req.body.loginAlerts
      : current.loginAlerts,
    requireReauthForSensitiveActions: typeof req.body?.requireReauthForSensitiveActions === 'boolean'
      ? req.body.requireReauthForSensitiveActions
      : current.requireReauthForSensitiveActions
  };

  await userRepository.updateById(req.user.id, { securitySettings: settings });

  if (!settings.allowConcurrentSessions) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    let currentSessionId = null;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
        currentSessionId = decoded?.sid || null;
      } catch {
        currentSessionId = null;
      }
    }
    await refreshSessionRepository.revokeAllForUser(req.user.id, 'single-session-policy', currentSessionId);
  }

  res.json({
    message: 'Security settings updated successfully',
    settings
  });
}));

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user password and revoke other sessions
 * @access  Private
 */
router.post('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;
  const userWithPassword = await userRepository.findByEmail(req.user.email);
  if (!userWithPassword) {
    return res.status(404).json({
      error: 'User not found',
      message: 'Account no longer exists'
    });
  }
  const isPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);

  if (!isPasswordValid) {
    return res.status(400).json({
      error: 'Invalid password',
      message: 'Current password is incorrect'
    });
  }

  await userRepository.updatePassword(req.user.id, newPassword);

  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  let currentSessionId = null;
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      currentSessionId = decoded?.sid || null;
    } catch {
      currentSessionId = null;
    }
  }
  await refreshSessionRepository.revokeAllForUser(req.user.id, 'password-changed', currentSessionId);

  res.json({
    message: 'Password changed successfully. Other devices have been signed out.'
  });
}));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', [
  body('email').isEmail().customSanitizer(normalizeEmail)
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email } = req.body;

  // Find user
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Don't reveal if user exists or not
    return res.json({
      message: 'If the email exists, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = jwt.sign(
    { userId: user.id, purpose: 'password-reset' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
  const otp = generateOtpCode();

  // Save reset token and OTP
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const otpExpiresAt = new Date(Date.now() + FORGOT_PASSWORD_OTP_EXP_MINUTES * 60 * 1000);
  await userRepository.updateById(user.id, {
    passwordResetToken: resetToken,
    passwordResetExpires: expiresAt,
    emailVerificationOtp: {
      codeHash: hashOtpCode(otp),
      expiresAt: otpExpiresAt,
      purpose: 'forgot_password'
    }
  });

  await emailService.sendPasswordResetEmail(user, {
    token: resetToken,
    otp,
    expiresInMinutes: FORGOT_PASSWORD_OTP_EXP_MINUTES,
    subject: 'Reset your LMS password'
  });

  res.json({
    message: 'If the email exists, a password reset link and OTP have been sent',
    // In development, return the token for testing
    ...(config.nodeEnv === 'development' && { resetToken, otp })
  });
}));

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', [
  body('token').optional().isString(),
  body('email').optional().isEmail().customSanitizer(normalizeEmail),
  body('otp').optional().isLength({ min: 6, max: 6 }),
  body('password').isLength({ min: 6 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || '').trim();

  if (!token && !(email && otp)) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Provide reset token or email + OTP to reset password'
    });
  }

  let user = null;

  if (token) {
    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({
          error: 'Invalid token',
          message: 'Token is not valid for password reset'
        });
      }

      // Find user by reset token
      user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      });
      if (!user) {
        return res.status(400).json({
          error: 'Invalid or expired token',
          message: 'Password reset token is invalid or has expired'
        });
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({
          error: 'Token expired',
          message: 'Password reset token has expired'
        });
      }

      throw error;
    }
  } else {
    user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        error: 'Invalid OTP',
        message: 'OTP is invalid or expired'
      });
    }

    const otpRecord = user.emailVerificationOtp || {};
    const expiresAt = otpRecord.expiresAt ? new Date(otpRecord.expiresAt) : null;
    const isExpired = !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now();
    const purpose = String(otpRecord.purpose || '');
    const matches = otpRecord.codeHash && hashOtpCode(otp) === otpRecord.codeHash;

    if (purpose !== 'forgot_password' || !matches || isExpired) {
      return res.status(401).json({
        error: 'Invalid OTP',
        message: 'OTP is invalid or expired'
      });
    }
  }

  user.password = password;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.emailVerificationOtp = {
    codeHash: null,
    expiresAt: null,
    purpose: null
  };
  user.passwordChangedAt = new Date();
  await user.save();

  await refreshSessionRepository.revokeAllForUser(user._id.toString(), 'password-reset');

  res.json({
    message: 'Password reset successful'
  });
}));

/**
 * @route   POST /api/auth/password-otp/verify-and-set
 * @desc    Verify admin-triggered OTP and set new password
 * @access  Public
 */
router.post('/password-otp/verify-and-set', [
  body('email').isEmail().customSanitizer(normalizeEmail),
  body('otp').isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 8 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const newPassword = String(req.body.newPassword || '');

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'No account found with this email'
    });
  }

  const otpRecord = user.emailVerificationOtp || {};
  const expiresAt = otpRecord.expiresAt ? new Date(otpRecord.expiresAt) : null;
  const isExpired = !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now();
  const purpose = String(otpRecord.purpose || '');
  const matches = otpRecord.codeHash && hashOtpCode(otp) === otpRecord.codeHash;

  const allowedPurposes = ['password_setup_by_admin', 'password_setup_first_login'];
  if (!allowedPurposes.includes(purpose) || !matches || isExpired) {
    return res.status(401).json({
      error: 'Invalid OTP',
      message: 'OTP is invalid or expired'
    });
  }

  user.password = newPassword;
  user.emailVerificationOtp = {
    codeHash: null,
    expiresAt: null,
    purpose: null
  };
  user.mustSetPassword = false;
  user.passwordChangedAt = new Date();
  await user.save();

  await refreshSessionRepository.revokeAllForUser(user._id.toString(), 'password-reset-otp');

  return res.json({
    success: true,
    message: 'Password updated successfully. Please sign in with your new password.'
  });
}));

module.exports = router;
