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
  DEFAULT_RULES,
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
const { loadList, saveList } = require('./_lib/redis-data');

const INQUIRIES_KEY = 'jmedpass:inquiries';
const CONSULTATIONS_KEY = 'jmedpass:consultations';
const PRODUCTS_KEY = 'jmedpass:products';
const USERS_KEY = 'jmedpass:users';
const ORDERS_KEY = 'jmedpass:orders';
const COMMISSIONS_KEY = 'jmedpass:commissions';
const WITHDRAWALS_KEY = 'jmedpass:withdrawals';
const RULES_KEY = 'jmedpass:rules';

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

async function loadAdminInquiries() {
  return loadList(INQUIRIES_KEY, loadInquiries);
}

async function saveAdminInquiries(list) {
  return saveList(INQUIRIES_KEY, list, saveInquiries);
}

async function loadAdminConsultations() {
  return loadList(CONSULTATIONS_KEY, loadConsultations);
}

async function saveAdminConsultations(list) {
  return saveList(CONSULTATIONS_KEY, list, saveConsultations);
}

async function loadAdminProducts() {
  const products = await loadList(PRODUCTS_KEY, loadProducts);
  return products.length ? products : getDefaultProducts();
}

async function saveAdminProducts(list) {
  return saveList(PRODUCTS_KEY, list, saveProducts);
}

async function loadAdminUsers() {
  return loadList(USERS_KEY, loadUsers);
}

async function saveAdminUsers(list) {
  return saveList(USERS_KEY, list, saveUsers);
}

async function loadAdminOrders() {
  return loadList(ORDERS_KEY, loadOrders);
}

async function loadAdminCommissions() {
  return loadList(COMMISSIONS_KEY, loadCommissions);
}

async function saveAdminCommissions(list) {
  return saveList(COMMISSIONS_KEY, list, saveCommissions);
}

async function loadAdminWithdrawals() {
  return loadList(WITHDRAWALS_KEY, loadWithdrawals);
}

async function saveAdminWithdrawals(list) {
  return saveList(WITHDRAWALS_KEY, list, saveWithdrawals);
}

async function loadAdminRules() {
  const rules = await loadList(RULES_KEY, loadRules);
  return rules.length ? rules : DEFAULT_RULES.slice();
}

async function saveAdminRules(list) {
  return saveList(RULES_KEY, list, saveRules);
}

async function responsePayload() {
  const users = await loadAdminUsers();
  return {
    inquiries: await loadAdminInquiries(),
    users: users.map((user) => publicUser(user, { includeContact: true, includeReferral: true })),
    orders: await loadAdminOrders(),
    commissions: await loadAdminCommissions(),
    withdrawals: await loadAdminWithdrawals(),
    rules: await loadAdminRules(),
    consultations: await loadAdminConsultations(),
    products: await loadAdminProducts(),
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
    if (!(await enforceRateLimit(req, res, {
      scope: 'admin-login',
      identifier: clientIp,
      windowMs: 15 * 60 * 1000,
      max: 5,
      errorMessage: '登录尝试过于频繁，请 15 分钟后再试',
    }))) return;

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
    return res.status(200).json(await responsePayload());
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'data');

  try {
    const body = await readJsonBody(req);
    const section = String(body.section || '');
    const action = String(body.action || '');
    const payload = body.payload || {};

    if (section === 'inquiries') {
      if (action === 'replaceAll') {
        await saveAdminInquiries(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'updateStatus') {
        const list = await loadAdminInquiries();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Inquiry not found' });
        item.status = String(payload.status || item.status);
        await saveAdminInquiries(list);
      } else if (action === 'delete') {
        await saveAdminInquiries((await loadAdminInquiries()).filter((entry) => entry.id !== payload.id));
      }
    } else if (section === 'users') {
      if (action === 'replaceAll') {
        await saveAdminUsers(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = await loadAdminUsers();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'User not found' });
        if (action === 'toggleStatus') {
          item.status = item.status === 'frozen' ? 'active' : 'frozen';
        }
        await saveAdminUsers(list);
      }
    } else if (section === 'commissions') {
      if (action === 'replaceAll') {
        await saveAdminCommissions(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = await loadAdminCommissions();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Commission not found' });
        if (action === 'settle') {
          item.status = 'settled';
          item.settledAt = new Date().toISOString();
        } else if (action === 'cancel') {
          item.status = 'cancelled';
        }
        await saveAdminCommissions(list);
      }
    } else if (section === 'withdrawals') {
      if (action === 'replaceAll') {
        await saveAdminWithdrawals(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = await loadAdminWithdrawals();
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
        await saveAdminWithdrawals(list);
      }
    } else if (section === 'rules') {
      if (action === 'replaceAll') {
        await saveAdminRules(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = await loadAdminRules();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Rule not found' });
        if (action === 'update') {
          item.commissionRate = Number(payload.commissionRate);
          item.cashbackRate = Number(payload.cashbackRate);
          item.isActive = Boolean(payload.isActive);
          item.updatedAt = new Date().toISOString();
        }
        await saveAdminRules(list);
      }
    } else if (section === 'consultations') {
      if (action === 'replaceAll') {
        await saveAdminConsultations(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'updateStatus') {
        const list = await loadAdminConsultations();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Consultation not found' });
        item.status = String(payload.status || item.status);
        await saveAdminConsultations(list);
      } else if (action === 'delete') {
        await saveAdminConsultations((await loadAdminConsultations()).filter((entry) => entry.id !== payload.id));
      }
    } else if (section === 'products') {
      const list = await loadAdminProducts();
      if (action === 'replaceAll') {
        await saveAdminProducts(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'save') {
        const product = payload.product || {};
        if (product.id) {
          const index = list.findIndex((entry) => entry.id === product.id);
          if (index >= 0) list[index] = product;
        } else {
          product.id = Date.now();
          list.push(product);
        }
        await saveAdminProducts(list);
      } else if (action === 'delete') {
        await saveAdminProducts(list.filter((entry) => entry.id !== payload.id));
      } else if (action === 'reset') {
        await saveAdminProducts(getDefaultProducts());
      }
    } else {
      return res.status(400).json({ error: 'Unsupported section' });
    }

    return res.status(200).json({ ok: true, data: await responsePayload() });
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
