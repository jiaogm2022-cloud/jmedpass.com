/**
 * 樱医集团 · 本地开发服务器
 * ─────────────────────────────────────────
 * 用法：
 *   1. 打开终端，cd 到 sakura-medical 文件夹
 *   2. npm install
 *   3. node server.js
 *   4. 浏览器打开 http://localhost:3000/shenghuo.html
 * ─────────────────────────────────────────
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');

/* ── Stripe test secret key (local dev only) ── */
const STRIPE_SECRET_KEY = 'sk_test_51THJkZ2fkzY2cuSW8eMjy30j51H45uA7qUXwMiOKAVH6CqAJccTc4C5erDfWhTjgOr3Eg3B7FSpl2W42qF3ZQGLZ00QXZ84gS4';
const CNY_TO_USD = 0.138; // 1 CNY ≈ 0.138 USD

let stripe;
try {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
} catch (e) {
  console.error('\n❌ stripe 模块未找到，请先运行：npm install\n');
  process.exit(1);
}

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

/* ════════════════════════════════════ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  /* CORS for all responses */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  /* ── API: Create Stripe Checkout Session ── */
  if (req.method === 'POST' && url.pathname === '/netlify/functions/create-checkout') {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', async () => {
      try {
        const { items } = JSON.parse(raw);

        const lineItems = items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              description: item.brand + '  ·  ' + item.spec,
            },
            unit_amount: Math.round(item.price * CNY_TO_USD * 100),
          },
          quantity: item.qty,
        }));

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          payment_method_types: ['card', 'alipay'],
          line_items: lineItems,
          locale: 'zh',
          shipping_address_collection: {
            allowed_countries: ['CN','HK','TW','SG','MY','AU','US','GB','JP','KR'],
          },
          shipping_options: [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 0, currency: 'usd' },
                display_name: '标准国际配送 (7–14工作日)',
                delivery_estimate: {
                  minimum: { unit: 'business_day', value: 7 },
                  maximum: { unit: 'business_day', value: 14 },
                },
              },
            },
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: { amount: 1500, currency: 'usd' },
                display_name: '快速配送 (3–5工作日)',
                delivery_estimate: {
                  minimum: { unit: 'business_day', value: 3 },
                  maximum: { unit: 'business_day', value: 5 },
                },
              },
            },
          ],
          phone_number_collection: { enabled: true },
          custom_text: {
            submit: { message: '樱医集团承诺正品直采，GMP认证，全球安全配送' },
          },
          success_url: `http://localhost:${PORT}/success.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:  `http://localhost:${PORT}/shenghuo.html?cancelled=1`,
        });

        console.log(`[Stripe] ✓ Session created: ${session.id}`);
        json(res, 200, { url: session.url });

      } catch (err) {
        console.error('[Stripe] ✗ Error:', err.message);
        json(res, 500, { error: err.message });
      }
    });
    return;
  }

  /* ── API: Get Order Details ── */
  if (req.method === 'GET' && url.pathname === '/netlify/functions/get-order') {
    const sid = url.searchParams.get('session_id');
    if (!sid) { json(res, 400, { error: 'Missing session_id' }); return; }
    try {
      const session = await stripe.checkout.sessions.retrieve(sid);
      json(res, 200, {
        id: session.id,
        payment_status: session.payment_status,
        customer_details: session.customer_details,
        shipping_details: session.shipping_details,
        amount_total: session.amount_total,
        currency: session.currency,
      });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
    return;
  }

  /* ── Serve static files ── */
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  let filePath = path.join(__dirname, pathname);

  // Auto-append .html if no extension
  if (!path.extname(filePath) && !filePath.endsWith('/')) filePath += '.html';

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

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/* ════════════════════════════════════ */
server.listen(PORT, () => {
  console.log('');
  console.log('🌸  樱医集团 · 本地开发服务器已启动');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  商城：  http://localhost:${PORT}/shenghuo.html`);
  console.log(`  首页：  http://localhost:${PORT}/index.html`);
  console.log(`  模式：  Stripe 测试模式 ✓`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('');
});
