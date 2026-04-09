const { readJsonBody } = require('./_lib/auth');
const { createPartnerSessionCookie, verifyReferralToken } = require('./_lib/partner-auth');
const { enforceRateLimit } = require('./_lib/security');
const {
  hashPassword,
  isValidPhone,
  loadUsers,
  normalizeEmail,
  normalizePhone,
  publicUser,
  saveUsers,
  uid,
} = require('./_lib/partner-data');

function createReferralCode(users) {
  let code = '';
  do {
    code = `JMEDPASS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  } while (users.some((user) => user.referralCode === code));
  return code;
}

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
    const nickname = String(body.nickname || '').trim();
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const confirmPassword = String(body.confirmPassword || '');
    const referralCode = String(body.referralCode || '').trim();
    const referralToken = String(body.referralToken || '').trim();
    const agreeTerms = Boolean(body.agreeTerms);

    if (!nickname) return res.status(400).json({ error: '请填写昵称' });
    if (!phone) return res.status(400).json({ error: '请填写手机号或 WhatsApp' });
    if (!isValidPhone(phone)) return res.status(400).json({ error: '请输入有效的手机号或 WhatsApp 号码' });
    if (!email) return res.status(400).json({ error: '请填写邮箱地址' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '请输入有效的邮箱地址' });
    if (password.length < 8) return res.status(400).json({ error: '密码至少需要 8 位' });
    if (password !== confirmPassword) return res.status(400).json({ error: '两次输入的密码不一致' });
    if (!agreeTerms) return res.status(400).json({ error: '请先同意合伙人协议与隐私说明' });
    if (!enforceRateLimit(req, res, {
      scope: 'partner-register',
      identifier: email || phone,
      windowMs: 60 * 60 * 1000,
      max: 5,
      errorMessage: '注册尝试过于频繁，请 1 小时后再试',
    })) return;

    const users = loadUsers();
    if (users.some((user) => user.phone === phone)) {
      return res.status(409).json({ error: '该手机号已注册，请直接登录' });
    }
    if (email && users.some((user) => user.email === email)) {
      return res.status(409).json({ error: '该邮箱已注册，请直接登录' });
    }

    // Verify referral: prefer signed token (tamper-proof), fall back to
    // raw code only if token verification succeeds or in dev mode.
    let verifiedRefCode = null;
    if (referralToken) {
      verifiedRefCode = verifyReferralToken(referralToken);
      // If token is present but invalid, reject the referral silently
      // (don't trust the raw referralCode from localStorage)
    } else if (referralCode && (!process.env.VERCEL || process.env.NODE_ENV === 'development')) {
      // In development, allow unsigned ref codes for convenience
      verifiedRefCode = referralCode;
    }

    const referrer = verifiedRefCode
      ? users.find((user) => user.referralCode === verifiedRefCode)
      : null;

    const user = {
      id: uid('usr'),
      nickname,
      phone,
      email,
      passwordHash: hashPassword(password),
      referralCode: createReferralCode(users),
      referredBy: referrer ? referrer.id : null,
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    saveUsers(users.concat(user));
    res.setHeader('Set-Cookie', createPartnerSessionCookie(user.id));

    return res.status(201).json({
      ok: true,
      user: publicUser(user, { includeContact: true, includeReferral: true }),
    });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
