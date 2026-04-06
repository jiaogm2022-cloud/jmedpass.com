/* ===== Sakura Medical · Stripe Checkout Session Creator =====
   Environment variable required in Netlify dashboard:
   STRIPE_SECRET_KEY = sk_test_... (or sk_live_... for production)
   ============================================================ */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// CNY → USD conversion (approximate, update as needed)
const CNY_TO_USD = 0.138;

// Allowed redirect origins — never trust client-supplied origin
const ALLOWED_ORIGINS = new Set([
  'https://jmedpass.com',
  'https://www.jmedpass.com',
]);

// Input limits
const MAX_ITEMS = 20;
const MAX_NAME_LEN = 200;
const MAX_PRICE_CNY = 100000; // ¥100,000 per item
const MAX_QTY = 99;

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { items } = body;

    if (!items || items.length === 0) {
      return respond(400, { error: '购物车为空' }, event);
    }
    if (items.length > MAX_ITEMS) {
      return respond(400, { error: '商品数量超出限制' }, event);
    }

    // Build Stripe line items (convert CNY → USD → cents)
    const lineItems = items.map(function (item) {
      const price = Number(item.price);
      const qty   = Math.floor(Number(item.qty));
      if (!isFinite(price) || price <= 0 || price > MAX_PRICE_CNY) throw new Error('无效价格');
      if (!isFinite(qty)   || qty   <= 0 || qty   > MAX_QTY)      throw new Error('无效数量');
      const name = String(item.name || '').slice(0, MAX_NAME_LEN);
      const brand = String(item.brand || '').slice(0, 100);
      const spec  = String(item.spec  || '').slice(0, 100);
      const usdPrice = Math.round(price * CNY_TO_USD * 100); // cents
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name,
            description: brand + '  ·  ' + spec,
            metadata: { category: String(item.cat || '').slice(0, 50) },
          },
          unit_amount: usdPrice,
        },
        quantity: qty,
      };
    });

    // Use server-side origin only — never trust client-supplied value
    const baseUrl = process.env.URL || 'https://jmedpass.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'alipay'],
      line_items: lineItems,
      locale: 'zh',

      // Collect shipping address
      shipping_address_collection: {
        allowed_countries: ['CN', 'HK', 'TW', 'SG', 'MY', 'AU', 'US', 'GB', 'JP', 'KR'],
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
      billing_address_collection: 'required',

      // Custom UI text shown at Stripe checkout
      custom_text: {
        submit: {
          message: '樱医集团承诺正品直采，GMP认证工厂，全球安全配送',
        },
      },

      // Pass cart summary as metadata for order reference
      metadata: {
        items_count: String(items.length),
        source: 'sakura-medical-shop',
      },

      success_url: baseUrl + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  baseUrl + '/shenghuo.html?cancelled=1',
    });

    return respond(200, { url: session.url, session_id: session.id }, event);

  } catch (err) {
    console.error('Stripe error:', err.message);
    return respond(500, { error: err.message }, event);
  }
};

function respond(status, body, event) {
  return {
    statusCode: status,
    headers: corsHeaders(event),
    body: JSON.stringify(body),
  };
}

function corsHeaders(event) {
  const reqOrigin = (event && event.headers && event.headers.origin) || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(reqOrigin) ? reqOrigin : 'https://jmedpass.com';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
