const { getAuthenticatedPartner } = require('./_lib/partner-auth');
const {
  loadCommissions,
  loadOrders,
  loadRules,
  loadUsers,
  loadWithdrawals,
  publicUser,
} = require('./_lib/partner-data');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = getAuthenticatedPartner(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const users = loadUsers();
  const me = users.find((user) => user.id === session.userId);
  if (!me || me.status === 'frozen') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
};
