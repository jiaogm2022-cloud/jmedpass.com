const { readJsonBody } = require('./_lib/auth');
const { createPartnerSessionCookie } = require('./_lib/partner-auth');
const { verifyPasswordResetToken } = require('./_lib/partner-password-reset');
const {
  hashPassword,
  loadUsers,
  saveUsers,
} = require('./_lib/partner-data');
const { loadList, saveList } = require('./_lib/redis-data');
const { enforceRateLimit } = require('./_lib/security');

const USERS_KEY = 'jmedpass:users';

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
    const token = String(body.token || '').trim();
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!token) return res.status(400).json({ error: '重置链接无效，请重新申请' });
    if (password.length < 8) return res.status(400).json({ error: '密码至少需要 8 位' });
    if (password !== confirmPassword) return res.status(400).json({ error: '两次输入的密码不一致' });

    if (!(await enforceRateLimit(req, res, {
      scope: 'partner-reset-password',
      identifier: token.slice(0, 24),
      windowMs: 15 * 60 * 1000,
      max: 8,
      errorMessage: '重置尝试过于频繁，请稍后再试',
    }))) return;

    const users = await loadList(USERS_KEY, loadUsers);
    const user = users.find((item) => verifyPasswordResetToken(token, item).ok);

    if (!user) {
      return res.status(400).json({ error: '重置链接已失效或不可用，请重新申请' });
    }

    user.passwordHash = hashPassword(password);
    await saveList(USERS_KEY, users, saveUsers);
    res.setHeader('Set-Cookie', createPartnerSessionCookie(user.id));

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
