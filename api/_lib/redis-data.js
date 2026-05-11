const { Redis } = require('@upstash/redis');

const redisUrl = process.env.KV_REST_API_URL
  || process.env.KV_REST_API_ENDPOINT
  || process.env.UPSTASH_REDIS_REST_URL
  || process.env.UPSTASH_REDIS_REST_ENDPOINT;
const redisToken = process.env.KV_REST_API_TOKEN
  || process.env.KV_REST_API_READ_WRITE_TOKEN
  || process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient = null;

function hasRedisConfig() {
  return Boolean(redisUrl && redisToken);
}

function getRedis() {
  if (!hasRedisConfig()) {
    if (process.env.VERCEL === '1') {
      console.warn('[REDIS] Missing Redis REST env:', {
        KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
        KV_REST_API_ENDPOINT: Boolean(process.env.KV_REST_API_ENDPOINT),
        KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
        KV_REST_API_READ_WRITE_TOKEN: Boolean(process.env.KV_REST_API_READ_WRITE_TOKEN),
        UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        UPSTASH_REDIS_REST_TOKEN: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
        REDIS_URL: Boolean(process.env.REDIS_URL),
        KV_URL: Boolean(process.env.KV_URL),
      });
    }
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }
  return redisClient;
}

function cloneList(items) {
  return Array.isArray(items) ? JSON.parse(JSON.stringify(items)) : [];
}

async function loadList(key, fallbackLoad) {
  const redis = getRedis();
  if (!redis) return cloneList(fallbackLoad());

  const value = await redis.get(key);
  return cloneList(value);
}

async function saveList(key, items, fallbackSave) {
  const list = cloneList(items);
  const redis = getRedis();
  if (!redis) return fallbackSave(list);

  await redis.set(key, list);
  return list;
}

async function consumeRedisRateLimit(scope, key, options) {
  const redis = getRedis();
  if (!redis) return null;

  const windowMs = Number(options && options.windowMs) || 60000;
  const max = Number(options && options.max) || 5;
  const now = Date.now();
  const rateKey = `jmedpass:rate:${scope}:${key}`;
  const row = await redis.get(rateKey);

  if (!row || (now - Number(row.windowStart || 0)) >= windowMs) {
    await redis.set(rateKey, { windowStart: now, hits: 1 }, {
      ex: Math.max(60, Math.ceil((windowMs * 10) / 1000)),
    });
    return { allowed: true, remaining: Math.max(0, max - 1), retryAfterMs: 0 };
  }

  const hits = Number(row.hits || 0);
  if (hits >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - Number(row.windowStart || now))),
    };
  }

  const nextHits = hits + 1;
  await redis.set(rateKey, { windowStart: Number(row.windowStart || now), hits: nextHits }, {
    ex: Math.max(60, Math.ceil((windowMs * 10) / 1000)),
  });
  return { allowed: true, remaining: Math.max(0, max - nextHits), retryAfterMs: 0 };
}

module.exports = {
  consumeRedisRateLimit,
  hasRedisConfig,
  loadList,
  saveList,
};
