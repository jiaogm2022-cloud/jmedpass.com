---
title: jmedpass.com / medpass.com 全面改进建议（代码 + 安全 + 部署运维）
date: 2026-04-10
repo: https://github.com/jiaogm2022-cloud/jmedpass.com
---

## 0. 你当前这套站点“是什么”（快速结论）

- **形态**：以 **静态 HTML/CSS/JS** 为主（大量页面直接在根目录 + `en/` 目录），前端用 `i18n.js` 做多语言切换。
- **后端能力**：通过 **Serverless API**（`/api/*.js`）提供：
  - 后台管理员登录/数据管理（`api/admin.js`）
  - 合伙人登录/注册/会话（`api/partner-auth.js`）
  - 合伙人中心数据、提现（`api/partner.js`）
  - Stripe 支付（`api/commerce.js`）
  - 咨询/表单提交（`api/submissions.js`）
- **数据存储**：当前实现使用 **SQLite 文件**（`api/_lib/store.js`，默认 `data/jmedpass.sqlite`）。
- **部署配置**：同时存在 **Vercel**（`vercel.json`）和 **Netlify**（`netlify.toml` + `netlify/functions/*`）两套配置，且支付功能存在“双实现”（Vercel API 与 Netlify Functions 都有）。
- **你的域名现状**：你提到域名在 GoDaddy，且域名是 `medpass.com`；但站点内（canonical、OG、sitemap、allowed-origins 等）大量硬编码的是 `https://jmedpass.com`。

> 这意味着：**“域名策略 + 部署平台选择 + 数据持久化方案”** 是你上线前最关键的 3 件事。

---

## 1) 立刻要修（P0 / 高风险）

### P0-1：生产环境不要用“本地 SQLite + Serverless”

**现状**：`api/_lib/store.js` 明确提示了风险：Vercel/Serverless 下文件系统不可写/不持久、实例多副本不一致，数据会丢、会乱、会回滚。

**影响**（非常实际）：
- 合伙人账号、客户关系、提现记录、表单线索等 **可能随机丢失/覆盖**；
- 速率限制（rate limit）依赖 SQLite 表，也会 **在多实例下失效**；
- 一旦开始有真实业务数据，后续迁移成本急剧上升。

**建议方案（从推荐到不推荐）**：
1. **推荐**：迁移到托管数据库（例如 Postgres / Turso / Supabase / Neon 等），把 `store.js` 替换为真正的持久化层（并做最小化的 DAO 封装）。
2. **次优**：如果必须 SQLite，那就不要用 Vercel/Serverless；换成有**持久磁盘**的部署形态（自建 VPS、Dokku、Fly.io volume、Render disk 等），并保证 DB 文件在 Web Root 之外。
3. **不推荐**：把 DB 放在 Serverless 的 `/tmp`，只能临时演示，不能做生产。

### P0-2：后台 Admin Session Secret 的“空值降级”风险（必须改成强制校验）

`api/_lib/auth.js`：
- 生产环境如果没有设置 `ADMIN_SESSION_SECRET`，`getSessionSecret()` 会返回空字符串 `''`；
- HMAC secret 为空会导致签名**可被任意人离线伪造**（格式已知时）。

你已经有 `SECURITY_AUDIT.md` 写到这个点；我的建议更明确：
- **生产环境**：只要缺少 `ADMIN_SESSION_SECRET` 就应直接拒绝启动/拒绝登录（返回 503，并提示配置缺失），不要继续运行在“弱模式”。

### P0-3：合伙人 Session Secret 仍有开发默认值（上线必须清理）

`api/_lib/partner-auth.js` 在非 Vercel/开发环境会 fallback 到固定字符串：
```js
return 'jmedpass-dev-partner-secret';
```
上线前要确保：
- 生产环境永远有 `PARTNER_SESSION_SECRET`（或统一用一套 secret 管理策略）。

### P0-4：域名不一致会导致 SEO/支付回跳/CORS 事故

你现在的代码里至少这些地方绑定 `jmedpass.com`：
- `<link rel="canonical" href="https://jmedpass.com/">`
- `sitemap.xml`、`robots.txt` 的域名
- Stripe 允许的回跳 origin（`api/commerce.js` 的 `ALLOWED_ORIGINS`）
- Vercel redirects 针对 `www.jmedpass.com`

如果你最终要用 **`medpass.com` 作为主域名**，那就必须做一次“全仓库域名切换”（并保留旧域名 301）。

---

## 2) 本周要做（P1 / 重要但不至于马上爆炸）

### P1-1：选定一个部署平台（Vercel 或 Netlify）并删掉另一套实现

当前问题：
- 有 **两套路由/headers/安全策略**（`vercel.json` 与 `netlify.toml`），容易出现“测试 OK，线上炸”的差异；
- 支付函数 **重复实现**（`api/commerce.js` vs `netlify/functions/create-checkout.js`），未来改价、改文案、改国家列表会出现**两边不一致**。

建议：
- 只保留一套（更便于长期维护和排错）。

### P1-2：支付链路缺“订单落库/邮件/履约”闭环

你现在的 `/api/commerce` 负责创建 checkout session、查询 session 状态，但缺少：
- **Stripe Webhook**（支付成功事件）来做：
  - 订单落库（订单号、购买明细、用户信息、物流信息、金额）
  - 发送确认邮件/短信/WhatsApp（至少邮件）
  - 给运营后台提供可追踪列表

否则你现在是“能收款，但不好运营”的状态。

### P1-3：README / 环境变量文档缺失（交付与运维成本高）

建议补齐：
- `README.md`：本地启动、部署平台、目录结构、常用命令
- `.env.example`：列出所有必需变量（并说明是否必须、示例格式）
- 环境变量清单建议至少包括：
  - `STRIPE_SECRET_KEY`
  - `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET`
  - `PARTNER_SESSION_SECRET`
  - `JMEDPASS_DB_PATH`（若仍用 SQLite）
  - `JPY_TO_SGD_RATE`（汇率建议从配置/服务获取，而不是写死）

### P1-4：Node 版本/运行时兼容性确认（避免上线才发现 API 运行不了）

你用到了 `node:sqlite`（`DatabaseSync`）。这要求部署环境支持对应 Node 版本。
- 如果部署平台默认 Node 版本较低，需要在平台上**显式锁定 Node 版本**，否则 API 会直接崩。

---

## 3) 近期优化（P2 / 体验、性能、SEO、代码可维护性）

### P2-1：CSP 目前依赖 `unsafe-inline`（长期建议移除）

`vercel.json` / `netlify.toml` 的 CSP 都包含 `'unsafe-inline'`，原因是 HTML 内嵌了大量 `<script>`。

长期建议（按收益从高到低）：
1. 把关键 inline script 移到外部 `.js` 文件；
2. CSP 改成 nonce/hash 方案，逐步去掉 `unsafe-inline`；
3. Stripe 等第三方脚本启用 SRI / 更严格的 `script-src`。

### P2-2：静态站点“模板化/组件化”，降低重复劳动

现在很多页面（中英两个目录）头部/底部/导航/SEO 标签非常相似，建议用：
- 静态站点生成器（Astro/Next static export/Eleventy 等）
- 或者最小化：用简单的构建脚本把公共 head/footer 抽出来拼装

收益：以后你改一次导航/埋点/SEO，不需要改 30+ 个文件。

### P2-3：多语言策略进一步规范（SEO + 站内一致性）

你 sitemap 已经声明了 `hreflang`，但页面 head 里未必都一致；建议建立规则：
- 每个页面 head 内统一输出：canonical + hreflang + OG；
- `en/` 之外的 ja/ko/vi 若是“同页切换”，就明确采用同一 URL（带 query 或 hash），并保证 sitemap/head 一致。

### P2-4：性能（图片/字体/动画）按设备降级

已经看到首页有较重的视觉效果（Canvas/滤镜/动画）。建议：
- `prefers-reduced-motion` 下禁用动画；
- 低端设备/弱网加载更轻的 hero（静态图）；
- 图片全部走 WebP/AVIF（看你目标浏览器）并做尺寸分级（srcset）。

---

## 4) GoDaddy 域名 + 上线落地建议（你说的“animart 文件夹”也一起考虑）

这里给你一个“不会踩坑”的上线策略（不依赖你具体用 Vercel 还是 Netlify）：

### 4-1：先定主域名

二选一：
- **方案A：主域名用 `jmedpass.com`**：那就把 `medpass.com` / `www.medpass.com` 全部 301 到 `https://jmedpass.com`。
- **方案B：主域名用 `medpass.com`（你现在提到的 GoDaddy 域名）**：全站做一次域名替换，并把 `jmedpass.com` 301 到 `https://medpass.com`。

> 不建议“两域名同时可访问不跳转”，会造成 SEO 权重分散、支付回跳域不一致、cookie 域问题等。

### 4-2：DNS 以部署平台控制台给出的记录为准

在 GoDaddy 里配置时建议遵循：
- 根域（`@`）：通常是 A 记录或 ALIAS/ANAME 指向部署平台；
- `www`：通常是 CNAME 指向部署平台提供的域名；
- 证书：确保平台侧已签发并开启强制 HTTPS；
- 301：在平台侧配置 `www -> apex`、旧域名 -> 新域名 的 301。

### 4-3：如果你最终是“把文件上传到某个服务器目录（animart/xxx）”

那要特别注意 **数据文件与私密文件**：
- 绝对不要把 `data/jmedpass.sqlite` 放在可被 Web Server 直接访问的目录；
- 如果必须用 SQLite：把 DB 放在 Web Root 上一级目录，并用环境变量 `JMEDPASS_DB_PATH` 指过去；
- 服务器侧（Nginx/Apache）额外加规则：`deny /data/`、`deny *.sqlite*`，双保险。

---

## 5) 可执行改进清单（按优先级/工作量/风险）

| 优先级 | 项目 | 预估工作量 | 风险/收益 |
|---|---|---:|---|
| P0 | 迁移/替换 SQLite 方案（或更换为有持久盘的部署形态） | 0.5～3 天 | 防止真实数据丢失（核心） |
| P0 | Admin Session secret 空值降级 → 强制校验 | 0.5 小时 | 防止 cookie 伪造（核心） |
| P0 | 生产强制设置 `PARTNER_SESSION_SECRET`，移除 dev fallback | 0.5 小时 | 防止会话伪造 |
| P0 | 主域名决策 + 全站域名统一 + 301 | 1～2 小时 | SEO/支付/追踪稳定 |
| P1 | 选定 Vercel/Netlify 其一，删除重复实现 | 2～6 小时 | 减少线上差异和维护成本 |
| P1 | Stripe Webhook：落库 + 邮件通知 + 后台可追踪 | 0.5～2 天 | 从“能收款”到“可运营” |
| P1 | README + `.env.example` + 部署说明 | 1～2 小时 | 交付/协作/运维成本大幅下降 |
| P1 | 锁定部署 Node 版本，验证 `node:sqlite` 兼容 | 0.5～1 小时 | 避免 API 上线即崩 |
| P2 | 逐步移除 CSP `unsafe-inline`（外置脚本/nonce） | 0.5～2 天 | 提升安全基线 |
| P2 | 模板化/生成器化（减少重复 HTML） | 1～5 天 | 长期维护效率提升 |

---

## 6) 我建议你下一步怎么做（最省时间的路线）

1. 你先回答一个问题：**最终主域名到底用 `medpass.com` 还是 `jmedpass.com`？**  
2. 再回答一个问题：**最终上线用 Vercel 还是 Netlify，还是“animart 那台服务器直接放文件/跑 Node”？**

我可以基于你的选择，把：
- 必改的代码点（例如 auth secret 强制校验、域名替换、CSP/headers 对齐）
- 部署步骤（DNS、HTTPS、301、环境变量清单、备份与监控）
整理成一份“按步骤执行”的上线手册。

