const { getAuthenticatedPartner } = require('./_lib/partner-auth');
const { loadUsers, publicUser } = require('./_lib/partner-data');

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
};
