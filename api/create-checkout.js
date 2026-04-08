/* ===== Sakura Medical · Stripe Checkout Session Creator (Vercel) =====
   Environment variable required in Vercel dashboard:
   STRIPE_SECRET_KEY = sk_test_... (or sk_live_... for production)
   ===================================================================== */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { loadProducts } = require('./_lib/partner-data');

// JPY → SGD conversion
// Configurable via environment variable JPY_TO_SGD_RATE (e.g. "0.00896")
// In production, update this regularly or integrate a live rate API.
const JPY_TO_SGD = Number(process.env.JPY_TO_SGD_RATE) || 0.00896;

if (!process.env.JPY_TO_SGD_RATE) {
  console.warn('[CHECKOUT] JPY_TO_SGD_RATE env not set, using fallback 0.00896. Set this in Vercel dashboard to keep rates current.');
}

// Allowed redirect origins
const ALLOWED_ORIGINS = new Set([
  'https://jmedpass.com',
  'https://www.jmedpass.com',
]);

// Input limits
const MAX_ITEMS = 20;
const MAX_NAME_LEN = 200;
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
    const { items, lang } = req.body;

    // Map site language to Stripe locale
    const LOCALE_MAP = { zh: 'zh', en: 'en', ja: 'ja', vi: 'vi', ko: 'ko' };
    const stripeLocale = LOCALE_MAP[lang] || 'auto';

    // Translated shipping & UI strings
    const SHIPPING_STRINGS = {
      zh: {
        freeStandard: '🎉 满额包邮 · EMS标准配送 (7–14工作日)',
        express: 'EMS加急配送 (3–5工作日) · ¥',
        standard: 'EMS标准配送 (7–14工作日) · ¥',
        freeHint: '  (再购¥{remain}即可免运费)',
        submit: '樱医集团承诺正品直采，日本GMP认证工厂，EMS国际快递安全配送',
        bdStd: '7-14个工作日',
        bdExp: '3-5个工作日',
      },
      en: {
        freeStandard: '🎉 Free Shipping · EMS Standard (7–14 business days)',
        express: 'EMS Express (3–5 business days) · ¥',
        standard: 'EMS Standard (7–14 business days) · ¥',
        freeHint: '  (¥{remain} more for free shipping)',
        submit: 'Sakura Medical guarantees authentic products, Japan GMP certified, EMS international delivery',
        bdStd: '7-14 business days',
        bdExp: '3-5 business days',
      },
      ja: {
        freeStandard: '🎉 送料無料 · EMS標準配送 (7–14営業日)',
        express: 'EMS速達配送 (3–5営業日) · ¥',
        standard: 'EMS標準配送 (7–14営業日) · ¥',
        freeHint: '  (あと¥{remain}で送料無料)',
        submit: '桜医グループは正規品直送・日本GMP認定工場・EMS国際配送で安心をお届けします',
        bdStd: '7～14営業日',
        bdExp: '3～5営業日',
      },
      ko: {
        freeStandard: '🎉 무료 배송 · EMS 표준 배송 (7–14 영업일)',
        express: 'EMS 특급 배송 (3–5 영업일) · ¥',
        standard: 'EMS 표준 배송 (7–14 영업일) · ¥',
        freeHint: '  (¥{remain} 더 구매 시 무료 배송)',
        submit: '사쿠라 메디컬은 정품 직배송, 일본 GMP 인증 공장, EMS 국제 배송을 보장합니다',
        bdStd: '7-14 영업일',
        bdExp: '3-5 영업일',
      },
      vi: {
        freeStandard: '🎉 Miễn phí vận chuyển · EMS tiêu chuẩn (7–14 ngày làm việc)',
        express: 'EMS chuyển phát nhanh (3–5 ngày làm việc) · ¥',
        standard: 'EMS tiêu chuẩn (7–14 ngày làm việc) · ¥',
        freeHint: '  (Mua thêm ¥{remain} để được miễn phí vận chuyển)',
        submit: 'Sakura Medical cam kết hàng chính hãng, nhà máy GMP Nhật Bản, vận chuyển EMS quốc tế an toàn',
        bdStd: '7-14 ngày làm việc',
        bdExp: '3-5 ngày làm việc',
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

    // Calculate subtotal in JPY for shipping threshold logic
    var subtotalJPY = 0;

    // Build Stripe line items using server-side catalog pricing
    const lineItems = items.map(function (item) {
      const id = Number(item.id);
      const qty = Math.floor(Number(item.qty));
      if (!Number.isInteger(id) || id <= 0) throw new Error('无效商品');
      if (!isFinite(qty) || qty <= 0 || qty > MAX_QTY) throw new Error('无效数量');

      const product = catalog.find(function (entry) { return Number(entry.id) === id; });
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
            description: brand + '  ·  ' + spec,
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
            display_name: S.freeStandard,
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
            display_name: S.express + EXPRESS_SHIPPING_JPY.toLocaleString(),
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
            display_name: S.standard + STANDARD_SHIPPING_JPY.toLocaleString() + S.freeHint.replace('{remain}', Math.ceil(remainForFree).toLocaleString()),
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
            display_name: S.express + EXPRESS_SHIPPING_JPY.toLocaleString(),
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
      payment_method_options: {
        wechat_pay: { client: 'web' },
      },
      line_items: lineItems,
      locale: stripeLocale,

      shipping_address_collection: {
        allowed_countries: [
          /* 东亚 */ 'CN', 'HK', 'MO', 'JP', 'KR', 'MN',
          /* 东南亚 */ 'VN', 'SG', 'MY', 'TH', 'PH', 'ID', 'MM', 'KH', 'LA', 'BN', 'TL',
          /* 南亚 */ 'IN', 'BD', 'LK', 'NP', 'PK',
          /* 中西亚 */ 'KZ', 'UZ', 'AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'JO', 'IL', 'TR',
          /* 其他 */ 'AU', 'NZ', 'US', 'GB', 'CA',
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

      success_url: baseUrl + '/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  baseUrl + '/wellness?cancelled=1',
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
