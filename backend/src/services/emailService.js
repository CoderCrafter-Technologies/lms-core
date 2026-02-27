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

const appUrl = () => {
  const raw = String(process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0] || 'http://localhost:3000';
  return raw.trim().replace(/\/+$/, '');
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
         <p><a href="${appUrl()}/auth/login">Go to login</a></p>`
      )
    });
  }

  async sendInstructorWelcomeEmail(instructor, password) {
    return this.sendWelcomeEmail(instructor, password);
  }

  async sendBatchEnrollmentEmail(user, batch, course) {
    if (!user?.email) return { success: false, skipped: true };
    return this.sendRaw({
      to: user.email,
      subject: `Enrollment confirmed: ${course?.title || 'Course'}`,
      html: wrapEmail(
        'Enrollment Confirmed',
        `<p>Hello ${escapeHtml(user.firstName || '')},</p>
         <p>You are enrolled in <strong>${escapeHtml(course?.title || '')}</strong>.</p>
         <p><strong>Batch:</strong> ${escapeHtml(batch?.name || '')}</p>
         <p><a href="${appUrl()}/dashboard">Open dashboard</a></p>`
      )
    });
  }

  async sendPasswordResetEmail(userOrEmail, tokenOrPayload) {
    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
    const firstName = typeof userOrEmail === 'string' ? '' : (userOrEmail?.firstName || '');
    if (!email) return { success: false, skipped: true };

    if (typeof tokenOrPayload === 'string') {
      const resetUrl = `${appUrl()}/auth/reset-password?token=${encodeURIComponent(tokenOrPayload)}`;
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
    if (payload.token && payload.otp) {
      const resetUrl = `${appUrl()}/auth/reset-password?token=${encodeURIComponent(String(payload.token))}`;
      return this.sendRaw({
        to: email,
        subject: payload.subject || 'Password reset requested',
        html: wrapEmail(
          'Password Reset',
          `<p>Hello ${escapeHtml(payload.name || firstName)},</p>
           <p>You can reset your password using either method below:</p>
           <ol>
             <li>Open reset link: <a href="${resetUrl}">Reset password</a></li>
             <li>Use OTP: <strong style="font-size:20px;letter-spacing:2px;">${escapeHtml(payload.otp)}</strong></li>
           </ol>
           <p>OTP expires in ${escapeHtml(String(payload.expiresInMinutes || 10))} minutes.</p>
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
         <p><a href="${appUrl()}/dashboard/live-classes">Join class</a></p>`
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
    return this.sendRaw({
      to: payload.studentEmail,
      subject: `Certificate issued: ${payload.courseName || 'Course'}`,
      html: wrapEmail(
        'Certificate Issued',
        `<p>Hello ${escapeHtml(payload.studentName || '')},</p>
         <p>Your certificate is ready for <strong>${escapeHtml(payload.courseName || '')}</strong>.</p>
         <p><a href="${escapeHtml(payload.certificateUrl || appUrl())}">View certificate</a></p>`
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
