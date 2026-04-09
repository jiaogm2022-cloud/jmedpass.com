/* ===== Referral Token API =====
   GET  /api/referral-token?ref=JMEDPASS-XXXX → returns a signed token
   The frontend stores this signed token instead of the raw ref code.
   On registration, the server verifies the token signature.
   ================================ */
const { signReferralToken } = require('./_lib/partner-auth');
const { loadUsers } = require('./_lib/partner-data');

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

  const ref = String((req.query && req.query.ref) || '').trim();
  if (!ref) {
    return res.status(400).json({ error: 'Missing ref parameter' });
  }

  // Verify ref code exists
  const users = loadUsers();
  const referrer = users.find(function (u) { return u.referralCode === ref; });
  if (!referrer) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }

  const token = signReferralToken(ref);
  if (!token) {
    return res.status(500).json({ error: 'Token signing unavailable' });
  }

  return res.status(200).json({ ok: true, token });
};
