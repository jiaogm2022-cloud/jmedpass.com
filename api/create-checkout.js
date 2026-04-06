/* ===== Sakura Medical · Stripe Checkout Session Creator (Vercel) =====
   Environment variable required in Vercel dashboard:
   STRIPE_SECRET_KEY = sk_test_... (or sk_live_... for production)
   ===================================================================== */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// JPY → SGD conversion (approximate, update as needed)
// Stripe account default currency is SGD (Singapore Dollar)
// 1 JPY ≈ 0.00896 SGD (as of April 2026)
const JPY_TO_SGD = 0.00896;

// Allowed redirect origins
const ALLOWED_ORIGINS = new Set([
  'https://jmedpass.com',
  'https://www.jmedpass.com',
]);

// Input limits
const MAX_ITEMS = 20;
const MAX_NAME_LEN = 200;
const MAX_PRICE_JPY = 2500000;
const MAX_QTY = 99;

/* ===== Shipping rate configuration (JPY) =====
   Reference: Japan Post EMS international rates (2026)
   Zone 1 (CN/KR/TW):  ~500g ¥2,000 JPY  ~1kg ¥2,500 JPY
   Zone 2 (VN/TH/SG):  ~500g ¥2,200 JPY  ~1kg ¥3,000 JPY
   ============================================== */
const FREE_SHIPPING_THRESHOLD_JPY = 46200;
const STANDARD_SHIPPING_JPY = 2960;
const EXPRESS_SHIPPING_JPY  = 5960;

module.exports = async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://jmedpass.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: '购物车为空' });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ error: '商品数量超出限制' });
    }

    // Calculate subtotal in JPY for shipping threshold logic
    var subtotalJPY = 0;

    // Build Stripe line items (convert JPY → SGD → cents)
    const lineItems = items.map(function (item) {
      const price = Number(item.price);
      const qty   = Math.floor(Number(item.qty));
      if (!isFinite(price) || price <= 0 || price > MAX_PRICE_JPY) throw new Error('无效价格');
      if (!isFinite(qty)   || qty   <= 0 || qty   > MAX_QTY)      throw new Error('无效数量');
      const name = String(item.name || '').slice(0, MAX_NAME_LEN);
      const brand = String(item.brand || '').slice(0, 100);
      const spec  = String(item.spec  || '').slice(0, 100);
      const sgdPrice = Math.round(price * JPY_TO_SGD * 100);

      subtotalJPY += price * qty;

      return {
        price_data: {
          currency: 'sgd',
          product_data: {
            name,
            description: brand + '  ·  ' + spec,
            metadata: { category: String(item.cat || '').slice(0, 50) },
          },
          unit_amount: sgdPrice,
        },
        quantity: qty,
      };
    });

    // Build shipping options based on order subtotal
    const standardSgdCents = Math.round(STANDARD_SHIPPING_JPY * JPY_TO_SGD * 100);
    const expressSgdCents  = Math.round(EXPRESS_SHIPPING_JPY * JPY_TO_SGD * 100);
    const isFreeShipping = subtotalJPY >= FREE_SHIPPING_THRESHOLD_JPY;

    var shippingOptions = [];

    if (isFreeShipping) {
      shippingOptions = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'sgd' },
            display_name: '🎉 满额包邮 · EMS标准配送 (7–14工作日)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 7 },
              maximum: { unit: 'business_day', value: 14 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: expressSgdCents, currency: 'sgd' },
            display_name: 'EMS加急配送 (3–5工作日) · ¥' + EXPRESS_SHIPPING_JPY.toLocaleString(),
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
      ];
    } else {
      var remainForFree = FREE_SHIPPING_THRESHOLD_JPY - subtotalJPY;
      shippingOptions = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: standardSgdCents, currency: 'sgd' },
            display_name: 'EMS標準配送 (7–14営業日) · ¥' + STANDARD_SHIPPING_JPY.toLocaleString() + '  (あと¥' + Math.ceil(remainForFree).toLocaleString() + 'で送料無料)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 7 },
              maximum: { unit: 'business_day', value: 14 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: expressSgdCents, currency: 'sgd' },
            display_name: 'EMS加急配送 (3–5工作日) · ¥' + EXPRESS_SHIPPING_JPY.toLocaleString(),
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
      ];
    }

    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : 'https://jmedpass.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'alipay', 'wechat_pay', 'grabpay'],
      line_items: lineItems,
      locale: 'zh',

      shipping_address_collection: {
        allowed_countries: [
          'CN', 'HK', 'TW',
          'JP',
          'KR',
          'VN',
          'SG', 'MY', 'TH', 'PH',
          'AU', 'US', 'GB', 'CA',
        ],
      },
      shipping_options: shippingOptions,

      phone_number_collection: { enabled: true },
      billing_address_collection: 'required',

      custom_text: {
        submit: {
          message: '樱医集团承诺正品直采，日本GMP认证工厂，EMS国际快递安全配送',
        },
      },

      metadata: {
        items_count: String(items.length),
        subtotal_jpy: String(subtotalJPY),
        free_shipping: isFreeShipping ? 'yes' : 'no',
        source: 'sakura-medical-shop',
      },

      success_url: baseUrl + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  baseUrl + '/shenghuo.html?cancelled=1',
    });

    return res.status(200).json({
      url: session.url,
      session_id: session.id,
      shipping_info: {
        subtotal_jpy: subtotalJPY,
        free_shipping: isFreeShipping,
        threshold: FREE_SHIPPING_THRESHOLD_JPY,
      },
    });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
