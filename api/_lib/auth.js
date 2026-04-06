const crypto = require('crypto');

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD_HASH = 'c4c0b99854f97f16ae681cb3c396f20858c2499c7b1c8f33cdad958c57f3958d';
const SESSION_COOKIE = 'sm_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
}

function getAdminPasswordHash() {
  return (process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH).toLowerCase();
}

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || getAdminPasswordHash();
}

function timingSafeEqualHex(left, right) {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
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

  if (process.env.NODE_ENV !== 'development') {
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
  createSessionCookie,
  getAdminPasswordHash,
  getAdminUsername,
  getAuthenticatedAdmin,
  readJsonBody,
  sha256Hex,
  timingSafeEqualHex,
};
