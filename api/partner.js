const { readJsonBody } = require('./_lib/auth');
const { getAuthenticatedPartner } = require('./_lib/partner-auth');
const {
  loadCommissions,
  loadOrders,
  loadProducts,
  loadRules,
  loadUsers,
  loadWithdrawals,
  publicUser,
  saveWithdrawals,
  uid,
} = require('./_lib/partner-data');

function getAction(req) {
  return String((req.query && req.query.action) || '').trim();
}

function getAllowedMethods(action) {
  if (action === 'dashboard' || action === 'public-products') return 'GET, OPTIONS';
  if (action === 'withdrawals') return 'POST, OPTIONS';
  return 'GET, POST, OPTIONS';
}

function methodNotAllowed(res, action) {
  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(405).json({ error: 'Method Not Allowed' });
}

function getAuthorizedPartner(req, res) {
  const session = getAuthenticatedPartner(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const me = loadUsers().find((user) => user.id === session.userId);
  if (!me || me.status === 'frozen') {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  return me;
}

async function handleDashboard(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('dashboard'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'dashboard');

  const me = getAuthorizedPartner(req, res);
  if (!me) return;

  const users = loadUsers();
  const customers = users
    .filter((user) => user.referredBy === me.id)
    .map((user) => publicUser(user));
  const customerIds = new Set(customers.map((user) => user.id));

  return res.status(200).json({
    user: publicUser(me, { includeContact: true, includeReferral: true }),
    customers,
    orders: loadOrders().filter((order) => order.referrerId === me.id || customerIds.has(order.userId)),
    commissions: loadCommissions().filter((item) => item.beneficiaryId === me.id),
    withdrawals: loadWithdrawals().filter((item) => item.userId === me.id),
    rules: loadRules(),
  });
}

async function handleWithdrawals(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('withdrawals'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'withdrawals');

  const me = getAuthorizedPartner(req, res);
  if (!me) return;

  try {
    const body = await readJsonBody(req);
    const amount = Number(body.amount);
    const method = String(body.method || '').trim();
    const accountInfo = String(body.account || '').trim();

    const settledCommissions = loadCommissions().filter((item) => item.beneficiaryId === me.id && item.status === 'settled');
    const withdrawals = loadWithdrawals();
    const withdrawn = withdrawals
      .filter((item) => item.userId === me.id && (item.status === 'completed' || item.status === 'processing' || item.status === 'pending'))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const withdrawable = Math.max(0, settledCommissions.reduce((sum, item) => sum + Number(item.commissionAmt || 0), 0) - withdrawn);

    if (!Number.isFinite(amount) || amount < 50) {
      return res.status(400).json({ error: '最低提现金额为 $50' });
    }
    if (amount > withdrawable) {
      return res.status(400).json({ error: `可提现余额不足（当前可提现 $${withdrawable.toFixed(2)}）` });
    }
    if (!method) return res.status(400).json({ error: '请选择提现方式' });
    if (!accountInfo) return res.status(400).json({ error: '请填写收款账号信息' });

    const record = {
      id: uid('wd'),
      userId: me.id,
      amount: Number(amount.toFixed(2)),
      currency: 'USD',
      method,
      accountInfo,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      processedAt: null,
      adminNote: '',
    };

    saveWithdrawals(withdrawals.concat(record));
    return res.status(201).json({
      ok: true,
      withdrawal: record,
    });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
}

async function handlePublicProducts(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('public-products'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'public-products');

  return res.status(200).json({
    products: loadProducts(),
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const action = getAction(req);
  if (action === 'dashboard') return handleDashboard(req, res);
  if (action === 'withdrawals') return handleWithdrawals(req, res);
  if (action === 'public-products') return handlePublicProducts(req, res);

  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(400).json({ error: 'Unsupported partner action' });
};
