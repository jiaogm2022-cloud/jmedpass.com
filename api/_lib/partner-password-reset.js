const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development'
    || (!process.env.VERCEL && process.env.NODE_ENV !== 'production');
}

function getPasswordResetSecret() {
  if (process.env.PARTNER_RESET_SECRET) return process.env.PARTNER_RESET_SECRET;
  if (process.env.PARTNER_SESSION_SECRET) return process.env.PARTNER_SESSION_SECRET;
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  return isDevelopmentMode() ? 'jmedpass-dev-password-reset-secret' : '';
}

function createResetFingerprint(user) {
  return crypto
    .createHash('sha256')
    .update(`${String((user && user.email) || '').toLowerCase()}|${String((user && user.passwordHash) || '')}`)
    .digest('hex')
    .slice(0, 24);
}

function signResetToken(userId, expiresAt, fingerprint) {
  const secret = getPasswordResetSecret();
  if (!secret) {
    throw new Error('PARTNER_RESET_SECRET is not configured');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`pwdreset.${userId}.${expiresAt}.${fingerprint}`)
    .digest('hex');
}

function decodePasswordResetToken(token) {
  try {
    const [userId, expiresAtRaw, fingerprint, signature] = Buffer.from(String(token || ''), 'base64url')
      .toString('utf8')
      .split('.');
    const expiresAt = Number(expiresAtRaw);
    if (!userId || !Number.isFinite(expiresAt) || !fingerprint || !signature) return null;
    return { userId, expiresAt, fingerprint, signature };
  } catch (error) {
    return null;
  }
}

function createPasswordResetToken(user, options) {
  const ttlMs = Number((options && options.ttlMs) || 0) || RESET_TOKEN_TTL_MS;
  const expiresAt = Date.now() + ttlMs;
  const fingerprint = createResetFingerprint(user);
  const signature = signResetToken(user.id, expiresAt, fingerprint);
  return Buffer.from(`${user.id}.${expiresAt}.${fingerprint}.${signature}`, 'utf8').toString('base64url');
}

function verifyPasswordResetToken(token, user) {
  const payload = decodePasswordResetToken(token);
  if (!payload || !user) return { ok: false, reason: 'invalid' };
  if (String(user.id) !== payload.userId) return { ok: false, reason: 'invalid' };
  if (Date.now() > payload.expiresAt) return { ok: false, reason: 'expired' };

  const expectedFingerprint = createResetFingerprint(user);
  if (!timingSafeEqual(payload.fingerprint, expectedFingerprint)) {
    return { ok: false, reason: 'expired' };
  }

  const expectedSignature = signResetToken(user.id, payload.expiresAt, payload.fingerprint);
  if (!timingSafeEqual(payload.signature, expectedSignature)) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, userId: payload.userId, expiresAt: payload.expiresAt };
}

function timingSafeEqual(left, right) {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

module.exports = {
  RESET_TOKEN_TTL_MS,
  createPasswordResetToken,
  decodePasswordResetToken,
  verifyPasswordResetToken,
};
