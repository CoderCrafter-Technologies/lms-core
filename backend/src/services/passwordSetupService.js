const jwt = require('jsonwebtoken');
const { randomInt, createHash } = require('crypto');

const config = require('../config');
const User = require('../models/User');

const DEFAULT_TOKEN_EXP_MINUTES = Math.max(15, Number(process.env.ACCOUNT_SETUP_TOKEN_EXP_MINUTES || 60));
const DEFAULT_OTP_EXP_MINUTES = Math.max(3, Number(process.env.PASSWORD_SETUP_OTP_EXP_MINUTES || 10));

const hashOtpCode = (code) => createHash('sha256').update(String(code || '')).digest('hex');
const generateOtpCode = () => String(randomInt(100000, 1000000));

function resolveUserId(user) {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user._id || user.id || null;
}

async function preparePasswordSetup(user, options = {}) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new Error('User ID is required to prepare password setup.');
  }

  const purpose = String(options.purpose || 'password_setup_by_admin');
  const tokenExpiresMinutes = Math.max(15, Number(options.tokenExpiresMinutes || DEFAULT_TOKEN_EXP_MINUTES));
  const otpExpiresMinutes = Math.max(3, Number(options.otpExpiresMinutes || DEFAULT_OTP_EXP_MINUTES));

  const token = jwt.sign(
    { userId: String(userId), purpose: 'password-reset' },
    config.jwt.secret,
    { expiresIn: `${tokenExpiresMinutes}m` }
  );
  const otp = generateOtpCode();

  const tokenExpiresAt = new Date(Date.now() + tokenExpiresMinutes * 60 * 1000);
  const otpExpiresAt = new Date(Date.now() + otpExpiresMinutes * 60 * 1000);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        passwordResetToken: token,
        passwordResetExpires: tokenExpiresAt,
        emailVerificationOtp: {
          codeHash: hashOtpCode(otp),
          expiresAt: otpExpiresAt,
          purpose
        }
      }
    }
  );

  return {
    token,
    otp,
    tokenExpiresAt,
    otpExpiresAt,
    tokenExpiresMinutes,
    otpExpiresMinutes
  };
}

module.exports = {
  preparePasswordSetup
};
