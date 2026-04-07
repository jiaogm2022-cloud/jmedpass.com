/* ===== Sakura Medical · Stripe Checkout Session Creator =====
   Environment variable required in Netlify dashboard:
   STRIPE_SECRET_KEY = sk_test_... (or sk_live_... for production)
   ============================================================ */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// JPY → SGD conversion (approximate, update as needed)
// Stripe account default currency is SGD (Singapore Dollar)
// 1 JPY ≈ 0.00896 SGD (as of April 2026)
const JPY_TO_SGD = 0.00896;

// Allowed redirect origins — never trust client-supplied origin
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
    const { items, lang } = body;

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
      },
      en: {
        freeStandard: '🎉 Free Shipping · EMS Standard (7–14 business days)',
        express: 'EMS Express (3–5 business days) · ¥',
        standard: 'EMS Standard (7–14 business days) · ¥',
        freeHint: '  (¥{remain} more for free shipping)',
        submit: 'Sakura Medical guarantees authentic products, Japan GMP certified, EMS international delivery',
      },
      ja: {
        freeStandard: '🎉 送料無料 · EMS標準配送 (7–14営業日)',
        express: 'EMS速達配送 (3–5営業日) · ¥',
        standard: 'EMS標準配送 (7–14営業日) · ¥',
        freeHint: '  (あと¥{remain}で送料無料)',
        submit: '桜医グループは正規品直送・日本GMP認定工場・EMS国際配送で安心をお届けします',
      },
      ko: {
        freeStandard: '🎉 무료 배송 · EMS 표준 배송 (7–14 영업일)',
        express: 'EMS 특급 배송 (3–5 영업일) · ¥',
        standard: 'EMS 표준 배송 (7–14 영업일) · ¥',
        freeHint: '  (¥{remain} 더 구매 시 무료 배송)',
        submit: '사쿠라 메디컬은 정품 직배송, 일본 GMP 인증 공장, EMS 국제 배송을 보장합니다',
      },
      vi: {
        freeStandard: '🎉 Miễn phí vận chuyển · EMS tiêu chuẩn (7–14 ngày làm việc)',
        express: 'EMS chuyển phát nhanh (3–5 ngày làm việc) · ¥',
        standard: 'EMS tiêu chuẩn (7–14 ngày làm việc) · ¥',
        freeHint: '  (Mua thêm ¥{remain} để được miễn phí vận chuyển)',
        submit: 'Sakura Medical cam kết hàng chính hãng, nhà máy GMP Nhật Bản, vận chuyển EMS quốc tế an toàn',
      },
    };
    const S = SHIPPING_STRINGS[lang] || SHIPPING_STRINGS.zh;

    if (!items || items.length === 0) {
      return respond(400, { error: '購物車為空' }, event);
    }
    if (items.length > MAX_ITEMS) {
      return respond(400, { error: '商品数量超出限制' }, event);
    }

    // Calculate subtotal in JPY for shipping threshold logic
    let subtotalJPY = 0;

    // Build Stripe line items (convert JPY → SGD → cents)
    const lineItems = items.map(function (item) {
      const price = Number(item.price);
      const qty   = Math.floor(Number(item.qty));
      if (!isFinite(price) || price <= 0 || price > MAX_PRICE_JPY) throw new Error('無効価格');
      if (!isFinite(qty)   || qty   <= 0 || qty   > MAX_QTY)      throw new Error('無効数量');
      const name = String(item.name || '').slice(0, MAX_NAME_LEN);
      const brand = String(item.brand || '').slice(0, 100);
      const spec  = String(item.spec  || '').slice(0, 100);
      const sgdPrice = Math.round(price * JPY_TO_SGD * 100); // cents

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

    // Use server-side origin only — never trust client-supplied value
    const baseUrl = process.env.URL || 'https://jmedpass.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'alipay', 'wechat_pay', 'grabpay'],
      payment_method_options: {
        wechat_pay: { client: 'web' },
      },
      line_items: lineItems,
      locale: stripeLocale,

      // Collect shipping address
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

      success_url: baseUrl + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  baseUrl + '/wellness.html?cancelled=1',
    });

    return respond(200, {
      url: session.url,
      session_id: session.id,
      shipping_info: {
        subtotal_jpy: subtotalJPY,
        free_shipping: isFreeShipping,
        threshold: FREE_SHIPPING_THRESHOLD_JPY,
      },
    }, event);

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
