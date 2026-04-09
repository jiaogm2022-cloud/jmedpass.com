const { findCatalogProduct, getDefaultProducts } = require('./catalog');
const {
  createPasswordHash,
  needsPasswordRehash,
  verifyPasswordHash,
} = require('./auth');
const { isValidPhone, normalizePhone } = require('./security');
const {
  getDb,
  getMeta,
  peekLegacyCollection,
  setMeta,
  tableRowCount,
  withTransaction,
} = require('./store');

const DEFAULT_RULES = [
  { id: 'rule_stem_cell', category: 'stem_cell', name: '干细胞/再生医疗', commissionRate: 0.20, cashbackRate: 0.03, isActive: true },
  { id: 'rule_checkup', category: 'checkup', name: '精密体检', commissionRate: 0.20, cashbackRate: 0.05, isActive: true },
  { id: 'rule_cosmetic', category: 'cosmetic', name: '医美整形', commissionRate: 0.20, cashbackRate: 0.03, isActive: true },
  { id: 'rule_immunity', category: 'immunity', name: '免疫疗法(NK细胞)', commissionRate: 0.20, cashbackRate: 0.03, isActive: true },
  { id: 'rule_nmn', category: 'nmn', name: 'NMN/保健品', commissionRate: 0.20, cashbackRate: 0.00, isActive: true },
  { id: 'rule_consult', category: 'consult', name: '远程专家会诊', commissionRate: 0.20, cashbackRate: 0.00, isActive: true },
];

const ensuredDomains = new Set();

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function hashPassword(password) {
  return createPasswordHash(password);
}

function verifyPassword(password, storedHash) {
  return verifyPasswordHash(password, storedHash);
}

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeSortList(items) {
  return Array.isArray(items) ? items : [];
}

function serializeId(value) {
  return value == null ? null : String(value);
}

function restoreId(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  if (/^-?\d+$/.test(value)) {
    const n = Number(value);
    if (Number.isSafeInteger(n)) return n;
  }
  return value;
}

function omitKeys(value, keys) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  Object.keys(source).forEach((key) => {
    if (keys.includes(key)) return;
    if (source[key] === undefined) return;
    result[key] = source[key];
  });
  return result;
}

function hasOwnKeys(value) {
  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function ensureDomain(domain, tableName, fallbackFactory, rawSave) {
  if (ensuredDomains.has(domain)) return;

  const migrationKey = `business-schema:${domain}:v1`;
  if (getMeta(migrationKey) === '1') {
    ensuredDomains.add(domain);
    return;
  }

  if (tableRowCount(tableName) > 0) {
    setMeta(migrationKey, '1');
    ensuredDomains.add(domain);
    return;
  }

  const legacyValue = peekLegacyCollection(domain);
  const seed = legacyValue == null ? fallbackFactory() : legacyValue;
  rawSave(seed);
  setMeta(migrationKey, '1');
  ensuredDomains.add(domain);
}

function rawLoadUsers() {
  const rows = getDb().prepare(`
    SELECT id, nickname, phone, email, password_hash, referral_code, referred_by, created_at, status, meta_json
    FROM users
    ORDER BY sort_index ASC, created_at ASC, id ASC
  `).all();

  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      nickname: row.nickname || '',
      phone: row.phone || '',
      email: row.email || '',
      passwordHash: row.password_hash || '',
      referralCode: row.referral_code || '',
      referredBy: row.referred_by || null,
      createdAt: row.created_at || null,
      status: row.status || 'active',
    });
  });
}

function rawSaveUsers(users) {
  const list = normalizeSortList(users);
  withTransaction((db) => {
    db.prepare('DELETE FROM users').run();
    const stmt = db.prepare(`
      INSERT INTO users (
        id, sort_index, nickname, phone, email, password_hash,
        referral_code, referred_by, created_at, status, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((user, index) => {
      const meta = omitKeys(user, ['id', 'nickname', 'phone', 'email', 'passwordHash', 'referralCode', 'referredBy', 'createdAt', 'status']);
      stmt.run(
        String(user.id || uid('usr')),
        index,
        String(user.nickname || ''),
        String(user.phone || ''),
        String(user.email || ''),
        String(user.passwordHash || ''),
        String(user.referralCode || ''),
        user.referredBy == null ? null : String(user.referredBy),
        user.createdAt || null,
        String(user.status || 'active'),
        JSON.stringify(meta)
      );
    });
  });
  return list;
}

function rawLoadInquiries() {
  const rows = getDb().prepare(`
    SELECT id, name, phone, region, message, status, submitted_at, meta_json
    FROM inquiries
    ORDER BY sort_index ASC, submitted_at DESC, id DESC
  `).all();
  const serviceRows = getDb().prepare(`
    SELECT inquiry_id, service
    FROM inquiry_services
    ORDER BY inquiry_id ASC, sort_index ASC
  `).all();
  const serviceMap = new Map();
  serviceRows.forEach((row) => {
    const list = serviceMap.get(row.inquiry_id) || [];
    list.push(row.service);
    serviceMap.set(row.inquiry_id, list);
  });

  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      name: row.name || '',
      phone: row.phone || '',
      region: row.region || '',
      services: serviceMap.get(row.id) || [],
      message: row.message || '',
      status: row.status || 'new',
      time: Number(row.submitted_at || 0),
    });
  });
}

function rawSaveInquiries(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM inquiry_services').run();
    db.prepare('DELETE FROM inquiries').run();
    const inquiryStmt = db.prepare(`
      INSERT INTO inquiries (
        id, sort_index, name, phone, region, message, status, submitted_at, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const serviceStmt = db.prepare(`
      INSERT INTO inquiry_services (inquiry_id, sort_index, service)
      VALUES (?, ?, ?)
    `);
    list.forEach((item, index) => {
      const inquiryId = String(item.id || uid('inq'));
      const meta = omitKeys(item, ['id', 'name', 'phone', 'region', 'services', 'message', 'status', 'time']);
      inquiryStmt.run(
        inquiryId,
        index,
        String(item.name || ''),
        String(item.phone || ''),
        String(item.region || ''),
        String(item.message || ''),
        String(item.status || 'new'),
        Number(item.time || Date.now()),
        JSON.stringify(meta)
      );
      (Array.isArray(item.services) ? item.services : []).forEach((service, serviceIndex) => {
        serviceStmt.run(inquiryId, serviceIndex, String(service || ''));
      });
    });
  });
  return list;
}

function rawLoadConsultations() {
  const rows = getDb().prepare(`
    SELECT id, name, phone, region, dept, preferred, symptoms, status, submitted_at, meta_json
    FROM consultations
    ORDER BY sort_index ASC, submitted_at DESC, id DESC
  `).all();
  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      name: row.name || '',
      phone: row.phone || '',
      region: row.region || '',
      dept: row.dept || '',
      preferred: row.preferred || '',
      symptoms: row.symptoms || '',
      status: row.status || 'new',
      time: Number(row.submitted_at || 0),
    });
  });
}

function rawSaveConsultations(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM consultations').run();
    const stmt = db.prepare(`
      INSERT INTO consultations (
        id, sort_index, name, phone, region, dept, preferred, symptoms, status, submitted_at, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((item, index) => {
      const meta = omitKeys(item, ['id', 'name', 'phone', 'region', 'dept', 'preferred', 'symptoms', 'status', 'time']);
      stmt.run(
        String(item.id || uid('con')),
        index,
        String(item.name || ''),
        String(item.phone || ''),
        String(item.region || ''),
        String(item.dept || ''),
        String(item.preferred || ''),
        String(item.symptoms || ''),
        String(item.status || 'new'),
        Number(item.time || Date.now()),
        JSON.stringify(meta)
      );
    });
  });
  return list;
}

function rawLoadProducts() {
  const rows = getDb().prepare(`
    SELECT id, cat, brand, name, spec, price, orig, badge, emoji, grad, description, meta_json
    FROM products
    ORDER BY sort_index ASC, id ASC
  `).all();
  const highlightRows = getDb().prepare(`
    SELECT product_id, text_value
    FROM product_highlights
    ORDER BY product_id ASC, sort_index ASC
  `).all();
  const imageRows = getDb().prepare(`
    SELECT product_id, url
    FROM product_images
    ORDER BY product_id ASC, sort_index ASC
  `).all();
  const highlightMap = new Map();
  const imageMap = new Map();

  highlightRows.forEach((row) => {
    const list = highlightMap.get(row.product_id) || [];
    list.push(row.text_value);
    highlightMap.set(row.product_id, list);
  });
  imageRows.forEach((row) => {
    const list = imageMap.get(row.product_id) || [];
    list.push(row.url);
    imageMap.set(row.product_id, list);
  });

  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      cat: row.cat || '',
      brand: row.brand || '',
      name: row.name || '',
      spec: row.spec || '',
      price: Number(row.price || 0),
      orig: row.orig == null ? null : Number(row.orig),
      badge: row.badge || '',
      emoji: row.emoji || '',
      grad: row.grad || '',
      desc: row.description || '',
      highlights: highlightMap.get(row.id) || [],
      images: imageMap.get(row.id) || [],
    });
  });
}

function rawSaveProducts(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM product_highlights').run();
    db.prepare('DELETE FROM product_images').run();
    db.prepare('DELETE FROM products').run();
    const productStmt = db.prepare(`
      INSERT INTO products (
        id, sort_index, cat, brand, name, spec, price, orig, badge, emoji, grad, description, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const highlightStmt = db.prepare(`
      INSERT INTO product_highlights (product_id, sort_index, text_value)
      VALUES (?, ?, ?)
    `);
    const imageStmt = db.prepare(`
      INSERT INTO product_images (product_id, sort_index, url)
      VALUES (?, ?, ?)
    `);
    list.forEach((item, index) => {
      const productId = String(item.id != null ? item.id : Date.now() + index);
      const meta = omitKeys(item, ['id', 'cat', 'brand', 'name', 'spec', 'price', 'orig', 'badge', 'emoji', 'grad', 'desc', 'highlights', 'images']);
      productStmt.run(
        productId,
        index,
        String(item.cat || ''),
        String(item.brand || ''),
        String(item.name || ''),
        String(item.spec || ''),
        Number(item.price || 0),
        item.orig == null || item.orig === '' ? null : Number(item.orig),
        String(item.badge || ''),
        String(item.emoji || ''),
        String(item.grad || ''),
        String(item.desc || ''),
        JSON.stringify(meta)
      );
      (Array.isArray(item.highlights) ? item.highlights : []).forEach((text, textIndex) => {
        highlightStmt.run(productId, textIndex, String(text || ''));
      });
      (Array.isArray(item.images) ? item.images : []).forEach((url, imageIndex) => {
        imageStmt.run(productId, imageIndex, String(url || ''));
      });
    });
  });
  return list;
}

function rawLoadRules() {
  const rows = getDb().prepare(`
    SELECT id, category, name, commission_rate, cashback_rate, is_active, updated_at, meta_json
    FROM commission_rules
    ORDER BY sort_index ASC, id ASC
  `).all();
  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      category: row.category || '',
      name: row.name || '',
      commissionRate: Number(row.commission_rate || 0),
      cashbackRate: Number(row.cashback_rate || 0),
      isActive: Boolean(row.is_active),
      updatedAt: row.updated_at || null,
    });
  });
}

function rawSaveRules(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM commission_rules').run();
    const stmt = db.prepare(`
      INSERT INTO commission_rules (
        id, sort_index, category, name, commission_rate, cashback_rate, is_active, updated_at, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((item, index) => {
      const meta = omitKeys(item, ['id', 'category', 'name', 'commissionRate', 'cashbackRate', 'isActive', 'updatedAt']);
      stmt.run(
        String(item.id || uid('rule')),
        index,
        String(item.category || ''),
        String(item.name || ''),
        Number(item.commissionRate || 0),
        Number(item.cashbackRate || 0),
        item.isActive ? 1 : 0,
        item.updatedAt || null,
        JSON.stringify(meta)
      );
    });
  });
  return list;
}

function rawLoadCommissions() {
  const rows = getDb().prepare(`
    SELECT id, beneficiary_id, user_id, order_id, category, status, commission_rate, cashback_rate, commission_amt, cashback_amt, created_at, settled_at, meta_json
    FROM commissions
    ORDER BY sort_index ASC, id ASC
  `).all();
  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    const settledAt = row.settled_at || null;
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      beneficiaryId: row.beneficiary_id || null,
      userId: row.user_id || null,
      orderId: row.order_id || null,
      category: row.category || '',
      status: row.status || 'pending',
      commissionRate: Number(row.commission_rate || 0),
      cashbackRate: Number(row.cashback_rate || 0),
      commissionAmt: Number(row.commission_amt || 0),
      cashbackAmt: Number(row.cashback_amt || 0),
      createdAt: row.created_at || null,
      settledAt,
      settleAt: settledAt,
    });
  });
}

function rawSaveCommissions(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM commissions').run();
    const stmt = db.prepare(`
      INSERT INTO commissions (
        id, sort_index, beneficiary_id, user_id, order_id, category, status,
        commission_rate, cashback_rate, commission_amt, cashback_amt, created_at, settled_at, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((item, index) => {
      const settledAt = item.settledAt || item.settleAt || null;
      const meta = omitKeys(item, ['id', 'beneficiaryId', 'userId', 'orderId', 'category', 'status', 'commissionRate', 'cashbackRate', 'commissionAmt', 'cashbackAmt', 'createdAt', 'settledAt', 'settleAt']);
      stmt.run(
        String(item.id || uid('comm')),
        index,
        item.beneficiaryId == null ? null : String(item.beneficiaryId),
        item.userId == null ? null : String(item.userId),
        item.orderId == null ? null : String(item.orderId),
        String(item.category || ''),
        String(item.status || 'pending'),
        Number(item.commissionRate || 0),
        Number(item.cashbackRate || 0),
        Number(item.commissionAmt || 0),
        Number(item.cashbackAmt || 0),
        item.createdAt || null,
        settledAt,
        JSON.stringify(meta)
      );
    });
  });
  return list;
}

function rawLoadWithdrawals() {
  const rows = getDb().prepare(`
    SELECT id, user_id, amount, currency, method, account_info, status, requested_at, processed_at, admin_note, meta_json
    FROM withdrawals
    ORDER BY sort_index ASC, requested_at DESC, id DESC
  `).all();
  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      userId: row.user_id || '',
      amount: Number(row.amount || 0),
      currency: row.currency || 'USD',
      method: row.method || '',
      accountInfo: row.account_info || '',
      status: row.status || 'pending',
      requestedAt: row.requested_at || null,
      processedAt: row.processed_at || null,
      adminNote: row.admin_note || '',
    });
  });
}

function rawSaveWithdrawals(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM withdrawals').run();
    const stmt = db.prepare(`
      INSERT INTO withdrawals (
        id, sort_index, user_id, amount, currency, method, account_info,
        status, requested_at, processed_at, admin_note, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((item, index) => {
      const meta = omitKeys(item, ['id', 'userId', 'amount', 'currency', 'method', 'accountInfo', 'status', 'requestedAt', 'processedAt', 'adminNote']);
      stmt.run(
        String(item.id || uid('wd')),
        index,
        String(item.userId || ''),
        Number(item.amount || 0),
        String(item.currency || 'USD'),
        String(item.method || ''),
        String(item.accountInfo || ''),
        String(item.status || 'pending'),
        item.requestedAt || null,
        item.processedAt || null,
        String(item.adminNote || ''),
        JSON.stringify(meta)
      );
    });
  });
  return list;
}

function rawLoadOrders() {
  const rows = getDb().prepare(`
    SELECT id, user_id, referrer_id, status, currency, total_amount, created_at, completed_at, meta_json
    FROM orders
    ORDER BY sort_index ASC, created_at DESC, id DESC
  `).all();
  return rows.map((row) => {
    const meta = parseJson(row.meta_json, {});
    return Object.assign({}, meta, {
      id: restoreId(row.id),
      userId: row.user_id || null,
      referrerId: row.referrer_id || null,
      status: row.status || '',
      currency: row.currency || 'USD',
      totalAmount: Number(row.total_amount || 0),
      createdAt: row.created_at || null,
      completedAt: row.completed_at || null,
    });
  });
}

function rawSaveOrders(items) {
  const list = normalizeSortList(items);
  withTransaction((db) => {
    db.prepare('DELETE FROM orders').run();
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, sort_index, user_id, referrer_id, status, currency, total_amount, created_at, completed_at, meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((item, index) => {
      const meta = omitKeys(item, ['id', 'userId', 'referrerId', 'status', 'currency', 'totalAmount', 'createdAt', 'completedAt']);
      stmt.run(
        String(item.id || uid('ord')),
        index,
        item.userId == null ? null : String(item.userId),
        item.referrerId == null ? null : String(item.referrerId),
        String(item.status || ''),
        String(item.currency || 'USD'),
        Number(item.totalAmount || item.amount || 0),
        item.createdAt || null,
        item.completedAt || null,
        JSON.stringify(meta)
      );
    });
  });
  return list;
}

function loadUsers() {
  ensureDomain('users', 'users', () => [], rawSaveUsers);
  return rawLoadUsers();
}

function saveUsers(users) {
  ensureDomain('users', 'users', () => [], rawSaveUsers);
  return rawSaveUsers(users);
}

function loadInquiries() {
  ensureDomain('inquiries', 'inquiries', () => [], rawSaveInquiries);
  return rawLoadInquiries();
}

function saveInquiries(list) {
  ensureDomain('inquiries', 'inquiries', () => [], rawSaveInquiries);
  return rawSaveInquiries(list);
}

function loadOrders() {
  ensureDomain('orders', 'orders', () => [], rawSaveOrders);
  return rawLoadOrders();
}

function saveOrders(list) {
  ensureDomain('orders', 'orders', () => [], rawSaveOrders);
  return rawSaveOrders(list);
}

function loadCommissions() {
  ensureDomain('commissions', 'commissions', () => [], rawSaveCommissions);
  return rawLoadCommissions();
}

function saveCommissions(list) {
  ensureDomain('commissions', 'commissions', () => [], rawSaveCommissions);
  return rawSaveCommissions(list);
}

function loadWithdrawals() {
  ensureDomain('withdrawals', 'withdrawals', () => [], rawSaveWithdrawals);
  return rawLoadWithdrawals();
}

function saveWithdrawals(list) {
  ensureDomain('withdrawals', 'withdrawals', () => [], rawSaveWithdrawals);
  return rawSaveWithdrawals(list);
}

function loadRules() {
  ensureDomain('commission-rules', 'commission_rules', () => DEFAULT_RULES.slice(), rawSaveRules);
  return rawLoadRules();
}

function saveRules(list) {
  ensureDomain('commission-rules', 'commission_rules', () => DEFAULT_RULES.slice(), rawSaveRules);
  return rawSaveRules(list);
}

function loadProducts() {
  ensureDomain('products', 'products', () => getDefaultProducts(), rawSaveProducts);
  return rawLoadProducts().map((product) => {
    const catalog = findCatalogProduct(product.id);
    return catalog ? Object.assign({}, catalog, product) : product;
  });
}

function saveProducts(list) {
  ensureDomain('products', 'products', () => getDefaultProducts(), rawSaveProducts);
  return rawSaveProducts(list);
}

function loadConsultations() {
  ensureDomain('consultations', 'consultations', () => [], rawSaveConsultations);
  return rawLoadConsultations();
}

function saveConsultations(list) {
  ensureDomain('consultations', 'consultations', () => [], rawSaveConsultations);
  return rawSaveConsultations(list);
}

function publicUser(user, options) {
  if (!user) return null;
  const settings = options || {};
  const payload = {
    id: user.id,
    nickname: user.nickname,
    referredBy: user.referredBy,
    createdAt: user.createdAt,
    status: user.status,
  };

  if (settings.includeContact) {
    payload.phone = user.phone;
    payload.email = user.email;
  }

  if (settings.includeReferral) {
    payload.referralCode = user.referralCode;
  }

  return payload;
}

module.exports = {
  DEFAULT_RULES,
  hashPassword,
  loadCommissions,
  loadConsultations,
  loadInquiries,
  loadOrders,
  loadProducts,
  loadRules,
  loadUsers,
  loadWithdrawals,
  normalizeEmail,
  needsPasswordRehash,
  isValidPhone,
  normalizePhone,
  publicUser,
  saveCommissions,
  saveConsultations,
  saveInquiries,
  saveOrders,
  saveProducts,
  saveRules,
  saveUsers,
  saveWithdrawals,
  uid,
  verifyPassword,
};
