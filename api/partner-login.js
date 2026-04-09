const { readJsonBody } = require('./_lib/auth');
const { createPartnerSessionCookie } = require('./_lib/partner-auth');
const { enforceRateLimit } = require('./_lib/security');
const {
  hashPassword,
  loadUsers,
  needsPasswordRehash,
  normalizeEmail,
  normalizePhone,
  publicUser,
  saveUsers,
  verifyPassword,
} = require('./_lib/partner-data');

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
    const body = await readJsonBody(req);
    const identifier = String(body.identifier || '').trim();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ error: '请输入账号和密码' });
    }
    if (!enforceRateLimit(req, res, {
      scope: 'partner-login',
      identifier,
      windowMs: 15 * 60 * 1000,
      max: 8,
      errorMessage: '登录尝试过于频繁，请稍后再试',
    })) return;

    const phone = normalizePhone(identifier);
    const email = normalizeEmail(identifier);
    const users = loadUsers();
    const user = users.find((item) =>
      (item.phone === phone || (email && item.email === email)) && verifyPassword(password, item.passwordHash)
    );

    if (!user) return res.status(401).json({ error: '账号或密码错误，请检查后重试' });
    if (user.status === 'frozen') return res.status(403).json({ error: '该账号已被冻结，请联系客服' });

    if (needsPasswordRehash(user.passwordHash)) {
      user.passwordHash = hashPassword(password);
      saveUsers(users);
    }

    res.setHeader('Set-Cookie', createPartnerSessionCookie(user.id));
    return res.status(200).json({
      ok: true,
      user: publicUser(user, { includeContact: true, includeReferral: true }),
    });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
