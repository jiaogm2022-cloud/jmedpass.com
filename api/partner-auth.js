const { readJsonBody } = require('./_lib/auth');
const {
  clearPartnerSessionCookie,
  createPartnerSessionCookie,
  getAuthenticatedPartner,
  signReferralToken,
  verifyReferralToken,
} = require('./_lib/partner-auth');
const { enforceRateLimit } = require('./_lib/security');
const {
  hashPassword,
  isValidPhone,
  loadUsers,
  needsPasswordRehash,
  normalizeEmail,
  normalizePhone,
  publicUser,
  saveUsers,
  uid,
  verifyPassword,
} = require('./_lib/partner-data');

function getAction(req) {
  return String((req.query && req.query.action) || '').trim();
}

function getAllowedMethods(action) {
  if (action === 'session' || action === 'referral-token') return 'GET, OPTIONS';
  if (action === 'login' || action === 'logout' || action === 'register') return 'POST, OPTIONS';
  return 'GET, POST, OPTIONS';
}

function methodNotAllowed(res, action) {
  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(405).json({ error: 'Method Not Allowed' });
}

function createReferralCode(users) {
  let code = '';
  do {
    code = `JMEDPASS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  } while (users.some((user) => user.referralCode === code));
  return code;
}

async function handleLogin(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('login'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'login');

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
}

async function handleLogout(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('logout'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'logout');

  res.setHeader('Set-Cookie', clearPartnerSessionCookie());
  return res.status(200).json({ ok: true });
}

async function handleRegister(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('register'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'register');

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

    let verifiedRefCode = null;
    if (referralToken) {
      verifiedRefCode = verifyReferralToken(referralToken);
    } else if (referralCode && (!process.env.VERCEL || process.env.NODE_ENV === 'development')) {
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
}

async function handleSession(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('session'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'session');

  const session = getAuthenticatedPartner(req);
  if (!session) {
    return res.status(200).json({ authenticated: false });
  }

  const user = loadUsers().find((item) => item.id === session.userId);
  if (!user || user.status === 'frozen') {
    return res.status(200).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    user: publicUser(user, { includeContact: true, includeReferral: true }),
    expiresAt: session.expiresAt,
  });
}

async function handleReferralToken(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('referral-token'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'referral-token');

  const ref = String((req.query && req.query.ref) || '').trim();
  if (!ref) {
    return res.status(400).json({ error: 'Missing ref parameter' });
  }

  const users = loadUsers();
  const referrer = users.find((user) => user.referralCode === ref);
  if (!referrer) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }

  const token = signReferralToken(ref);
  if (!token) {
    return res.status(500).json({ error: 'Token signing unavailable' });
  }

  return res.status(200).json({ ok: true, token });
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const action = getAction(req);
  if (action === 'login') return handleLogin(req, res);
  if (action === 'logout') return handleLogout(req, res);
  if (action === 'register') return handleRegister(req, res);
  if (action === 'session') return handleSession(req, res);
  if (action === 'referral-token') return handleReferralToken(req, res);

  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(400).json({ error: 'Unsupported partner auth action' });
};
