const { smtpService } = require('./smtpService');
const { User, Role } = require('../models');
const systemSettingsStore = require('./systemSettingsStore');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

const stripTrailingSlashes = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const isLocalHostname = (hostname = '') => {
  const host = String(hostname || '').trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
};

const normalizeUrl = (rawValue, { preferHttps = false } = {}) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : `${preferHttps ? 'https' : 'http'}://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    return stripTrailingSlashes(parsed.toString());
  } catch {
    return '';
  }
};

const isLoopbackUrl = (urlValue = '') => {
  try {
    const hostname = new URL(urlValue).hostname;
    return isLocalHostname(hostname);
  } catch {
    return false;
  }
};

const getEnvFrontendUrlCandidates = () => {
  const candidates = [];
  const rawLists = [
    process.env.PUBLIC_APP_URL,
    process.env.APP_BASE_URL,
    process.env.FRONTEND_PUBLIC_URL,
    process.env.FRONTEND_URL
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  rawLists.forEach((raw) => {
    raw.split(',').map((entry) => entry.trim()).filter(Boolean).forEach((entry) => {
      const normalized = normalizeUrl(entry, { preferHttps: false });
      if (normalized) candidates.push(normalized);
    });
  });

  return candidates;
};

const resolveAppUrl = async () => {
  const settings = await systemSettingsStore.getSetupSettings().catch(() => null);
  const setupWebsite = normalizeUrl(settings?.institute?.website, { preferHttps: false });

  const savedDomains = (settings?.customDomains || [])
    .filter((item) => item?.domain && (item?.savedAt || item?.verifiedAt || item?.status === 'verified'))
    .sort((a, b) => String(b?.savedAt || b?.verifiedAt || '').localeCompare(String(a?.savedAt || a?.verifiedAt || '')));

  const savedDomain = String(savedDomains[0]?.domain || '').trim().toLowerCase();
  if (savedDomain) {
    if (setupWebsite) {
      try {
        const websiteHost = new URL(setupWebsite).hostname.toLowerCase();
        if (websiteHost === savedDomain) {
          return setupWebsite;
        }
      } catch {
        // ignore malformed website and continue with saved domain
      }
    }
    return normalizeUrl(savedDomain, { preferHttps: true }) || `https://${savedDomain}`;
  }

  if (setupWebsite) {
    return setupWebsite;
  }

  const envCandidates = getEnvFrontendUrlCandidates();
  const nonLoopbackCandidate = envCandidates.find((candidate) => !isLoopbackUrl(candidate));
  if (nonLoopbackCandidate) {
    return nonLoopbackCandidate;
  }

  const firstCandidate = envCandidates[0];
  if (firstCandidate) {
    return firstCandidate;
  }

  return DEFAULT_FRONTEND_URL;
};

const wrapEmail = (title, bodyHtml) => `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
    <h2 style="color:#111827;">${escapeHtml(title)}</h2>
    <div style="color:#374151; line-height:1.5;">${bodyHtml}</div>
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
    <p style="font-size:12px;color:#6b7280;">This is an automated email from your LMS.</p>
  </div>
`;

class EmailService {
  async sendRaw({ to, subject, html, text }) {
    return smtpService.sendMail({ to, subject, html, text });
  }

  async sendWelcomeEmail(user, password) {
    if (!user?.email) return { success: false, skipped: true };
    const frontendUrl = await resolveAppUrl();
    return this.sendRaw({
      to: user.email,
      subject: 'Welcome to LMS - Your account is ready',
      html: wrapEmail(
        'Welcome to LMS',
        `<p>Hello ${escapeHtml(user.firstName || '')},</p>
         <p>Your account has been created successfully.</p>
         <p><strong>Email:</strong> ${escapeHtml(user.email)}<br/>
         <strong>Temporary password:</strong> ${escapeHtml(password || '')}</p>
         <p>Please change your password after first login.</p>
         <p><a href="${frontendUrl}/auth/login">Go to login</a></p>`
      )
    });
  }

  async sendInstructorWelcomeEmail(instructor, password, options = {}) {
    if (!instructor?.email) return { success: false, skipped: true };
    const frontendUrl = await resolveAppUrl();
    const setupToken = String(options.setupToken || '').trim();
    const setupOtp = String(options.setupOtp || '').trim();
    const setupUrl = setupToken
      ? `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(setupToken)}`
      : '';
    const linkExpiryText = options.setupLinkExpiresInMinutes
      ? `<p><strong>Setup link validity:</strong> ${escapeHtml(String(options.setupLinkExpiresInMinutes))} minutes</p>`
      : '';
    const otpExpiryText = options.setupOtpExpiresInMinutes
      ? `<p><strong>Setup OTP validity:</strong> ${escapeHtml(String(options.setupOtpExpiresInMinutes))} minutes</p>`
      : '';
    const credentialsBlock = password
      ? `<p><strong>Email:</strong> ${escapeHtml(instructor.email)}<br/>
         <strong>Temporary password:</strong> ${escapeHtml(password)}</p>`
      : `<p><strong>Email:</strong> ${escapeHtml(instructor.email)}</p>`;
    const setupBlock = setupUrl || setupOtp
      ? `<p>Your account must be activated by setting a new password before first login.</p>
         <p>You can use any of the options below:</p>
         <ol>
           ${setupUrl ? `<li>Open this secure setup link: <a href="${setupUrl}">Set up your password</a></li>` : ''}
           ${setupOtp ? `<li>Enter this OTP on the password setup screen: <strong style="font-size:20px;letter-spacing:2px;">${escapeHtml(setupOtp)}</strong></li>` : ''}
         </ol>
         ${linkExpiryText}
         ${otpExpiryText}
         <p>If the setup link is unavailable, you can still sign in with the temporary password and continue the OTP-based password setup flow.</p>`
      : `<p>Please change your password after first login.</p>
         <p><a href="${frontendUrl}/auth/login">Go to login</a></p>`;

    return this.sendRaw({
      to: instructor.email,
      subject: setupUrl || setupOtp
        ? 'Welcome to LMS - Set up your instructor account'
        : 'Welcome to LMS - Your account is ready',
      html: wrapEmail(
        'Welcome to LMS',
        `<p>Hello ${escapeHtml(instructor.firstName || '')},</p>
         <p>Your instructor account has been created successfully.</p>
         ${credentialsBlock}
         ${setupBlock}`
      )
    });
  }

  async sendBatchEnrollmentEmail(user, batch, course) {
    if (!user?.email) return { success: false, skipped: true };
    const frontendUrl = await resolveAppUrl();
    return this.sendRaw({
      to: user.email,
      subject: `Enrollment confirmed: ${course?.title || 'Course'}`,
      html: wrapEmail(
        'Enrollment Confirmed',
        `<p>Hello ${escapeHtml(user.firstName || '')},</p>
         <p>You are enrolled in <strong>${escapeHtml(course?.title || '')}</strong>.</p>
         <p><strong>Batch:</strong> ${escapeHtml(batch?.name || '')}</p>
         <p><a href="${frontendUrl}/dashboard">Open dashboard</a></p>`
      )
    });
  }

  async sendPasswordResetEmail(userOrEmail, tokenOrPayload) {
    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
    const firstName = typeof userOrEmail === 'string' ? '' : (userOrEmail?.firstName || '');
    if (!email) return { success: false, skipped: true };
    const frontendUrl = await resolveAppUrl();

    if (typeof tokenOrPayload === 'string') {
      const resetUrl = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(tokenOrPayload)}`;
      return this.sendRaw({
        to: email,
        subject: 'Password reset requested',
        html: wrapEmail(
          'Password Reset',
          `<p>Hello ${escapeHtml(firstName)},</p>
           <p>Use the button below to reset your password.</p>
           <p><a href="${resetUrl}">Reset password</a></p>
           <p>If you did not request this, ignore this email.</p>`
        )
      });
    }

    const payload = tokenOrPayload || {};
    if (payload.token) {
      const resetUrl = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(String(payload.token))}`;
      return this.sendRaw({
        to: email,
        subject: payload.subject || 'Password reset requested',
        html: wrapEmail(
          'Password Reset',
          `<p>Hello ${escapeHtml(payload.name || firstName)},</p>
           <p>Use the secure link below to reset your password.</p>
           <p><a href="${resetUrl}">Reset password</a></p>
           ${payload.otp ? `<p>Or use OTP: <strong style="font-size:20px;letter-spacing:2px;">${escapeHtml(payload.otp)}</strong></p>` : ''}
           ${payload.expiresInMinutes ? `<p>${payload.otp ? 'OTP' : 'Reset link'} expires in ${escapeHtml(String(payload.expiresInMinutes))} minutes.</p>` : ''}
           <p>If you did not request this, ignore this email.</p>`
        )
      });
    }

    if (payload.newPassword) {
      return this.sendRaw({
        to: email,
        subject: 'Your password has been reset',
        html: wrapEmail(
          'Password Reset',
          `<p>Hello ${escapeHtml(payload.name || firstName)},</p>
           <p>Your password was reset by an administrator.</p>
           <p><strong>Temporary password:</strong> ${escapeHtml(payload.newPassword)}</p>
           <p>Please change it after login.</p>`
        )
      });
    }

    if (payload.otp) {
      return this.sendRaw({
        to: email,
        subject: payload.subject || 'Your OTP code',
        html: wrapEmail(
          'One-Time Password',
          `<p>Your OTP is <strong style="font-size:20px;letter-spacing:2px;">${escapeHtml(payload.otp)}</strong></p>
           <p>This code expires in ${escapeHtml(String(payload.expiresInMinutes || 10))} minutes.</p>`
        )
      });
    }

    return { success: false, skipped: true, message: 'No reset payload provided' };
  }

  async sendClassReminderEmail(user, liveClass, batch, course) {
    if (!user?.email) return { success: false, skipped: true };
    const when = liveClass?.scheduledStartTime ? new Date(liveClass.scheduledStartTime).toLocaleString() : '';
    const frontendUrl = await resolveAppUrl();
    return this.sendRaw({
      to: user.email,
      subject: `Class starts soon: ${liveClass?.title || 'Live class'}`,
      html: wrapEmail(
        'Class starts in 5 minutes',
        `<p>Hello ${escapeHtml(user.firstName || '')},</p>
         <p><strong>${escapeHtml(liveClass?.title || '')}</strong> starts soon.</p>
         <p><strong>Course:</strong> ${escapeHtml(course?.title || '')}<br/>
         <strong>Batch:</strong> ${escapeHtml(batch?.name || '')}<br/>
         <strong>Time:</strong> ${escapeHtml(when)}</p>
         <p><a href="${frontendUrl}/dashboard/live-classes">Join class</a></p>`
      )
    });
  }

  async sendEnrollmentConfirmation(payload) {
    return this.sendRaw({
      to: payload.studentEmail,
      subject: `Enrollment confirmed: ${payload.courseName || 'Course'}`,
      html: wrapEmail(
        'Enrollment Confirmation',
        `<p>Hello ${escapeHtml(payload.studentName || '')},</p>
         <p>You have been enrolled in <strong>${escapeHtml(payload.courseName || '')}</strong>.</p>
         <p><strong>Batch:</strong> ${escapeHtml(payload.batchName || '')}</p>`
      )
    });
  }

  async sendCertificateIssued(payload) {
    const frontendUrl = await resolveAppUrl();
    return this.sendRaw({
      to: payload.studentEmail,
      subject: `Certificate issued: ${payload.courseName || 'Course'}`,
      html: wrapEmail(
        'Certificate Issued',
        `<p>Hello ${escapeHtml(payload.studentName || '')},</p>
         <p>Your certificate is ready for <strong>${escapeHtml(payload.courseName || '')}</strong>.</p>
         <p><a href="${escapeHtml(payload.certificateUrl || frontendUrl)}">View certificate</a></p>`
      )
    });
  }

  async sendOtpEmail(email, otp, purpose = 'verification') {
    return this.sendPasswordResetEmail(email, {
      otp,
      expiresInMinutes: 10,
      subject: purpose === 'registration' ? 'Verify your email (OTP)' : 'OTP for password setup'
    });
  }

  async sendAdminEventEmail(eventTitle, eventHtml, extraRecipients = []) {
    const adminRole = await Role.findOne({ name: 'ADMIN' }).lean();
    const adminUsers = adminRole
      ? await User.find({ roleId: adminRole._id, isActive: true }, { email: 1, firstName: 1 }).lean()
      : [];
    const setup = await systemSettingsStore.getSetupSettings();
    const supportEmail = String(setup?.institute?.supportEmail || '').trim();
    const recipients = [
      ...adminUsers.map((u) => String(u.email || '').trim()).filter(Boolean),
      ...extraRecipients.map((v) => String(v || '').trim()).filter(Boolean),
      ...(supportEmail ? [supportEmail] : [])
    ];
    const uniqueRecipients = [...new Set(recipients)];
    if (!uniqueRecipients.length) return { success: false, skipped: true };

    return this.sendRaw({
      to: uniqueRecipients.join(','),
      subject: `[Admin Alert] ${eventTitle}`,
      html: wrapEmail(eventTitle, eventHtml)
    });
  }

  async sendControlPlaneNoticeEmail(user, notice = {}) {
    if (!user?.email) return { success: false, skipped: true };
    return this.sendRaw({
      to: user.email,
      subject: `[Platform] ${notice.title || 'Notice'}`,
      html: wrapEmail(
        notice.title || 'Platform Notice',
        `<p>${escapeHtml(notice.message || 'New platform update is available.')}</p>`
      )
    });
  }
}

module.exports = new EmailService();
