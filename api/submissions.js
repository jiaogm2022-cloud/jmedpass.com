const { readJsonBody } = require('./_lib/auth');
const {
  isValidPhone,
  loadConsultations,
  loadInquiries,
  normalizePhone,
  saveConsultations,
  saveInquiries,
  uid,
} = require('./_lib/partner-data');
const { loadList, saveList } = require('./_lib/redis-data');
const { enforceRateLimit } = require('./_lib/security');

const INQUIRIES_KEY = 'jmedpass:inquiries';
const CONSULTATIONS_KEY = 'jmedpass:consultations';

function getAction(req) {
  return String((req.query && req.query.action) || '').trim();
}

function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST, OPTIONS');
  return res.status(405).json({ error: 'Method Not Allowed' });
}

async function handleInquiries(req, res) {
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
    if (!(await enforceRateLimit(req, res, {
      scope: 'inquiries',
      identifier: phone,
      windowMs: 10 * 60 * 1000,
      max: 4,
      errorMessage: '提交过于频繁，请 10 分钟后再试',
    }))) return;

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

    const all = await loadList(INQUIRIES_KEY, loadInquiries);
    await saveList(INQUIRIES_KEY, [record].concat(all), saveInquiries);

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('[SUBMISSIONS] Failed to save inquiry:', error && (error.stack || error.message || error));
    return res.status(400).json({ error: '请求格式不正确' });
  }
}

async function handleConsultations(req, res) {
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
    if (!(await enforceRateLimit(req, res, {
      scope: 'consultations',
      identifier: phone,
      windowMs: 30 * 60 * 1000,
      max: 3,
      errorMessage: '提交过于频繁，请稍后再试',
    }))) return;

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

    const list = await loadList(CONSULTATIONS_KEY, loadConsultations);
    await saveList(CONSULTATIONS_KEY, [record].concat(list), saveConsultations);

    return res.status(201).json({ ok: true, consultation: record });
  } catch (error) {
    console.error('[SUBMISSIONS] Failed to save consultation:', error && (error.stack || error.message || error));
    return res.status(400).json({ error: '请求格式不正确' });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const action = getAction(req);
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res);
  if (action === 'inquiries') return handleInquiries(req, res);
  if (action === 'consultations') return handleConsultations(req, res);

  return res.status(400).json({ error: 'Unsupported submission action' });
};
