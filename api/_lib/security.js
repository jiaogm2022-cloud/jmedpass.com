const { consumeRateLimit } = require('./store');
const { consumeRedisRateLimit } = require('./redis-data');

function normalizePhone(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  let normalized = raw.replace(/[^\d+]/g, '');
  normalized = normalized.replace(/(?!^)\+/g, '');

  if (normalized.startsWith('+')) {
    normalized = `+${normalized.slice(1).replace(/\+/g, '')}`;
  } else {
    normalized = normalized.replace(/\+/g, '');
  }

  return normalized;
}

function isValidPhone(input) {
  return /^\+?\d{6,15}$/.test(normalizePhone(input));
}

function normalizeIp(input) {
  const value = String(input || '').split(',')[0].trim();
  if (!value) return 'unknown';
  return value.replace(/^::ffff:/, '');
}

function getClientIp(req) {
  return normalizeIp(
    (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']))
    || (req.socket && req.socket.remoteAddress)
    || (req.connection && req.connection.remoteAddress)
    || ''
  );
}

async function enforceRateLimit(req, res, options) {
  const scope = String(options.scope || 'default');
  const identifier = String(options.identifier || '').trim().toLowerCase();
  const windowMs = Number(options.windowMs) || 60000;
  const max = Number(options.max) || 5;
  const key = identifier
    ? `${getClientIp(req)}:${identifier}`
    : getClientIp(req);
  const result = await consumeRedisRateLimit(scope, key, { windowMs, max })
    || consumeRateLimit(scope, key, { windowMs, max });

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
    res.status(429).json({
      error: options.errorMessage || '请求过于频繁，请稍后再试',
    });
    return false;
  }

  return true;
}

module.exports = {
  enforceRateLimit,
  getClientIp,
  isValidPhone,
  normalizePhone,
};
