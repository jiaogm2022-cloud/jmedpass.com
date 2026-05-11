const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getAuthenticatedAdmin, readJsonBody } = require('./_lib/auth');
const { enforceRateLimit } = require('./_lib/security');
// NOTE: checkout uses the static catalog directly to avoid initializing SQLite
// on Vercel serverless (where process.cwd() is read-only). See api/_lib/catalog.js.
const { getDefaultProducts: loadProducts } = require('./_lib/catalog');

const JPY_TO_SGD = Number(process.env.JPY_TO_SGD_RATE) || 0.00896;

if (!process.env.JPY_TO_SGD_RATE) {
  console.warn('[CHECKOUT] JPY_TO_SGD_RATE env not set, using fallback 0.00896. Set this in Vercel dashboard to keep rates current.');
}

const ALLOWED_ORIGINS = new Set([
  'https://jmedpass.com',
  'https://www.jmedpass.com',
]);

const MAX_ITEMS = 20;
const MAX_NAME_LEN = 200;
const MAX_QTY = 99;
const FREE_SHIPPING_THRESHOLD_JPY = 46200;
const STANDARD_SHIPPING_JPY = 2960;
const EXPRESS_SHIPPING_JPY = 5960;

function getAction(req) {
  return String((req.query && req.query.action) || '').trim();
}

function getAllowedMethods(action) {
  if (action === 'create-checkout') return 'POST, OPTIONS';
  if (action === 'checkout-session-status' || action === 'get-order') return 'GET, OPTIONS';
  return 'GET, POST, OPTIONS';
}

function methodNotAllowed(res, action) {
  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(405).json({ error: 'Method Not Allowed' });
}

function setCheckoutHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://jmedpass.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

async function handleCreateCheckout(req, res) {
  setCheckoutHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('create-checkout'));
    return res.status(200).end();
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'create-checkout');

  try {
    const body = await readJsonBody(req);
    const items = body.items;
    const lang = body.lang;

    const LOCALE_MAP = { zh: 'zh', en: 'en', ja: 'ja', vi: 'vi', ko: 'ko' };
    const stripeLocale = LOCALE_MAP[lang] || 'auto';

    const SHIPPING_STRINGS = {
      zh: {
        freeStandard: '🎉 满额包邮 · EMS标准配送 (7–14工作日)',
        express: 'EMS加急配送 (3–5工作日) · ¥',
        standard: 'EMS标准配送 (7–14工作日) · ¥',
        freeHint: '  (再购¥{remain}即可免运费)',
        submit: '日医通承诺正品直采，日本GMP认证工厂，EMS国际快递安全配送',
      },
      en: {
        freeStandard: '🎉 Free Shipping · EMS Standard (7–14 business days)',
        express: 'EMS Express (3–5 business days) · ¥',
        standard: 'EMS Standard (7–14 business days) · ¥',
        freeHint: '  (¥{remain} more for free shipping)',
        submit: 'JMedPass guarantees authentic products, Japan GMP certified, EMS international delivery',
      },
      ja: {
        freeStandard: '🎉 送料無料 · EMS標準配送 (7–14営業日)',
        express: 'EMS速達配送 (3–5営業日) · ¥',
        standard: 'EMS標準配送 (7–14営業日) · ¥',
        freeHint: '  (あと¥{remain}で送料無料)',
        submit: '日医通は正規品直送・日本GMP認定工場・EMS国際配送で安心をお届けします',
      },
      ko: {
        freeStandard: '🎉 무료 배송 · EMS 표준 배송 (7–14 영업일)',
        express: 'EMS 특급 배송 (3–5 영업일) · ¥',
        standard: 'EMS 표준 배송 (7–14 영업일) · ¥',
        freeHint: '  (¥{remain} 더 구매 시 무료 배송)',
        submit: 'JMedPass은 정품 직배송, 일본 GMP 인증 공장, EMS 국제 배송을 보장합니다',
      },
      vi: {
        freeStandard: '🎉 Miễn phí vận chuyển · EMS tiêu chuẩn (7–14 ngày làm việc)',
        express: 'EMS chuyển phát nhanh (3–5 ngày làm việc) · ¥',
        standard: 'EMS tiêu chuẩn (7–14 ngày làm việc) · ¥',
        freeHint: '  (Mua thêm ¥{remain} để được miễn phí vận chuyển)',
        submit: 'JMedPass cam kết hàng chính hãng, nhà máy GMP Nhật Bản, vận chuyển EMS quốc tế an toàn',
      },
    };
    const S = SHIPPING_STRINGS[lang] || SHIPPING_STRINGS.zh;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: '购物车为空' });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ error: '商品数量超出限制' });
    }

    const catalog = loadProducts();

    function getLocalizedProductText(product, field) {
      if (!product || !field) return '';
      if (lang === 'en' && product[`${field}EN`]) return product[`${field}EN`];
      if (lang === 'ja' && product[`${field}JA`]) return product[`${field}JA`];
      if (lang === 'ko' && product[`${field}KO`]) return product[`${field}KO`];
      if (lang === 'vi' && product[`${field}VI`]) return product[`${field}VI`];
      return product[field] || '';
    }

    let subtotalJPY = 0;

    const lineItems = items.map((item) => {
      const id = Number(item.id);
      const qty = Math.floor(Number(item.qty));
      if (!Number.isInteger(id) || id <= 0) throw new Error('无效商品');
      if (!isFinite(qty) || qty <= 0 || qty > MAX_QTY) throw new Error('无效数量');

      const product = catalog.find((entry) => Number(entry.id) === id);
      if (!product) throw new Error('商品不存在或已下架');

      const price = Number(product.price);
      const name = String(getLocalizedProductText(product, 'name')).slice(0, MAX_NAME_LEN);
      const brand = String(product.brand || '').slice(0, 100);
      const spec = String(getLocalizedProductText(product, 'spec')).slice(0, 100);
      const sgdPrice = Math.round(price * JPY_TO_SGD * 100);

      subtotalJPY += price * qty;

      return {
        price_data: {
          currency: 'sgd',
          product_data: {
            name,
            description: `${brand}  ·  ${spec}`,
            metadata: {
              product_id: String(product.id),
              category: String(product.cat || '').slice(0, 50),
            },
          },
          unit_amount: sgdPrice,
        },
        quantity: qty,
      };
    });

    const standardSgdCents = Math.round(STANDARD_SHIPPING_JPY * JPY_TO_SGD * 100);
    const expressSgdCents = Math.round(EXPRESS_SHIPPING_JPY * JPY_TO_SGD * 100);
    const isFreeShipping = subtotalJPY >= FREE_SHIPPING_THRESHOLD_JPY;

    const shippingOptions = [];
    if (isFreeShipping) {
      shippingOptions.push({
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 0, currency: 'sgd' },
          display_name: S.freeStandard,
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 7 },
            maximum: { unit: 'business_day', value: 14 },
          },
        },
      });
    } else {
      const remainForFree = FREE_SHIPPING_THRESHOLD_JPY - subtotalJPY;
      shippingOptions.push({
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: standardSgdCents, currency: 'sgd' },
          display_name: S.standard + STANDARD_SHIPPING_JPY.toLocaleString() + S.freeHint.replace('{remain}', Math.ceil(remainForFree).toLocaleString()),
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 7 },
            maximum: { unit: 'business_day', value: 14 },
          },
        },
      });
    }

    shippingOptions.push({
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: expressSgdCents, currency: 'sgd' },
        display_name: S.express + EXPRESS_SHIPPING_JPY.toLocaleString(),
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 3 },
          maximum: { unit: 'business_day', value: 5 },
        },
      },
    });

    const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://jmedpass.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'grabpay'],
      line_items: lineItems,
      locale: stripeLocale,
      shipping_address_collection: {
        allowed_countries: [
          'CN', 'HK', 'MO', 'JP', 'KR', 'MN',
          'VN', 'SG', 'MY', 'TH', 'PH', 'ID', 'MM', 'KH', 'LA', 'BN', 'TL',
          'IN', 'BD', 'LK', 'NP', 'PK',
          'KZ', 'UZ', 'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'JO', 'IL', 'TR',
          'AU', 'NZ', 'US', 'GB', 'CA',
        ],
      },
      shipping_options: shippingOptions,
      phone_number_collection: { enabled: true },
      billing_address_collection: 'required',
      custom_text: {
        submit: {
          message: S.submit,
        },
      },
      metadata: {
        items_count: String(items.length),
        subtotal_jpy: String(subtotalJPY),
        free_shipping: isFreeShipping ? 'yes' : 'no',
        source: 'jmedpass-shop',
      },
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/wellness?cancelled=1`,
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
  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleCheckoutSessionStatus(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('checkout-session-status'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'checkout-session-status');

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }
  if (!(await enforceRateLimit(req, res, {
    scope: 'checkout-session-status',
    identifier: sessionId,
    windowMs: 5 * 60 * 1000,
    max: 20,
    errorMessage: '查询过于频繁，请稍后再试',
  }))) return;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.status(200).json({
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleGetOrder(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', getAllowedMethods('get-order'));
    return res.status(200).end();
  }

  if (req.method !== 'GET') return methodNotAllowed(res, 'get-order');

  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer_details'],
    });

    return res.status(200).json({
      id: session.id,
      payment_status: session.payment_status,
      customer_details: session.customer_details,
      shipping_details: session.shipping_details,
      amount_total: session.amount_total,
      currency: session.currency,
      line_items: session.line_items,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const action = getAction(req);
  if (action === 'create-checkout') return handleCreateCheckout(req, res);
  if (action === 'checkout-session-status') return handleCheckoutSessionStatus(req, res);
  if (action === 'get-order') return handleGetOrder(req, res);

  res.setHeader('Allow', getAllowedMethods(action));
  return res.status(400).json({ error: 'Unsupported commerce action' });
};
