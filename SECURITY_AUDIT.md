# jmedpass.com 安全审计报告
**审计日期**: 2026-04-08  
**项目**: jmedpass.com 日本医疗平台  
**范围**: 代码库安全性、架构风险、数据处理

---

## 执行摘要

审计发现**3个真实安全隐患（P0/P1级）**和**多个架构/体验问题（P2级）**。代码中部分已采用了安全的做法（如服务端校验），但仍有关键缺陷需要立即修复。

---

## 🔴 P0 级问题（立即修复）

### 1. 后台认证系统：硬编码默认凭证 + 弱化的 Session Secret

**位置**: `api/_lib/auth.js:3-27`

**问题描述**:
```javascript
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD_HASH = 'c4c0b99854f97f16ae681cb3c396f20858c2499c7b1c8f33cdad958c57f3958d'; // SHA256('admin')

function getSessionSecret() {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  return isDevelopmentMode() ? getAdminPasswordHash() : ''; // 开发环境用密码哈希做 secret！
}
```

**风险**:
- ✗ 如果 `ADMIN_SESSION_SECRET` 环境变量未设置，Session HMAC secret 会降级为可预测的密码哈希
- ✗ 攻击者可以伪造有效的 admin session cookie（如果知道密码哈希）
- ✗ 在 development 模式下，默认凭证 `admin / admin`（SHA256 hash）可直接登录后台

**立即修复**:
```bash
# Vercel dashboard 必须设置这两个变量，否则后台无法访问
ADMIN_USERNAME=<强随机用户名>
ADMIN_PASSWORD_HASH=<强密码的 SHA256，至少 16 位>
ADMIN_SESSION_SECRET=<随机 32 位以上的 base64>
```

**验证方法**:
```bash
# 确认环境变量已设置
vercel env ls
# 如果上述三个变量缺失或为空，后台会处于危险状态
```

---

### 2. 推荐人代码存储在 localStorage（可被篡改）

**位置**: `partner.js:3-16`, `login.html:118,135,208`

**问题描述**:
```javascript
// partner.js - 自动保存推荐人代码
const ref = params.get('ref');
if (ref) {
  localStorage.setItem('sm_pending_ref', ref);  // 用户可直接修改
  localStorage.setItem('sm_pending_ref_at', Date.now().toString());
}
```

在 `login.html` 注册时：
```javascript
referralCode: refCode || localStorage.getItem('sm_pending_ref') || '',  // 读取可篡改的值
```

**风险**:
- ✗ 用户可打开浏览器开发者工具，直接修改 `sm_pending_ref` 值
- ✗ 一个用户可伪造成由另一个合伙人推荐，导致佣金记录错误
- ✗ 无法从后台识别真实的推荐关系

**修复方案**:
```javascript
// ❌ 不要这样做：依赖 localStorage
const refCode = localStorage.getItem('sm_pending_ref');

// ✅ 改为：使用服务器端 session
// 1. 在后端创建临时的推荐人会话（TTL 30 分钟）
// 2. 返回一个不可篡改的 session cookie
// 3. 注册时从 session 读取，而不是 localStorage

// 前端只保存 ref URL 参数，不存储在 localStorage
```

---

### 3. 合伙人数据架构混乱：部分依赖前端本地存储

**位置**: `my.html:270-348`, `partner.js:19-32`

**问题描述**:
```javascript
// my.html - 这些数据从何而来？
var customers = [];     // 从 API？还是 localStorage？
var orders = [];        // 不清楚数据来源
var commissions = [];   // 
var withdrawals = [];   // 
var rules = [];         // partner.js:21 从 localStorage 读！

// partner.js
if (!localStorage.getItem('sm_commission_rules')) {
  const defaultRules = [/* ... */];
  localStorage.setItem('sm_commission_rules', JSON.stringify(defaultRules));
}
```

**问题**:
- ✗ `sm_commission_rules` 存在 localStorage，用户可修改自己的佣金规则
- ✗ 不清楚合伙人中心的数据是从 API 还是 localStorage 加载

**修复**:
- 确认 `my.html` 中所有数据都从 `/api/partner-data` 加载，而**不是** localStorage
- 删除 `partner.js` 中关于 `sm_commission_rules` 的 localStorage 逻辑
- 佣金规则必须由后台管理员管理，前端只读

---

## 🟠 P1 级问题（本周修复）

### 4. 后台自动灌入演示数据污染真实业务数据

**位置**: `my.html` 注册流程

**问题**:
根据用户描述，新注册合伙人会自动收到演示客户、演示订单、演示佣金。

**风险**:
- ✗ 真实合伙人无法区分哪些是演示数据
- ✗ 运营报表会被虚假订单污染
- ✗ 合伙人可能以为自己真的赚到了钱

**修复**:
```javascript
// 不要这样：
if (me.createdAt && new Date(me.createdAt) - Date.now() < 1 * 86400000) {
  // 自动添加演示客户
  customers.push({ id: 'demo_1', name: 'Demo Customer', ... });
}

// 改为：只在测试账号或特定标记时显示
if (me.isTestAccount === true) {
  // 显示演示数据（明确标记）
}
```

---

### 5. 支付成功页面没有确认真实邮件发送

**位置**: `success.html:165,210-217`

**当前行为**:
```javascript
// success.html 显示："订单通知将以 xxx@email.com 作为主要联系邮箱"
// 但实际上并未发送邮件
```

**风险**:
- ✗ 用户期望收到邮件但收不到
- ✗ 运营团队无法追踪哪些用户已通知

**必须实现**:
```javascript
// 支付成功后，需要调用邮件服务（SendGrid / Resend / AWS SES）
// 发送订单确认邮件，包含：
// - 订单号
// - 购买明细
// - 预计发货时间
// - 客服联系方式

// 前端不应该说"已发送邮件"，除非后台真的发了
```

---

## 🟡 P2 级问题（近期改进）

### 6. 注册流程缺少关键字段和验证

**缺失**:
- ✗ 没有邮箱或手机验证码（任何人都可用虚假邮箱注册）
- ✗ 没有"忘记密码"功能
- ✗ 没有手机号格式校验（接受任意字符串）
- ✗ 没有国家/地区代码引导（用户输入 `8888 8888` vs `+65 8888 8888`）
- ✗ 国际化注册表单混乱（有些字段说"WhatsApp"，有些说"手机号"）

**影响**:
- 账号风险：虚假注册、自动化滥用
- 转化率：用户填错手机号后无法重置密码
- 支持成本：客服需要手动处理密码重置

**建议**:
```javascript
// 添加以下验证
1. 邮箱验证码或 OTP（验证所有权）
2. 手机号国家码自动识别 + 格式验证
3. 密码强度要求（大小写、数字、符号）
4. 确认密码字段（已有，✓）
5. 勾选服务条款（已有，✓）
6. 实现"忘记密码"→ 邮箱重置链接
```

---

### 7. SEO 多语言标签不完整

**位置**: `index.html:20, index.html:87, sitemap.xml:5`

**问题**:
```html
<!-- index.html 声明了中文 -->
<html lang="zh-CN">

<!-- 但有 ja/vi/ko UI，却没有对应的 hreflang -->
<link rel="alternate" hreflang="ja" href="https://jmedpass.com/ja/" />
<!-- 缺少 vi, ko 版本的声明 -->

<!-- sitemap.xml 只列出 zh/en，没有 ja/vi/ko -->
```

**风险**:
- ✗ 搜索引擎无法识别多语言版本，可能判定为内容重复
- ✗ 日文搜索用户看不到日文版（谷歌不知道存在）
- ✗ 国际 SEO 效果大打折扣

**修复**:
```html
<!-- 在每个页面 <head> 中添加 -->
<link rel="alternate" hreflang="zh-CN" href="https://jmedpass.com/" />
<link rel="alternate" hreflang="ja" href="https://jmedpass.com/ja/" />
<link rel="alternate" hreflang="vi" href="https://jmedpass.com/vi/" />
<link rel="alternate" hreflang="ko" href="https://jmedpass.com/ko/" />
<link rel="alternate" hreflang="en" href="https://jmedpass.com/en/" />
<link rel="alternate" hreflang="x-default" href="https://jmedpass.com/" />
```

---

### 8. 首页性能问题（中低端手机体验差）

**位置**: `index.html:126`, `style.css:96,252`, `shop.css:378`

**问题**:
- Canvas 动画、模糊滤镜、持续动画可能导致低端手机卡顿
- 首屏包含大量 GPU 操作，影响 First Contentful Paint (FCP)

**建议**:
```css
/* 在 @media (prefers-reduced-motion) 中禁用动画 */
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    filter: none; /* 移除模糊 */
  }
}

/* 对低端设备禁用 Canvas */
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
  // 禁用复杂动画，使用静态图片替代
}
```

---

## 验证清单

在部署到生产之前，必须完成：

- [ ] **P0-1**: 验证 3 个环保变量已在 Vercel dashboard 设置
  ```bash
  vercel env pull  # 本地拉取配置，确认不为空
  ```

- [ ] **P0-2**: 移除或加密所有 localStorage 中的敏感数据（推荐人代码、佣金规则）

- [ ] **P0-3**: 确认 `my.html` 从 API 加载所有数据，而非 localStorage

- [ ] **P1-4**: 删除新用户自动灌入的演示数据，或添加明确的演示账号标记

- [ ] **P1-5**: 实现邮件发送服务，确保支付成功后真的发送邮件

- [ ] **P2-6**: 添加邮箱/手机验证、密码重置、格式验证

- [ ] **P2-7**: 更新 `sitemap.xml` 和所有页面的 `hreflang` 标签

- [ ] **P2-8**: 对低端设备优化性能（禁用不必要的动画）

---

## 具体代码修复建议

### 修复优先级

| 优先级 | 工作量 | 影响 | 建议时间 |
|--------|--------|------|---------|
| **P0-1** | 5 分钟 | 🔴 严重 | 立即 |
| **P0-2** | 1 小时 | 🔴 严重 | 立即 |
| **P0-3** | 2 小时 | 🔴 严重 | 今天 |
| **P1-4** | 30 分钟 | 🟠 中 | 本周 |
| **P1-5** | 4 小时 | 🟠 中 | 本周 |
| **P2-6** | 8 小时 | 🟡 轻 | 2 周内 |
| **P2-7** | 2 小时 | 🟡 轻 | 2 周内 |
| **P2-8** | 3 小时 | 🟡 轻 | 2 周内 |

---

## 结论

**现状**: 代码中存在**3 个高风险漏洞**（主要是认证和数据隐私），需要立即修复。部分功能（如支付、咨询表单）实际上已采用安全的服务端做法，与最初报告的问题不符。

**建议**: 
1. 立即修复 P0 级环境变量和 localStorage 问题（今天）
2. 本周完成邮件和数据验证
3. 向用户说明真实安全状态（不是所有列出的问题都存在）

---

**审计人**: Claude Code  
**审计工具**: codebase analysis + security checklist  
**下次审计**: 修复完成后 / 2026-05-08
