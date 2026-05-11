const BRAND_NAME = 'JMedPass';
const DEFAULT_SUPPORT_EMAIL = 'admin@jmedpass.com';

function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development'
    || (!process.env.VERCEL && process.env.NODE_ENV !== 'production');
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getBaseUrl(req) {
  const configured = normalizeBaseUrl(
    process.env.JMEDPASS_BASE_URL
    || process.env.SITE_URL
    || process.env.NEXT_PUBLIC_SITE_URL
  );
  if (configured) return configured;

  const host = String(
    (req && (req.headers['x-forwarded-host'] || req.headers.host))
    || process.env.VERCEL_URL
    || 'localhost:3000'
  ).trim();
  const protocol = String(
    (req && req.headers['x-forwarded-proto'])
    || (host.startsWith('localhost') ? 'http' : 'https')
  ).trim();
  return `${protocol}://${host}`;
}

function getMailConfig() {
  return {
    apiKey: String(process.env.RESEND_API_KEY || '').trim(),
    from: String(process.env.MAIL_FROM || '').trim(),
    supportEmail: String(process.env.JMEDPASS_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL).trim(),
  };
}

function canSendEmails() {
  const config = getMailConfig();
  return Boolean((config.apiKey && config.from) || isDevelopmentMode());
}

async function sendTransactionalEmail(options) {
  const payload = options || {};
  const config = getMailConfig();

  if (!config.apiKey || !config.from) {
    if (isDevelopmentMode()) {
      console.info('[MAIL PREVIEW]', JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      }, null, 2));
      return { ok: true, preview: true };
    }

    const error = new Error('邮件服务未配置');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo || config.supportEmail,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    const error = new Error(`邮件发送失败: ${response.status} ${raw}`);
    error.code = 'EMAIL_SEND_FAILED';
    throw error;
  }

  return response.json();
}

async function sendPartnerWelcomeEmail(user, req) {
  if (!user || !user.email) return { ok: false, skipped: true };

  const baseUrl = getBaseUrl(req);
  const loginUrl = `${baseUrl}/login`;
  const supportEmail = getMailConfig().supportEmail;
  const nickname = user.nickname || 'Partner';

  return sendTransactionalEmail({
    to: user.email,
    subject: `欢迎加入 ${BRAND_NAME} 合伙人平台`,
    text: [
      `${nickname}，欢迎加入 ${BRAND_NAME} 合伙人平台。`,
      '',
      '您的账号已创建成功，现在可以登录查看推荐码、订单与佣金信息。',
      `登录地址：${loginUrl}`,
      '',
      `如需协助，请联系：${supportEmail}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#222">
        <h2 style="margin:0 0 16px;">欢迎加入 ${BRAND_NAME}</h2>
        <p>${escapeHtml(nickname)}，您好：</p>
        <p>您的合伙人账号已经创建成功，现在可以登录查看推荐码、订单与佣金信息。</p>
        <p>
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 18px;background:#b62b45;color:#fff;text-decoration:none;border-radius:999px;">
            立即登录
          </a>
        </p>
        <p>如果这次注册不是您本人操作，请直接回复此邮件联系我们。</p>
        <p style="color:#666;font-size:14px;">客服邮箱：${escapeHtml(supportEmail)}</p>
      </div>
    `,
  });
}

async function sendPartnerPasswordResetEmail(user, resetUrl) {
  if (!user || !user.email || !resetUrl) return { ok: false, skipped: true };

  const supportEmail = getMailConfig().supportEmail;
  const nickname = user.nickname || 'Partner';

  return sendTransactionalEmail({
    to: user.email,
    subject: `${BRAND_NAME} 密码重置`,
    text: [
      `${nickname}，您好：`,
      '',
      '我们收到了您的密码重置请求。请在 30 分钟内打开下面的链接设置新密码：',
      resetUrl,
      '',
      '如果这不是您本人操作，请忽略这封邮件，原密码不会被修改。',
      `如需帮助，请联系：${supportEmail}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#222">
        <h2 style="margin:0 0 16px;">${BRAND_NAME} 密码重置</h2>
        <p>${escapeHtml(nickname)}，您好：</p>
        <p>我们收到了您的密码重置请求。请在 <strong>30 分钟内</strong> 点击下面的按钮设置新密码：</p>
        <p>
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#b62b45;color:#fff;text-decoration:none;border-radius:999px;">
            重置密码
          </a>
        </p>
        <p>如果按钮无法打开，也可以复制这个链接到浏览器：</p>
        <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
        <p>如果这不是您本人操作，请忽略这封邮件，原密码不会被修改。</p>
        <p style="color:#666;font-size:14px;">客服邮箱：${escapeHtml(supportEmail)}</p>
      </div>
    `,
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  canSendEmails,
  getBaseUrl,
  sendPartnerPasswordResetEmail,
  sendPartnerWelcomeEmail,
  sendTransactionalEmail,
};
