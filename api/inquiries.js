const { readJsonBody } = require('./_lib/auth');
const {
  isValidPhone,
  loadInquiries,
  normalizePhone,
  saveInquiries,
  uid,
} = require('./_lib/partner-data');
const { enforceRateLimit } = require('./_lib/security');

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
    const name = String(body.name || '').trim();
    const phone = normalizePhone(body.phone);
    const region = String(body.region || '').trim();
    const services = Array.isArray(body.services)
      ? body.services.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const message = String(body.message || '').trim();

    if (!name) return res.status(400).json({ error: '请填写姓名' });
    if (!phone) return res.status(400).json({ error: '请填写联系方式' });
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: '请输入有效的手机号或 WhatsApp 号码' });
    }
    if (services.length === 0) return res.status(400).json({ error: '请至少选择一项服务' });
    if (!enforceRateLimit(req, res, {
      scope: 'inquiries',
      identifier: phone,
      windowMs: 10 * 60 * 1000,
      max: 4,
      errorMessage: '提交过于频繁，请 10 分钟后再试',
    })) return;

    const record = {
      id: uid('inq'),
      name,
      phone,
      region,
      services,
      message,
      status: 'new',
      time: Date.now(),
    };

    const all = loadInquiries();
    saveInquiries([record].concat(all));

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
