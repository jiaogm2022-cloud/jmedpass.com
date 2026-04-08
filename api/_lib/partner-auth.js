const crypto = require('crypto');
const { parseCookies } = require('./auth');

const COOKIE_NAME = 'sm_partner_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function getPartnerSessionSecret() {
  if (process.env.PARTNER_SESSION_SECRET) return process.env.PARTNER_SESSION_SECRET;
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
    return 'jmedpass-dev-partner-secret';
  }
  return '';
}

function signPartnerSession(userId, expiresAt) {
  const secret = getPartnerSessionSecret();
  if (!secret) {
    throw new Error('PARTNER_SESSION_SECRET is not configured');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}.${expiresAt}`)
    .digest('hex');
}

function serializePartnerCookie(value, maxAgeMs) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
  ];

  if (process.env.NODE_ENV !== 'development') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function createPartnerSessionCookie(userId) {
  if (!getPartnerSessionSecret()) {
    throw new Error('PARTNER_SESSION_SECRET is not configured');
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = signPartnerSession(userId, expiresAt);
  const value = Buffer.from(`${userId}.${expiresAt}.${signature}`, 'utf8').toString('base64url');
  return serializePartnerCookie(value, SESSION_TTL_MS);
}

function clearPartnerSessionCookie() {
  return serializePartnerCookie('', 0);
}

function getAuthenticatedPartner(req) {
  if (!getPartnerSessionSecret()) return null;
  const cookieValue = parseCookies(req)[COOKIE_NAME];
  if (!cookieValue) return null;

  try {
    const [userId, expiresAtRaw, signature] = Buffer.from(cookieValue, 'base64url')
      .toString('utf8')
      .split('.');

    const expiresAt = Number(expiresAtRaw);
    if (!userId || !Number.isFinite(expiresAt) || !signature) return null;
    if (Date.now() > expiresAt) return null;

    const expectedSignature = signPartnerSession(userId, expiresAt);
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'))) {
      return null;
    }

    return { userId, expiresAt };
  } catch (error) {
    return null;
  }
}

/* ===== Signed referral tokens =====
   Referral codes are now signed server-side so clients cannot forge
   the referred-by relationship by editing localStorage.
   The token embeds: refCode + timestamp + HMAC signature.
   ===================================== */
const REFERRAL_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signReferralToken(refCode) {
  const secret = getPartnerSessionSecret();
  if (!secret) return '';
  const ts = Date.now();
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`ref.${refCode}.${ts}`)
    .digest('hex')
    .slice(0, 32);
  return Buffer.from(`${refCode}.${ts}.${sig}`, 'utf8').toString('base64url');
}

function verifyReferralToken(token) {
  if (!token) return null;
  const secret = getPartnerSessionSecret();
  if (!secret) return null;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [refCode, tsRaw, sig] = parts;
    const ts = Number(tsRaw);
    if (!refCode || !Number.isFinite(ts) || !sig) return null;
    if (Date.now() - ts > REFERRAL_TOKEN_TTL_MS) return null;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`ref.${refCode}.${ts}`)
      .digest('hex')
      .slice(0, 32);
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
      return null;
    }
    return refCode;
  } catch (err) {
    return null;
  }
}

module.exports = {
  clearPartnerSessionCookie,
  createPartnerSessionCookie,
  getAuthenticatedPartner,
  signReferralToken,
  verifyReferralToken,
};
