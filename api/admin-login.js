const {
  createSessionCookie,
  getAdminPasswordHash,
  getAdminUsername,
  readJsonBody,
  sha256Hex,
  timingSafeEqualHex,
} = require('./_lib/auth');

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

  try {
    const body = await readJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: '请输入账号和密码' });
    }

    const expectedUsername = getAdminUsername();
    const passwordHash = sha256Hex(password);
    const validUsername = username === expectedUsername;
    const validPassword = timingSafeEqualHex(passwordHash, getAdminPasswordHash());

    if (!validUsername || !validPassword) {
      return res.status(401).json({ error: '账号或密码错误，请重试' });
    }

    res.setHeader('Set-Cookie', createSessionCookie(expectedUsername));
    return res.status(200).json({ ok: true, username: expectedUsername });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
