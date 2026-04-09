const { getAuthenticatedAdmin, readJsonBody } = require('./_lib/auth');
const {
  loadCommissions,
  loadConsultations,
  loadInquiries,
  loadOrders,
  loadProducts,
  loadRules,
  loadUsers,
  loadWithdrawals,
  publicUser,
  saveCommissions,
  saveConsultations,
  saveInquiries,
  saveProducts,
  saveRules,
  saveUsers,
  saveWithdrawals,
} = require('./_lib/partner-data');
const { getDefaultProducts } = require('./_lib/catalog');

function ensureAdmin(req, res) {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return admin;
}

function responsePayload() {
  return {
    inquiries: loadInquiries(),
    users: loadUsers().map((user) => publicUser(user, { includeContact: true, includeReferral: true })),
    orders: loadOrders(),
    commissions: loadCommissions(),
    withdrawals: loadWithdrawals(),
    rules: loadRules(),
    consultations: loadConsultations(),
    products: loadProducts(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(200).end();
  }

  if (!ensureAdmin(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json(responsePayload());
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const section = String(body.section || '');
    const action = String(body.action || '');
    const payload = body.payload || {};

    if (section === 'inquiries') {
      if (action === 'replaceAll') {
        saveInquiries(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'updateStatus') {
        const list = loadInquiries();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Inquiry not found' });
        item.status = String(payload.status || item.status);
        saveInquiries(list);
      } else if (action === 'delete') {
        saveInquiries(loadInquiries().filter((entry) => entry.id !== payload.id));
      }
    } else if (section === 'users') {
      if (action === 'replaceAll') {
        saveUsers(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadUsers();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'User not found' });
        if (action === 'toggleStatus') {
          item.status = item.status === 'frozen' ? 'active' : 'frozen';
        }
        saveUsers(list);
      }
    } else if (section === 'commissions') {
      if (action === 'replaceAll') {
        saveCommissions(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadCommissions();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Commission not found' });
        if (action === 'settle') {
          item.status = 'settled';
          item.settledAt = new Date().toISOString();
        } else if (action === 'cancel') {
          item.status = 'cancelled';
        }
        saveCommissions(list);
      }
    } else if (section === 'withdrawals') {
      if (action === 'replaceAll') {
        saveWithdrawals(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadWithdrawals();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Withdrawal not found' });
        if (action === 'updateStatus') {
          item.status = String(payload.status || item.status);
          item.processedAt = new Date().toISOString();
        } else if (action === 'reject') {
          item.status = 'rejected';
          item.adminNote = String(payload.reason || '未填写原因');
          item.processedAt = new Date().toISOString();
        }
        saveWithdrawals(list);
      }
    } else if (section === 'rules') {
      if (action === 'replaceAll') {
        saveRules(Array.isArray(payload.items) ? payload.items : []);
      } else {
        const list = loadRules();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Rule not found' });
        if (action === 'update') {
          item.commissionRate = Number(payload.commissionRate);
          item.cashbackRate = Number(payload.cashbackRate);
          item.isActive = Boolean(payload.isActive);
          item.updatedAt = new Date().toISOString();
        }
        saveRules(list);
      }
    } else if (section === 'consultations') {
      if (action === 'replaceAll') {
        saveConsultations(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'updateStatus') {
        const list = loadConsultations();
        const item = list.find((entry) => entry.id === payload.id);
        if (!item) return res.status(404).json({ error: 'Consultation not found' });
        item.status = String(payload.status || item.status);
        saveConsultations(list);
      } else if (action === 'delete') {
        saveConsultations(loadConsultations().filter((entry) => entry.id !== payload.id));
      }
    } else if (section === 'products') {
      const list = loadProducts();
      if (action === 'replaceAll') {
        saveProducts(Array.isArray(payload.items) ? payload.items : []);
      } else if (action === 'save') {
        const product = payload.product || {};
        if (product.id) {
          const index = list.findIndex((entry) => entry.id === product.id);
          if (index >= 0) list[index] = product;
        } else {
          product.id = Date.now();
          list.push(product);
        }
        saveProducts(list);
      } else if (action === 'delete') {
        saveProducts(list.filter((entry) => entry.id !== payload.id));
      } else if (action === 'reset') {
        saveProducts(getDefaultProducts());
      }
    } else {
      return res.status(400).json({ error: 'Unsupported section' });
    }

    return res.status(200).json({ ok: true, data: responsePayload() });
  } catch (error) {
    return res.status(400).json({ error: '请求格式不正确' });
  }
};
