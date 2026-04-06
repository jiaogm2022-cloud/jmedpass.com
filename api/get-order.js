/* ===== Sakura Medical · Retrieve Stripe Session Details (Vercel) ===== */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer_details'],
    });

    return res.status(200).json({
      id: session.id,
      payment_status: session.payment_status,
      customer_details: session.customer_details,
      shipping_details: session.shipping_details,
      amount_total: session.amount_total,
      currency: session.currency,
      line_items: session.line_items,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
