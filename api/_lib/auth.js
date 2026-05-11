const crypto = require('crypto');

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD_HASH = 'c4c0b99854f97f16ae681cb3c396f20858c2499c7b1c8f33cdad958c57f3958d';
const SESSION_COOKIE = 'sm_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEYLEN = 64;

function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development'
    || (!process.env.VERCEL && process.env.NODE_ENV !== 'production');
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function createPasswordHash(input) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(String(input), salt, SCRYPT_KEYLEN).toString('hex');
  return `${SCRYPT_PREFIX}$${salt}$${digest}`;
}

function timingSafeEqualText(left, right) {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function isScryptHash(value) {
  return typeof value === 'string' && value.startsWith(`${SCRYPT_PREFIX}$`);
}

function verifyPasswordHash(input, storedHash) {
  const normalized = String(storedHash || '').trim().toLowerCase();
  if (!normalized) return false;

  if (isScryptHash(normalized)) {
    const [, salt, expectedDigest] = normalized.split('$');
    if (!salt || !expectedDigest) return false;
    const actualDigest = crypto.scryptSync(String(input), salt, SCRYPT_KEYLEN).toString('hex');
    return timingSafeEqualText(actualDigest, expectedDigest);
  }

  return timingSafeEqualHex(sha256Hex(input), normalized);
}

function needsPasswordRehash(storedHash) {
  return !isScryptHash(String(storedHash || '').trim().toLowerCase());
}

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || (isDevelopmentMode() ? DEFAULT_ADMIN_USERNAME : '');
}

function getAdminPasswordHash() {
  const value = process.env.ADMIN_PASSWORD_HASH || (isDevelopmentMode() ? DEFAULT_ADMIN_PASSWORD_HASH : '');
  return String(value || '').toLowerCase();
}

function getSessionSecret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  return isDevelopmentMode() ? getAdminPasswordHash() : '';
}

function timingSafeEqualHex(left, right) {
  return timingSafeEqualText(left, right);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function signSessionPayload(username, expiresAt) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${username}.${expiresAt}`)
    .digest('hex');
}

function createSessionCookie(username) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = signSessionPayload(username, expiresAt);
  const value = Buffer.from(`${username}.${expiresAt}.${signature}`, 'utf8').toString('base64url');
  return serializeCookie(SESSION_COOKIE, value, SESSION_TTL_MS);
}

function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', 0);
}

function serializeCookie(name, value, maxAgeMs) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`,
  ];

  if (!isDevelopmentMode()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function getAuthenticatedAdmin(req) {
  const cookieValue = parseCookies(req)[SESSION_COOKIE];
  if (!cookieValue) return null;

  try {
    const [username, expiresAtRaw, signature] = Buffer.from(cookieValue, 'base64url')
      .toString('utf8')
      .split('.');

    const expiresAt = Number(expiresAtRaw);
    if (!username || !Number.isFinite(expiresAt) || !signature) return null;
    if (Date.now() > expiresAt) return null;

    const expectedSignature = signSessionPayload(username, expiresAt);
    if (!timingSafeEqualHex(signature, expectedSignature)) return null;
    if (username !== getAdminUsername()) return null;

    return { username, expiresAt };
  } catch (error) {
    return null;
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = {
  clearSessionCookie,
  createPasswordHash,
  createSessionCookie,
  getAdminPasswordHash,
  getAdminUsername,
  getAuthenticatedAdmin,
  needsPasswordRehash,
  parseCookies,
  readJsonBody,
  sha256Hex,
  timingSafeEqualHex,
  verifyPasswordHash,
};
