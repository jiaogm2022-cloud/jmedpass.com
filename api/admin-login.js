const {
  createSessionCookie,
  getAdminPasswordHash,
  getAdminUsername,
  needsPasswordRehash,
  readJsonBody,
  verifyPasswordHash,
} = require('./_lib/auth');
const { enforceRateLimit, getClientIp } = require('./_lib/security');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Rate limit: max 5 attempts per IP per 15 minutes
    const clientIp = getClientIp(req);
    if (!enforceRateLimit(req, res, {
      scope: 'admin-login',
      identifier: clientIp,
      windowMs: 15 * 60 * 1000,
      max: 5,
      errorMessage: '登录尝试过于频繁，请 15 分钟后再试',
    })) return;

    const body = await readJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: '请输入账号和密码' });
    }

    const expectedUsername = getAdminUsername();
    const expectedPasswordHash = getAdminPasswordHash();
    if (!expectedUsername || !expectedPasswordHash) {
      return res.status(503).json({ error: '后台账号尚未配置，请先设置环境变量' });
    }
    const validUsername = username === expectedUsername;
    const validPassword = verifyPasswordHash(password, expectedPasswordHash);

    if (!validUsername || !validPassword) {
      // Log failed attempt for audit trail
      console.warn('[ADMIN-LOGIN] Failed login attempt from IP:', clientIp, 'username:', username);
      return res.status(401).json({ error: '账号或密码错误，请重试' });
    }

    if (needsPasswordRehash(expectedPasswordHash) && process.env.VERCEL) {
      return res.status(503).json({ error: '后台密码哈希过旧，请升级为安全哈希后再登录' });
    }

    console.info('[ADMIN-LOGIN] Successful login from IP:', clientIp);
    res.setHeader('Set-Cookie', createSessionCookie(expectedUsername));
    return res.status(200).json({ ok: true, username: expectedUsername });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
