const { readJsonBody } = require('./_lib/auth');
const { getAuthenticatedPartner } = require('./_lib/partner-auth');
const {
  loadCommissions,
  loadUsers,
  loadWithdrawals,
  saveWithdrawals,
  uid,
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

  const session = getAuthenticatedPartner(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const me = loadUsers().find((user) => user.id === session.userId);
  if (!me || me.status === 'frozen') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
};
