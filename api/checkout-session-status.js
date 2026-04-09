const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { enforceRateLimit } = require('./_lib/security');

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

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }
  if (!enforceRateLimit(req, res, {
    scope: 'checkout-session-status',
    identifier: sessionId,
    windowMs: 5 * 60 * 1000,
    max: 20,
    errorMessage: '查询过于频繁，请稍后再试',
  })) return;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.status(200).json({
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
