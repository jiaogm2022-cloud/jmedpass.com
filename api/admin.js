const {
  createSessionCookie,
  clearSessionCookie,
  getAdminPasswordHash,
  getAdminUsername,
  getAuthenticatedAdmin,
  needsPasswordRehash,
  readJsonBody,
  verifyPasswordHash,
} = require('./_lib/auth');
const { enforceRateLimit, getClientIp } = require('./_lib/security');
const {
  loadCommissions,
  loadConsultations,
  loadInquiries,
  loadOrders,
  loadProducts,
  loadRules,
  loadUsers,
  loadWithdrawals,
  publicUser,
  saveCommissions,
  saveConsultations,
  saveInquiries,
  saveProducts,
  saveRules,
  saveUsers,
  saveWithdrawals,
} = require('./_lib/partner-data');
const { getDefaultProducts } = require('./_lib/catalog');

function getAction(req) {
  return String((req.query && req.query.action) || '').trim();
}

function getAllowedMethods(action) {
  if (action === 'login' || action === 'logout') return 'POST, OPTIONS';
  if (action === 'session') return 'GET, OPTIONS';
  if (action === 'data') return 'GET, POST, OPTIONS';
  return 'GET, POST, OPTIONS';
}

function methodNotAllowed(res, action) {
  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(405).json({ error: 'Method Not Allowed' });
}

function ensureAdmin(req, res) {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return admin;
}

function responsePayload() {
  return {
    inquiries: loadInquiries(),
    users: loadUsers().map((user) => publicUser(user, { includeContact: true, includeReferral: true })),
    orders: loadOrders(),
    commissions: loadCommissions(),
    withdrawals: loadWithdrawals(),
    rules: loadRules(),
    consultations: loadConsultations(),
    products: loadProducts(),
  };
}

async function handleLogin(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('login'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'login');

  try {
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
}

async function handleLogout(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('logout'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'logout');

  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok: true });
}

async function handleSession(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('session'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'session');

  const session = getAuthenticatedAdmin(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    username: session.username,
    expiresAt: session.expiresAt,
  });
}

async function handleData(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('data'));
    return res.status(200).end();
  }

  if (!ensureAdmin(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json(responsePayload());
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'data');

  try {
    const body = await readJsonBody(req);
    const section = String(body.section || '');
    const action = String(body.action || '');
    const payload = body.payload || {};

    if (section === 'inquiries') {
      if (action === 'replaceAll') {
        saveInquiries(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'updateStatus') {
        const list = loadInquiries();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Inquiry not found' });
        item.status = String(payload.status || item.status);
        saveInquiries(list);
      } else if (action === 'delete') {
        saveInquiries(loadInquiries().filter((entry) => entry.id !== payload.id));
      }
    } else if (section === 'users') {
      if (action === 'replaceAll') {
        saveUsers(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadUsers();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'User not found' });
        if (action === 'toggleStatus') {
          item.status = item.status === 'frozen' ? 'active' : 'frozen';
        }
        saveUsers(list);
      }
    } else if (section === 'commissions') {
      if (action === 'replaceAll') {
        saveCommissions(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadCommissions();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Commission not found' });
        if (action === 'settle') {
          item.status = 'settled';
          item.settledAt = new Date().toISOString();
        } else if (action === 'cancel') {
          item.status = 'cancelled';
        }
        saveCommissions(list);
      }
    } else if (section === 'withdrawals') {
      if (action === 'replaceAll') {
        saveWithdrawals(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadWithdrawals();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Withdrawal not found' });
        if (action === 'updateStatus') {
          item.status = String(payload.status || item.status);
          item.processedAt = new Date().toISOString();
        } else if (action === 'reject') {
          item.status = 'rejected';
          item.adminNote = String(payload.reason || '未填写原因');
          item.processedAt = new Date().toISOString();
        }
        saveWithdrawals(list);
      }
    } else if (section === 'rules') {
      if (action === 'replaceAll') {
        saveRules(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadRules();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Rule not found' });
        if (action === 'update') {
          item.commissionRate = Number(payload.commissionRate);
          item.cashbackRate = Number(payload.cashbackRate);
          item.isActive = Boolean(payload.isActive);
          item.updatedAt = new Date().toISOString();
        }
        saveRules(list);
      }
    } else if (section === 'consultations') {
      if (action === 'replaceAll') {
        saveConsultations(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'updateStatus') {
        const list = loadConsultations();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Consultation not found' });
        item.status = String(payload.status || item.status);
        saveConsultations(list);
      } else if (action === 'delete') {
        saveConsultations(loadConsultations().filter((entry) => entry.id !== payload.id));
      }
    } else if (section === 'products') {
      const list = loadProducts();
      if (action === 'replaceAll') {
        saveProducts(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'save') {
        const product = payload.product || {};
        if (product.id) {
          const index = list.findIndex((entry) => entry.id === product.id);
          if (index >= 0) list[index] = product;
        } else {
          product.id = Date.now();
          list.push(product);
        }
        saveProducts(list);
      } else if (action === 'delete') {
        saveProducts(list.filter((entry) => entry.id !== payload.id));
      } else if (action === 'reset') {
        saveProducts(getDefaultProducts());
      }
    } else {
      return res.status(400).json({ error: 'Unsupported section' });
    }

    return res.status(200).json({ ok: true, data: responsePayload() });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const action = getAction(req);
  if (action === 'login') return handleLogin(req, res);
  if (action === 'logout') return handleLogout(req, res);
  if (action === 'session') return handleSession(req, res);
  if (action === 'data') return handleData(req, res);

  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(400).json({ error: 'Unsupported admin action' });
};
