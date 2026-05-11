const { readJsonBody } = require('./_lib/auth');
const { canSendEmails, getBaseUrl, sendPartnerPasswordResetEmail } = require('./_lib/mail');
const { createPasswordResetToken } = require('./_lib/partner-password-reset');
const { loadUsers, normalizeEmail } = require('./_lib/partner-data');
const { loadList } = require('./_lib/redis-data');
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
    const email = normalizeEmail(body.email);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '请输入注册时使用的邮箱地址' });
    }

    if (!canSendEmails()) {
      return res.status(503).json({ error: '邮件服务暂未配置，请稍后再试或联系客服' });
    }

    if (!(await enforceRateLimit(req, res, {
      scope: 'partner-forgot-password',
      identifier: email,
      windowMs: 15 * 60 * 1000,
      max: 5,
      errorMessage: '重置请求过于频繁，请稍后再试',
    }))) return;

    const users = await loadList(USERS_KEY, loadUsers);
    const user = users.find((item) => item.email === email);

    if (user) {
      const token = createPasswordResetToken(user);
      const resetUrl = `${getBaseUrl(req)}/login?reset=${encodeURIComponent(token)}`;
      try {
        await sendPartnerPasswordResetEmail(user, resetUrl);
      } catch (error) {
        console.error('[PARTNER-FORGOT-PASSWORD] Failed to send reset email:', error.message);
        return res.status(502).json({ error: '重置邮件发送失败，请稍后再试' });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
