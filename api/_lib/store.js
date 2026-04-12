const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

/* ===== Production safety check =====
   On Vercel / serverless, local SQLite is unreliable:
   - /tmp is ephemeral and per-instance (no cross-instance consistency)
   - process.cwd() is read-only on Vercel
   Set JMEDPASS_DB_PATH to a persistent volume, or migrate to a hosted
   database (Turso, Neon, PlanetScale, Supabase) before going live.
   ==================================== */
const IS_PRODUCTION = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const DB_PATH = process.env.JMEDPASS_DB_PATH
    || (IS_PRODUCTION
            ? path.join('/tmp', 'jmedpass.sqlite')
            : path.join(process.cwd(), 'data', 'jmedpass.sqlite'));

if (IS_PRODUCTION && !process.env.JMEDPASS_DB_PATH) {
  console.error(
    '[CRITICAL] JMEDPASS_DB_PATH is not set in production. ' +
    'Local SQLite on Vercel is ephemeral and will lose data across deployments. ' +
    'Set JMEDPASS_DB_PATH to a persistent path or migrate to a hosted database.'
  );
}

const LEGACY_DATA_DIRS = Array.from(new Set([
  process.env.JMEDPASS_DATA_DIR,
  '/tmp/jmedpass-data',
].filter(Boolean)));

let db;

function ensureDbDir() {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  } catch (err) {
    if (IS_PRODUCTION) {
      console.error('[CRITICAL] Cannot create DB directory:', err.message);
    }
    throw err;
  }
}

function getDb() {
  if (db) return db;

  ensureDbDir();
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      name TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (scope, key)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      nickname TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      referral_code TEXT NOT NULL DEFAULT '',
      referred_by TEXT,
      created_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      submitted_at INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiry_services (
      inquiry_id TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0,
      service TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (inquiry_id, sort_index)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      dept TEXT NOT NULL DEFAULT '',
      preferred TEXT NOT NULL DEFAULT '',
      symptoms TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      submitted_at INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      cat TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      spec TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      orig REAL,
      badge TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '',
      grad TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_highlights (
      product_id TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0,
      text_value TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (product_id, sort_index)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_images (
      product_id TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0,
      url TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (product_id, sort_index)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS commission_rules (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      commission_rate REAL NOT NULL DEFAULT 0,
      cashback_rate REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT,
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      beneficiary_id TEXT,
      user_id TEXT,
      order_id TEXT,
      category TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      commission_rate REAL NOT NULL DEFAULT 0,
      cashback_rate REAL NOT NULL DEFAULT 0,
      commission_amt REAL NOT NULL DEFAULT 0,
      cashback_amt REAL NOT NULL DEFAULT 0,
      created_at TEXT,
      settled_at TEXT,
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      user_id TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      method TEXT NOT NULL DEFAULT '',
      account_info TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT,
      processed_at TEXT,
      admin_note TEXT NOT NULL DEFAULT '',
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      sort_index INTEGER NOT NULL DEFAULT 0,
      user_id TEXT,
      referrer_id TEXT,
      status TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'USD',
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT,
      completed_at TEXT,
      meta_json TEXT NOT NULL DEFAULT '{}'
    )
  `);
  return db;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function upsertCollection(name, value) {
  getDb().prepare(`
    INSERT INTO collections (name, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(name, JSON.stringify(value), Date.now());
}

function findLegacyCollection(name) {
  for (const dir of LEGACY_DATA_DIRS) {
    const filePath = path.join(dir, `${name}.json`);
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, 'utf8').trim();
      if (!raw) continue;
      return JSON.parse(raw);
    } catch (error) {
      continue;
    }
  }
  return null;
}

function readCollection(name, fallbackValue) {
  const row = getDb()
    .prepare('SELECT payload FROM collections WHERE name = ?')
    .get(name);

  if (row && row.payload) {
    try {
      return JSON.parse(row.payload);
    } catch (error) {
      writeCollection(name, fallbackValue);
      return clone(fallbackValue);
    }
  }

  const legacyValue = findLegacyCollection(name);
  if (legacyValue != null) {
    upsertCollection(name, legacyValue);
    return clone(legacyValue);
  }

  writeCollection(name, fallbackValue);
  return clone(fallbackValue);
}

function writeCollection(name, value) {
  upsertCollection(name, value);
  return clone(value);
}

function getMeta(key) {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(String(key));
  return row ? row.value : null;
}

function setMeta(key, value) {
  getDb().prepare(`
    INSERT INTO app_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(key), String(value));
}

function peekLegacyCollection(name) {
  const row = getDb()
    .prepare('SELECT payload FROM collections WHERE name = ?')
    .get(name);

  if (row && row.payload) {
    try {
      return JSON.parse(row.payload);
    } catch (error) {
      return null;
    }
  }

  return findLegacyCollection(name);
}

function tableRowCount(tableName) {
  const row = getDb().prepare(`SELECT COUNT(1) AS count FROM ${tableName}`).get();
  return Number((row && row.count) || 0);
}

function withTransaction(fn) {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn(database);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function consumeRateLimit(scope, key, options) {
  const windowMs = Number(options && options.windowMs) || 60000;
  const max = Number(options && options.max) || 5;
  const now = Date.now();
  const database = getDb();

  database.prepare('DELETE FROM rate_limits WHERE updated_at < ?').run(now - (windowMs * 10));

  const row = database
    .prepare('SELECT window_start, hits FROM rate_limits WHERE scope = ? AND key = ?')
    .get(scope, key);

  if (!row || (now - row.window_start) >= windowMs) {
    database.prepare(`
      INSERT INTO rate_limits (scope, key, window_start, hits, updated_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(scope, key) DO UPDATE SET
        window_start = excluded.window_start,
        hits = excluded.hits,
        updated_at = excluded.updated_at
    `).run(scope, key, now, now);
    return { allowed: true, remaining: Math.max(0, max - 1), retryAfterMs: 0 };
  }

  if (row.hits >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - row.window_start)),
    };
  }

  const hits = row.hits + 1;
  database
    .prepare('UPDATE rate_limits SET hits = ?, updated_at = ? WHERE scope = ? AND key = ?')
    .run(hits, now, scope, key);

  return { allowed: true, remaining: Math.max(0, max - hits), retryAfterMs: 0 };
}

module.exports = {
  DB_PATH,
  consumeRateLimit,
  getDb,
  getMeta,
  peekLegacyCollection,
  readCollection,
  setMeta,
  tableRowCount,
  withTransaction,
  writeCollection,
};
