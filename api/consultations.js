const { readJsonBody } = require('./_lib/auth');
const {
  isValidPhone,
  loadConsultations,
  normalizePhone,
  saveConsultations,
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
    const dept = String(body.dept || '').trim();
    const preferred = String(body.preferred || '').trim();
    const symptoms = String(body.symptoms || '').trim();

    if (!name || !phone || !dept) {
      return res.status(400).json({ error: '请填写姓名、联系方式及会诊方向' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: '请输入有效的手机号或 WhatsApp 号码' });
    }
    if (!enforceRateLimit(req, res, {
      scope: 'consultations',
      identifier: phone,
      windowMs: 30 * 60 * 1000,
      max: 3,
      errorMessage: '提交过于频繁，请稍后再试',
    })) return;

    const record = {
      id: uid('con'),
      name,
      phone,
      region,
      dept,
      preferred,
      symptoms,
      status: 'new',
      time: Date.now(),
    };

    const list = loadConsultations();
    saveConsultations([record].concat(list));

    return res.status(201).json({ ok: true, consultation: record });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
