/**
 * 日医通 · 本地开发服务器
 * ─────────────────────────────────────────
 * 用法：
 *   1. 打开终端，cd 到 jmedpass.com 文件夹
 *   2. npm install
 *   3. node server.js
 *   4. 浏览器打开 http://localhost:3000/wellness.html
 * ─────────────────────────────────────────
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg' : 'image/svg+xml',
  '.ico' : 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const API_ROUTE_MAP = {
  'admin-login': { module: 'admin', action: 'login' },
  'admin-logout': { module: 'admin', action: 'logout' },
  'admin-session': { module: 'admin', action: 'session' },
  'admin-data': { module: 'admin', action: 'data' },
  'partner-login': { module: 'partner-auth', action: 'login' },
  'partner-logout': { module: 'partner-auth', action: 'logout' },
  'partner-register': { module: 'partner-auth', action: 'register' },
  'partner-session': { module: 'partner-auth', action: 'session' },
  'referral-token': { module: 'partner-auth', action: 'referral-token' },
  'partner-dashboard': { module: 'partner', action: 'dashboard' },
  'partner-withdrawals': { module: 'partner', action: 'withdrawals' },
  'public-products': { module: 'partner', action: 'public-products' },
  'create-checkout': { module: 'commerce', action: 'create-checkout' },
  'checkout-session-status': { module: 'commerce', action: 'checkout-session-status' },
  'get-order': { module: 'commerce', action: 'get-order' },
  'inquiries': { module: 'submissions', action: 'inquiries' },
  'consultations': { module: 'submissions', action: 'consultations' },
};

/* ════════════════════════════════════ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith('/api/')) {
    await handleApiRequest(req, res, url);
    return;
  }

  if (url.pathname.startsWith('/.netlify/functions/')) {
    const apiPath = url.pathname.replace('/.netlify/functions/', '/api/');
    const forwardedUrl = new URL(apiPath + url.search, `http://localhost:${PORT}`);
    await handleApiRequest(req, res, forwardedUrl);
    return;
  }

  /* ── Block access to sensitive paths ── */
  const BLOCKED_PREFIXES = ['/data/', '/.env', '/.git/', '/node_modules/'];
  const BLOCKED_EXTS = ['.sqlite', '.sqlite-wal', '.sqlite-shm'];
  const lowerPath = url.pathname.toLowerCase();
  if (BLOCKED_PREFIXES.some(p => lowerPath.startsWith(p))
      || BLOCKED_EXTS.some(e => lowerPath.endsWith(e))
      || lowerPath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  /* ── Serve static files ── */
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (pathname.endsWith('/')) pathname += 'index.html';
  let filePath = path.join(__dirname, pathname);

  // Auto-resolve clean URLs and directory indexes.
  if (!path.extname(filePath) && !filePath.endsWith('/')) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    } else {
      filePath += '.html';
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + pathname);
      } else {
        res.writeHead(500); res.end('Server Error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

async function handleApiRequest(req, res, url) {
  const apiName = url.pathname.replace(/^\/api\//, '');
  const route = API_ROUTE_MAP[apiName];
  const resolvedApiName = route ? route.module : apiName;
  if (route && route.action && !url.searchParams.has('action')) {
    url.searchParams.set('action', route.action);
  }
  const modulePath = path.join(__dirname, 'api', `${resolvedApiName}.js`);
  if (!fs.existsSync(modulePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API Not Found' }));
    return;
  }

  delete require.cache[require.resolve(modulePath)];
  const handler = require(modulePath);
  req.query = Object.fromEntries(url.searchParams.entries());

  const wrappedRes = {
    setHeader: (...args) => res.setHeader(...args),
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      res.statusCode = this.statusCode || 200;
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(payload));
    },
    end(payload) {
      res.statusCode = this.statusCode || res.statusCode || 200;
      res.end(payload);
    },
  };

  try {
    await handler(req, wrappedRes);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/* ════════════════════════════════════ */
server.listen(PORT, () => {
  console.log('');
  console.log('🌸  日医通 · 本地开发服务器已启动');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  商城：  http://localhost:${PORT}/wellness.html`);
  console.log(`  首页：  http://localhost:${PORT}/index.html`);
  console.log(`  模式：  Stripe 测试模式 ✓`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('');
});
