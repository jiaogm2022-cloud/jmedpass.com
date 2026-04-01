/* ===== SAKURA MEDICAL — ADMIN JS ===== */

// Auth guard
if (localStorage.getItem('sm_admin_auth') !== 'yes') {
  window.location.href = 'index.html';
}

/* ===== STORAGE HELPERS ===== */
const DB_KEY = 'sm_inquiries';

function loadInquiries() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch { return []; }
}
function saveInquiries(list) {
  localStorage.setItem(DB_KEY, JSON.stringify(list));
}


function uid() {
  return 'inq_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ===== CLOCK ===== */
function updateClock() {
  const el = document.getElementById('topbarTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
updateClock();
setInterval(updateClock, 1000);

/* ===== TOAST ===== */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => t.className = 'toast', 2800);
}

/* ===== SIDEBAR TOGGLE ===== */
const sidebar = document.getElementById('sidebar');
const mainWrap = document.querySelector('.main-wrap');
document.getElementById('sidebarToggle').addEventListener('click', () => {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    mainWrap.classList.toggle('full');
  }
});

/* ===== LOGOUT ===== */
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.setItem('sm_admin_auth', 'no');
  window.location.href = 'index.html';
});

/* ===== PAGE NAVIGATION ===== */
let currentPage = 'overview';
function showPage(name) {
  document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
  const el = document.getElementById('page-' + name);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${name}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = { overview:'数据总览', inquiries:'询盘管理', products:'商品管理', consultations:'线上问诊' };
  document.getElementById('pageTitle').textContent = titles[name] || '';
  currentPage = name;
  if (name === 'overview') renderOverview();
  if (name === 'inquiries') renderInquiries();
  if (name === 'products') renderProducts();
  if (name === 'consultations') renderConsultations();
}

document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    showPage(el.dataset.page);
  });
});

/* ===== OVERVIEW ===== */
function renderOverview() {
  const all = loadInquiries();
  const newCount = all.filter(i => i.status === 'new').length;
  const today = new Date(); today.setHours(0,0,0,0);
  const todayCount = all.filter(i => new Date(i.time) >= today).length;

  document.getElementById('statTotal').textContent = all.length;
  document.getElementById('statNew').textContent = newCount;
  document.getElementById('statToday').textContent = todayCount;

  // Badge
  document.getElementById('newBadge').textContent = newCount;
  document.getElementById('notifyDot').style.display = newCount > 0 ? 'block' : 'none';

  // Top service
  const svcCount = {};
  all.forEach(i => (i.services || []).forEach(s => svcCount[s] = (svcCount[s] || 0) + 1));
  const topSvc = Object.entries(svcCount).sort((a,b) => b[1]-a[1])[0];
  document.getElementById('statTopService').textContent = topSvc ? topSvc[0] : '—';

  // Service bars
  const svcOrder = ['医美整形','精密体检','再生医疗','免疫疗法'];
  const maxSvc = Math.max(...svcOrder.map(s => svcCount[s] || 0), 1);
  const sbEl = document.getElementById('serviceBars');
  sbEl.innerHTML = '';
  svcOrder.forEach(s => {
    const cnt = svcCount[s] || 0;
    sbEl.innerHTML += `<div class="bar-row">
      <span class="bar-label">${s}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cnt/maxSvc*100)}%"></div></div>
      <span class="bar-count">${cnt}</span>
    </div>`;
  });
  if (!all.length) sbEl.innerHTML = '<div class="no-data">暂无数据</div>';

  // Region bars
  const regCount = {};
  all.forEach(i => { if(i.region) regCount[i.region] = (regCount[i.region]||0)+1; });
  const regEntries = Object.entries(regCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxReg = Math.max(...regEntries.map(r=>r[1]), 1);
  const rbEl = document.getElementById('regionBars');
  rbEl.innerHTML = '';
  regEntries.forEach(([r, cnt]) => {
    rbEl.innerHTML += `<div class="bar-row">
      <span class="bar-label">${r}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cnt/maxReg*100)}%"></div></div>
      <span class="bar-count">${cnt}</span>
    </div>`;
  });
  if (!regEntries.length) rbEl.innerHTML = '<div class="no-data">暂无数据</div>';

  // Recent 5
  const recent5 = [...all].sort((a,b)=>b.time-a.time).slice(0,5);
  const rlEl = document.getElementById('recentList');
  if (!recent5.length) {
    rlEl.innerHTML = '<div class="no-data" style="padding:40px 0">暂无询盘数据</div>';
    return;
  }
  rlEl.innerHTML = recent5.map(i => `
    <div class="recent-row" data-id="${i.id}">
      <div class="rr-avatar">${i.name.slice(0,1)}</div>
      <div class="rr-info">
        <div class="rr-name">${i.name} <span class="status-badge status-${i.status}">${statusLabel(i.status)}</span></div>
        <div class="rr-meta">${i.region} · ${(i.services||[]).join('、')}${i.message ? ' · '+i.message : ''}</div>
      </div>
      <div class="rr-time">${timeAgo(i.time)}</div>
    </div>
  `).join('');
  rlEl.querySelectorAll('.recent-row').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.id));
  });
}

/* ===== INQUIRIES TABLE ===== */
let inqPage = 1;
const PER_PAGE = 10;
let currentInqId = null;

function renderInquiries() {
  const all = loadInquiries();
  const search  = (document.getElementById('inqSearch').value || '').toLowerCase();
  const fStatus = document.getElementById('inqFilterStatus').value;
  const fSvc    = document.getElementById('inqFilterService').value;

  let filtered = all.filter(i => {
    if (fStatus && i.status !== fStatus) return false;
    if (fSvc && !(i.services||[]).includes(fSvc)) return false;
    if (search) {
      const hay = `${i.name} ${i.phone} ${i.region} ${i.message}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }).sort((a,b) => b.time - a.time);

  const total = filtered.length;
  const pages = Math.ceil(total / PER_PAGE) || 1;
  if (inqPage > pages) inqPage = pages;
  const slice = filtered.slice((inqPage-1)*PER_PAGE, inqPage*PER_PAGE);

  const tbody = document.getElementById('inqTableBody');
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="no-data" style="padding:60px 0">没有符合条件的询盘</td></tr>';
  } else {
    tbody.innerHTML = slice.map(i => `
      <tr>
        <td><input type="checkbox" class="row-check" data-id="${i.id}" /></td>
        <td class="td-name">${i.name}</td>
        <td>${i.phone || '—'}</td>
        <td>${i.region || '—'}</td>
        <td><div class="td-services">${(i.services||[]).map(s=>`<span class="td-service-tag">${s}</span>`).join('')}</div></td>
        <td><div class="td-msg" title="${i.message||''}">${i.message || '—'}</div></td>
        <td style="white-space:nowrap;font-size:.78rem;color:var(--mid)">${formatTime(i.time)}</td>
        <td><span class="status-badge status-${i.status}">${statusLabel(i.status)}</span></td>
        <td><button class="btn-detail" data-id="${i.id}">查看</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => openModal(btn.dataset.id));
    });
  }

  // Pagination
  const pg = document.getElementById('inqPagination');
  pg.innerHTML = '';
  for (let p = 1; p <= pages; p++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (p === inqPage ? ' active' : '');
    btn.textContent = p;
    btn.addEventListener('click', () => { inqPage = p; renderInquiries(); });
    pg.appendChild(btn);
  }

  // Update badge
  const newCount = all.filter(i => i.status === 'new').length;
  document.getElementById('newBadge').textContent = newCount;
}

// Filters
['inqSearch','inqFilterStatus','inqFilterService'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => { inqPage = 1; renderInquiries(); });
  document.getElementById(id).addEventListener('change', () => { inqPage = 1; renderInquiries(); });
});

// Select all
document.getElementById('selectAll').addEventListener('change', function() {
  document.querySelectorAll('.row-check').forEach(cb => cb.checked = this.checked);
});

// Export CSV
document.getElementById('exportBtn').addEventListener('click', () => {
  const all = loadInquiries();
  if (!all.length) { showToast('暂无数据可导出', 'error'); return; }
  const headers = ['姓名','联系方式','地区','感兴趣服务','留言','提交时间','状态'];
  const rows = all.map(i => [
    i.name, i.phone, i.region,
    (i.services||[]).join('|'),
    (i.message||'').replace(/,/g,'，'),
    formatTime(i.time),
    statusLabel(i.status)
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `询盘数据_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('导出成功', 'success');
});

// Clear all
document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!confirm('确定要清空所有询盘数据吗？此操作不可恢复。')) return;
  saveInquiries([]);
  renderInquiries();
  renderOverview();
  showToast('数据已清空');
});

/* ===== MODAL ===== */
function openModal(id) {
  const all = loadInquiries();
  const inq = all.find(i => i.id === id);
  if (!inq) return;
  currentInqId = id;

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-field"><label>姓名</label><div class="field-val">${inq.name}</div></div>
    <div class="modal-field"><label>联系电话 / WhatsApp / 微信</label><div class="field-val">${inq.phone||'未填写'}</div></div>
    <div class="modal-field"><label>所在地区</label><div class="field-val">${inq.region||'未填写'}</div></div>
    <div class="modal-field"><label>感兴趣服务</label><div class="field-val">${(inq.services||[]).join('、')||'未选择'}</div></div>
    <div class="modal-field"><label>留言</label><div class="field-val">${inq.message||'（无留言）'}</div></div>
    <div class="modal-field"><label>提交时间</label><div class="field-val">${formatTime(inq.time)}</div></div>
  `;
  document.getElementById('modalStatus').value = inq.status || 'new';
  document.getElementById('detailModal').style.display = 'flex';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('detailModal').addEventListener('click', e => {
  if (e.target === document.getElementById('detailModal')) closeModal();
});
function closeModal() {
  document.getElementById('detailModal').style.display = 'none';
  currentInqId = null;
}

document.getElementById('saveStatus').addEventListener('click', () => {
  if (!currentInqId) return;
  const all = loadInquiries();
  const idx = all.findIndex(i => i.id === currentInqId);
  if (idx < 0) return;
  all[idx].status = document.getElementById('modalStatus').value;
  saveInquiries(all);
  closeModal();
  renderInquiries();
  renderOverview();
  showToast('状态已更新', 'success');
});

document.getElementById('deleteInq').addEventListener('click', () => {
  if (!currentInqId) return;
  if (!confirm('确定删除此条询盘？')) return;
  const all = loadInquiries().filter(i => i.id !== currentInqId);
  saveInquiries(all);
  closeModal();
  renderInquiries();
  renderOverview();
  showToast('已删除');
});

/* ===== HELPERS ===== */
function statusLabel(s) {
  return { new:'未处理', contacted:'已联系', closed:'已完成' }[s] || s;
}
function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n) { return String(n).padStart(2,'0'); }
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h/24)}天前`;
}

/* ===== INIT ===== */
renderOverview();

/* ====================================================================
   PRODUCTS MANAGEMENT
   ==================================================================== */
const PROD_KEY = 'sm_products';

// Default products (from shenghuo.html)
const DEFAULT_PRODUCTS = [
  { id:1,  cat:'nmn',    brand:'AFC Japan',           name:'NMN 9000 Ultra 超高纯度',        spec:'60粒 · 60日量', price:1280, orig:1580, badge:'热销', emoji:'⚡', grad:'linear-gradient(135deg,#7c3aed,#4f46e5)', desc:'AFC Japan 旗舰级 NMN 产品，每粒含 NMN 150mg，纯度高达 99% 以上。采用日本独家低温萃取工艺，有效保留 NMN 活性成分，帮助激活体内 NAD+ 水平，从细胞层面对抗衰老。', highlights:['NMN 纯度 ≥99%，无杂质添加','每日摄入 300mg，临床推荐剂量','日本国内生产，厚生劳动省备案','60粒装，60天完整疗程'], images:[] },
  { id:2,  cat:'nmn',    brand:'Mirai Lab',            name:'Pure NMN 12000 高纯胶囊',        spec:'60粒 · 60日量', price:1680, orig:1980, badge:'新品', emoji:'⚡', grad:'linear-gradient(135deg,#6d28d9,#7c3aed)', desc:'Mirai Lab 研发的高浓度 NMN 胶囊，每粒含 NMN 200mg，辅以白藜芦醇协同增效。全球顶级运动员及健康意识人群首选，已通过多项第三方独立检测认证。', highlights:['超高浓度 200mg/粒','白藜芦醇协同增效配方','第三方检测报告透明公开','无麸质、无转基因'], images:[] },
  { id:3,  cat:'nmn',    brand:'MitoGen',              name:'NMN Plus 复合抗衰配方',           spec:'60粒 · 60日量', price:980,  orig:null, badge:'',    emoji:'⚡', grad:'linear-gradient(135deg,#5b21b6,#6d28d9)', desc:'MitoGen 将 NMN 与辅酶 Q10、葡萄籽提取物科学复配，多通路协同激活线粒体功能，改善细胞能量代谢。适合 35 岁以上注重全面抗衰的人群。', highlights:['NMN+CoQ10+葡萄籽三重配方','改善线粒体能量代谢','适合35岁+全面抗衰','日本GMP认证工厂生产'], images:[] },
  { id:4,  cat:'nmn',    brand:'Cosmo Health',         name:'NMN 3000 入门纯粹版',            spec:'60粒 · 60日量', price:680,  orig:880,  badge:'',    emoji:'⚡', grad:'linear-gradient(135deg,#8b5cf6,#7c3aed)', desc:'Cosmo Health 入门级 NMN 产品，每粒含 NMN 50mg，温和有效。适合首次接触 NMN 的用户循序渐进补充，性价比极高，是开启 NMN 健康之旅的理想选择。', highlights:['温和剂量，适合NMN新手','高性价比入门首选','日本原装进口','无添加剂纯粹配方'], images:[] },
  { id:5,  cat:'men',    brand:'DHC',                  name:'玛卡锌精力配方',                  spec:'30粒 · 30日量', price:298,  orig:368,  badge:'热销', emoji:'💪', grad:'linear-gradient(135deg,#1d4ed8,#0891b2)', desc:'DHC 经典男性活力产品，精选秘鲁高原玛卡提取物与有机锌黄金配比。玛卡自古被称为「男人之根」，结合锌元素可有效支持男性激素平衡、提升日常精力与专注力。', highlights:['高原玛卡精华提取','有机锌黄金配比','日本 DHC 品质保证','连续服用4周效果最佳'], images:[] },
  { id:6,  cat:'men',    brand:'三得利 Suntory',        name:'芝麻明E + DHA 男性活力',          spec:'90粒 · 30日量', price:358,  orig:null, badge:'',    emoji:'💪', grad:'linear-gradient(135deg,#0369a1,#0284c7)', desc:'三得利独家「芝麻明E」专利成分联合 DHA 深海鱼油，双重保护男性心血管与大脑健康。长期服用有助于改善疲劳感、增强记忆力与注意力集中度。', highlights:['三得利独家芝麻明E专利','DHA深海鱼油精华','改善记忆力与专注力','90粒装高性价比'], images:[] },
  { id:7,  cat:'men',    brand:'Fancl',                name:'男性综合营养包 30岁+',             spec:'30包 · 30日量', price:428,  orig:528,  badge:'',    emoji:'💪', grad:'linear-gradient(135deg,#075985,#0369a1)', desc:'Fancl 专为 30 岁以上男性设计的全方位营养解决方案，每包包含维生素 B 族、锌、番茄红素等 11 种精选营养素，针对工作压力大、易疲劳的都市男性量身调配。', highlights:['11种精选营养素','专为30岁+男性设计','单包独立包装便于携带','无香料无色素无防腐剂'], images:[] },
  { id:8,  cat:'men',    brand:'Sato Pharmaceutical', name:'男性活力睡眠综合配方',             spec:'60粒 · 30日量', price:338,  orig:408,  badge:'新品', emoji:'💪', grad:'linear-gradient(135deg,#1e40af,#1d4ed8)', desc:'佐藤制药全新男性活力 × 睡眠双效配方，GABA 联合 L-色氨酸助眠，精氨酸与玛卡提升活力，睡前一粒，夜间修复 + 白天精力满格，专为繁忙都市男性设计。', highlights:['活力+睡眠双效合一','GABA助眠+精氨酸提力','佐藤制药百年品质','全程无刺激配方'], images:[] },
  { id:9,  cat:'women',  brand:'Asahi',                name:'胶原蛋白粉 天然柚子味',           spec:'225g · 30日量', price:198,  orig:248,  badge:'热销', emoji:'🌸', grad:'linear-gradient(135deg,#db2777,#be185d)', desc:'Asahi 明星胶原蛋白粉，每日 7500mg 超高剂量低分子鱼胶原蛋白，搭配维生素 C 促进吸收，天然柚子口味清爽易饮。持续服用 4 周，肌肤弹力与光泽度显著提升。', highlights:['超高剂量7500mg/日','低分子量胶原蛋白易吸收','维生素C协同促进','天然柚子口味无负担'], images:[] },
  { id:10, cat:'women',  brand:'DHC',                  name:'胶原蛋白片 黄金配比',             spec:'120粒 · 60日量',price:168,  orig:null, badge:'',    emoji:'🌸', grad:'linear-gradient(135deg,#ec4899,#db2777)', desc:'DHC 精心研发的胶原蛋白片，每片含猪胶原蛋白 250mg，辅以透明质酸与维生素 C，三重协同补充肌肤水分与弹性。胶囊小巧易吞，无腥味，每日4片方便坚持。', highlights:['DHC品质保证','透明质酸协同补水','无腥味胶囊剂型','120粒超值装60日量'], images:[] },
  { id:11, cat:'women',  brand:'Fancl',                name:'抗糖化胶囊 活化肌底',             spec:'30粒 · 30日量', price:388,  orig:468,  badge:'新品', emoji:'🌸', grad:'linear-gradient(135deg,#9d174d,#be185d)', desc:'Fancl 针对糖化危害研发的功能性胶囊，核心成分「黑姜提取物」经临床证实可有效抑制 AGEs 生成，从源头减少肌肤暗黄、弹性下降。配合维生素 B1 强化效果。', highlights:['抑制AGEs糖化反应','黑姜提取物临床验证','改善暗黄与弹力','Fancl无添加品质理念'], images:[] },
  { id:12, cat:'women',  brand:'Meiji',                name:'胶原蛋白饮料 弹肌版',             spec:'10瓶装',        price:248,  orig:298,  badge:'',    emoji:'🌸', grad:'linear-gradient(135deg,#f472b6,#ec4899)', desc:'明治精心调配的胶原蛋白液体饮料，每瓶含 10000mg 胶原蛋白肽，搭配弹力素与玻尿酸，即开即饮，口感清爽，随时随地为肌肤补充核心营养。', highlights:['每瓶10000mg高剂量','胶原蛋白肽+玻尿酸','即开即饮携带方便','明治品质严格把控'], images:[] },
  { id:13, cat:'women',  brand:'Eisai',                name:'女性铁元素综合营养',              spec:'60粒 · 30日量', price:228,  orig:278,  badge:'',    emoji:'🌸', grad:'linear-gradient(135deg,#be185d,#9d174d)', desc:'卫材制药专为女性设计的补铁配方，有机铁联合叶酸、维生素 B12，有效改善贫血引起的疲倦乏力、肤色暗淡。温和不伤胃，特别适合月经量多、素食女性日常补充。', highlights:['有机铁+叶酸+维B12','改善贫血疲倦','温和不刺激肠胃','卫材制药医药品质'], images:[] },
  { id:14, cat:'gut',    brand:'Yakult',               name:'益力多 1000 强效乳酸菌',         spec:'7瓶装',         price:168,  orig:null, badge:'热销', emoji:'🦠', grad:'linear-gradient(135deg,#d97706,#b45309)', desc:'益力多经典乳酸菌饮料升级版，每瓶含独家 LcS 乳酸菌 1000 亿个，是普通版的 10 倍。活菌经科学包裹技术确保安全抵达肠道，改善肠道菌群，提升免疫屏障。', highlights:['每瓶LcS活菌1000亿','独家专利菌株LcS','改善便秘与免疫力','每日一瓶简单坚持'], images:[] },
  { id:15, cat:'gut',    brand:'Asahi',                name:'万田酵素 Plus 综合酵素',         spec:'180粒 · 30日量',price:298,  orig:368,  badge:'',    emoji:'🦠', grad:'linear-gradient(135deg,#92400e,#b45309)', desc:'朝日万田酵素 Plus，传承日本 60 年发酵工艺，精选 53 种蔬果经 3 年自然发酵提炼，富含消化酶、代谢酶及植物营养素，全面激活身体自愈与代谢能力。', highlights:['53种蔬果3年自然发酵','双重消化+代谢酵素','60年日本发酵工艺','180粒超大容量'], images:[] },
  { id:16, cat:'gut',    brand:'DHC',                  name:'膳食纤维 速溶颗粒',              spec:'30包 · 30日量', price:138,  orig:null, badge:'',    emoji:'🦠', grad:'linear-gradient(135deg,#ca8a04,#d97706)', desc:'DHC 速溶膳食纤维颗粒，每包含水溶性膳食纤维 5g，搭配低聚果糖促进双歧杆菌增殖。溶于水无味无色，可加入任何饮料或食物，解决现代人膳食纤维严重不足问题。', highlights:['每包5g水溶性膳食纤维','低聚果糖促进益生菌','溶于任何饮料无色无味','30包独立包装'], images:[] },
  { id:17, cat:'gut',    brand:'Morinaga',             name:'比菲德氏菌 益生菌套装',          spec:'60粒 · 30日量', price:218,  orig:268,  badge:'新品', emoji:'🦠', grad:'linear-gradient(135deg,#f59e0b,#d97706)', desc:'森永乳业旗下益生菌领导品牌，含独家比菲德氏菌 BB536 专利菌株，每粒 50 亿活菌经特殊肠溶包衣，耐胃酸直达肠道定植，有效改善便秘、腹泻及免疫功能。', highlights:['BB536专利比菲德菌株','肠溶包衣耐胃酸','50亿活菌精准送达','森永乳业60年研究'], images:[] },
  { id:18, cat:'immune', brand:'DHC',                  name:'维生素C缓释 高浓度',             spec:'120粒 · 60日量',price:128,  orig:158,  badge:'热销', emoji:'🛡️', grad:'linear-gradient(135deg,#059669,#047857)', desc:'DHC 缓释维生素 C，独特缓释技术让维生素 C 在 8 小时内持续释放，最大化吸收利用率。每粒含 1000mg 高纯度维C，有效提升免疫力、促进胶原蛋白合成、抗氧化护肤。', highlights:['1000mg/粒高浓度','8小时持续缓释技术','免疫+美白双重效果','DHC畅销数十年配方'], images:[] },
  { id:19, cat:'immune', brand:'Fancl',                name:'辅酶Q10 护心活力',               spec:'60粒 · 30日量', price:298,  orig:358,  badge:'',    emoji:'🛡️', grad:'linear-gradient(135deg,#065f46,#047857)', desc:'Fancl 还原型辅酶 Q10，采用生物利用率更高的还原态（泛醇）形式，直接参与细胞能量 ATP 生成，护心、抗氧化、增强体力。40 岁以上 CoQ10 合成减少，补充尤为重要。', highlights:['还原型CoQ10生物利用率高','支持心脏能量代谢','细胞级抗氧化防护','Fancl无添加品质'], images:[] },
  { id:20, cat:'immune', brand:'大塚制药 Otsuka',       name:'DENY 综合维生素矿物质',          spec:'30日量',        price:188,  orig:228,  badge:'新品', emoji:'🛡️', grad:'linear-gradient(135deg,#10b981,#059669)', desc:'大塚制药 DENY 系列，专为免疫系统全面设计，含维生素 A、C、D3、E、锌、硒 6 大免疫核心营养素，科学配比协同增强自然免疫力，特别适合季节交替易感人群日常防护。', highlights:['6大免疫核心营养素','D3+锌+硒精准配比','大塚制药医药级品质','季节换季防护首选'], images:[] },
  { id:21, cat:'immune', brand:'Ribon',                name:'维生素D3 + K2 骨质强化',         spec:'60粒 · 60日量', price:168,  orig:198,  badge:'',    emoji:'🛡️', grad:'linear-gradient(135deg,#047857,#065f46)', desc:'Ribon 维生素 D3 联合 K2 黄金搭档，D3 促进钙质肠道吸收，K2 引导钙质精准沉积至骨骼而非血管壁，双管齐下强化骨密度、预防骨质疏松，同时提升免疫调节功能。', highlights:['D3+K2黄金骨骼组合','精准钙质导向骨骼','预防骨质疏松','老人及女性特别推荐'], images:[] },
  { id:22, cat:'icon',   brand:'三得利 Suntory',        name:'葡萄糖胺软骨素 关节守护',        spec:'270粒 · 90日量',price:328,  orig:398,  badge:'热销', emoji:'🎌', grad:'linear-gradient(135deg,#dc2626,#b91c1c)', desc:'三得利经典关节保健品，每日含高纯度硫酸软骨素 1200mg + 葡萄糖胺 1500mg，搭配Ⅱ型胶原蛋白，三重守护软骨与关节液，长期服用有效缓解关节酸痛、改善活动灵活度。', highlights:['三重关节保护配方','软骨素1200mg+葡萄糖胺1500mg','三得利30年研究成果','270粒超大容量'], images:[] },
  { id:23, cat:'icon',   brand:'DHC',                  name:'深海鱼油 EPA+DHA 心血管',        spec:'120粒 · 60日量',price:168,  orig:null, badge:'',    emoji:'🎌', grad:'linear-gradient(135deg,#b91c1c,#991b1b)', desc:'DHC 深海鱼油，精选北大西洋深海鱼提炼，每粒含 EPA 300mg + DHA 240mg，高纯度 Omega-3 有效降低甘油三酯、软化血管，守护心脑血管健康。无腥味肠溶胶囊设计。', highlights:['EPA 300mg + DHA 240mg/粒','降甘油三酯保护心脑','无腥味肠溶胶囊','DHC畅销全球配方'], images:[] },
  { id:24, cat:'icon',   brand:'AFC Japan',            name:'白芸豆阻糖 饭前必备',            spec:'90粒 · 30日量', price:248,  orig:298,  badge:'',    emoji:'🎌', grad:'linear-gradient(135deg,#7f1d1d,#b91c1c)', desc:'AFC Japan 白芸豆提取物，含 α-淀粉酶抑制因子，饭前服用可减少淀粉类食物糖分吸收，有效控制餐后血糖波动，配合热量管理，是注重身材与血糖健康人群的日常伴侣。', highlights:['抑制α-淀粉酶减少糖吸收','饭前服用控制餐后血糖','配合饮食管理效果佳','AFC日本直采正品'], images:[] },
  { id:25, cat:'icon',   brand:'Fancl',                name:'纳豆激酶 血液循环',              spec:'30粒 · 30日量', price:318,  orig:388,  badge:'新品', emoji:'🎌', grad:'linear-gradient(135deg,#ef4444,#dc2626)', desc:'Fancl 纳豆激酶精华，每粒含 2000FU 高活性纳豆激酶，专门溶解血栓前体纤维蛋白，促进血液循环流畅，预防血液黏稠，特别适合久坐办公、长时间飞行及心脑血管高风险人群。', highlights:['2000FU高活性纳豆激酶','溶解血栓预防血液黏稠','久坐飞行人群必备','Fancl无添加严格品质'], images:[] },
];

function loadProducts() {
  try {
    const stored = localStorage.getItem(PROD_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PRODUCTS.slice();
  } catch { return DEFAULT_PRODUCTS.slice(); }
}
function saveProducts(list) {
  localStorage.setItem(PROD_KEY, JSON.stringify(list));
}

function prodUID() {
  return Date.now();
}

const CAT_LABELS = { nmn:'NMN抗衰老', men:'男性保健', women:'女性养生', gut:'肠道健康', immune:'免疫营养', icon:'日本名品' };

/* ----- Render product admin grid ----- */
function renderProducts() {
  const all = loadProducts();
  const search = (document.getElementById('prodSearch').value || '').toLowerCase();
  const cat = document.getElementById('prodFilterCat').value;

  const filtered = all.filter(p => {
    if (cat && p.cat !== cat) return false;
    if (search) {
      const hay = (p.name + ' ' + p.brand + ' ' + p.desc).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const grid = document.getElementById('prodGrid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="no-data" style="padding:60px 0">没有符合条件的商品</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const imgThumb = p.images && p.images.length > 0
      ? `<img src="${p.images[0]}" alt="${p.name}" class="prod-admin-thumb" onerror="this.style.display='none'">`
      : `<div class="prod-admin-emoji" style="background:${p.grad}">${p.emoji || '📦'}</div>`;
    const discPct = p.orig ? Math.round((1 - p.price/p.orig)*100) : 0;
    return `
    <div class="prod-admin-card">
      <div class="pac-img">${imgThumb}</div>
      <div class="pac-body">
        <div class="pac-meta">
          <span class="pac-cat">${CAT_LABELS[p.cat] || p.cat}</span>
          ${p.badge ? `<span class="pac-badge">${p.badge}</span>` : ''}
          ${p.images && p.images.length > 0 ? `<span class="pac-imgs-count">📷 ${p.images.length}图</span>` : ''}
        </div>
        <div class="pac-brand">${p.brand}</div>
        <div class="pac-name">${p.name}</div>
        <div class="pac-spec">${p.spec || ''}</div>
        <div class="pac-price-row">
          <span class="pac-price">¥${p.price.toLocaleString()}</span>
          ${p.orig ? `<span class="pac-orig">¥${p.orig.toLocaleString()}</span><span class="pac-disc">-${discPct}%</span>` : ''}
        </div>
      </div>
      <div class="pac-actions">
        <button class="btn-detail" onclick="openProdForm(${p.id})">编辑</button>
        <button class="btn-danger-sm" onclick="deleteProduct(${p.id})">删除</button>
      </div>
    </div>`;
  }).join('');
}

['prodSearch', 'prodFilterCat'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderProducts);
  document.getElementById(id).addEventListener('change', renderProducts);
});

/* ----- Product form ----- */
let editingProdId = null;
let pfImages = []; // array of {url, dataUrl}

function openProdForm(id) {
  editingProdId = id || null;
  const modal = document.getElementById('prodModal');
  const all = loadProducts();
  pfImages = [];

  if (id) {
    const p = all.find(x => x.id === id);
    if (!p) return;
    document.getElementById('prodModalTitle').textContent = '编辑商品';
    document.getElementById('pf-name').value = p.name || '';
    document.getElementById('pf-brand').value = p.brand || '';
    document.getElementById('pf-cat').value = p.cat || 'nmn';
    document.getElementById('pf-spec').value = p.spec || '';
    document.getElementById('pf-badge').value = p.badge || '';
    document.getElementById('pf-price').value = p.price || '';
    document.getElementById('pf-orig').value = p.orig || '';
    document.getElementById('pf-emoji').value = p.emoji || '';
    document.getElementById('pf-grad').value = p.grad || '';
    document.getElementById('pf-desc').value = p.desc || '';
    document.getElementById('pf-highlights').value = (p.highlights || []).join('\n');
    pfImages = (p.images || []).map(url => ({ url }));
  } else {
    document.getElementById('prodModalTitle').textContent = '添加商品';
    document.getElementById('pf-name').value = '';
    document.getElementById('pf-brand').value = '';
    document.getElementById('pf-cat').value = 'nmn';
    document.getElementById('pf-spec').value = '';
    document.getElementById('pf-badge').value = '';
    document.getElementById('pf-price').value = '';
    document.getElementById('pf-orig').value = '';
    document.getElementById('pf-emoji').value = '';
    document.getElementById('pf-grad').value = 'linear-gradient(135deg,#9b2335,#e8637a)';
    document.getElementById('pf-desc').value = '';
    document.getElementById('pf-highlights').value = '';
    pfImages = [];
  }
  renderPfImages();
  modal.style.display = 'flex';
}

function renderPfImages() {
  const wrap = document.getElementById('pfImagesWrap');
  wrap.innerHTML = pfImages.map((img, idx) => `
    <div class="pf-img-row" data-idx="${idx}">
      <div class="pf-img-preview">
        ${img.url ? `<img src="${img.url}" alt="图片${idx+1}" onerror="this.style.display='none'">` : '<span style="color:#aaa;font-size:.75rem">预览</span>'}
      </div>
      <input type="text" class="pf-img-url" placeholder="图片网址 (https://...)" value="${img.url || ''}"
        onchange="pfImages[${idx}].url=this.value; pfUpdatePreview(${idx}, this.value)" />
      <label class="pf-img-upload-btn" title="本地上传">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <input type="file" accept="image/*" onchange="pfUploadLocal(event,${idx})" style="display:none">
      </label>
      <button type="button" class="pf-img-del" onclick="pfRemoveImg(${idx})" title="删除">✕</button>
    </div>
  `).join('');
}

function pfUpdatePreview(idx, url) {
  const row = document.querySelector(`.pf-img-row[data-idx="${idx}"]`);
  if (!row) return;
  const preview = row.querySelector('.pf-img-preview');
  if (url) {
    preview.innerHTML = `<img src="${url}" alt="preview" onerror="this.style.display='none'">`;
  } else {
    preview.innerHTML = '<span style="color:#aaa;font-size:.75rem">预览</span>';
  }
}

function pfUploadLocal(e, idx) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    pfImages[idx].url = ev.target.result;
    renderPfImages();
  };
  reader.readAsDataURL(file);
}

function pfRemoveImg(idx) {
  pfImages.splice(idx, 1);
  renderPfImages();
}

document.getElementById('pfAddImgBtn').addEventListener('click', () => {
  pfImages.push({ url: '' });
  renderPfImages();
});

document.getElementById('prodModalClose').addEventListener('click', closeProdModal);
document.getElementById('cancelProdBtn').addEventListener('click', closeProdModal);
document.getElementById('prodModal').addEventListener('click', e => {
  if (e.target === document.getElementById('prodModal')) closeProdModal();
});

function closeProdModal() {
  document.getElementById('prodModal').style.display = 'none';
  editingProdId = null;
  pfImages = [];
}

document.getElementById('saveProdBtn').addEventListener('click', () => {
  const name = document.getElementById('pf-name').value.trim();
  const brand = document.getElementById('pf-brand').value.trim();
  const price = parseFloat(document.getElementById('pf-price').value);

  if (!name || !brand || isNaN(price)) {
    showToast('请填写商品名称、品牌及售价', 'error');
    return;
  }

  const origVal = parseFloat(document.getElementById('pf-orig').value);
  const highlights = document.getElementById('pf-highlights').value
    .split('\n').map(s => s.trim()).filter(Boolean);
  const images = pfImages.map(i => i.url).filter(Boolean);

  const all = loadProducts();
  if (editingProdId) {
    const idx = all.findIndex(p => p.id === editingProdId);
    if (idx < 0) return;
    Object.assign(all[idx], {
      name, brand,
      cat:  document.getElementById('pf-cat').value,
      spec: document.getElementById('pf-spec').value.trim(),
      badge:document.getElementById('pf-badge').value,
      price,
      orig: isNaN(origVal) || origVal <= 0 ? null : origVal,
      emoji:document.getElementById('pf-emoji').value.trim(),
      grad: document.getElementById('pf-grad').value.trim(),
      desc: document.getElementById('pf-desc').value.trim(),
      highlights,
      images,
    });
    showToast('商品已更新', 'success');
  } else {
    const newProd = {
      id: prodUID(),
      name, brand,
      cat:  document.getElementById('pf-cat').value,
      spec: document.getElementById('pf-spec').value.trim(),
      badge:document.getElementById('pf-badge').value,
      price,
      orig: isNaN(origVal) || origVal <= 0 ? null : origVal,
      emoji:document.getElementById('pf-emoji').value.trim() || '📦',
      grad: document.getElementById('pf-grad').value.trim() || 'linear-gradient(135deg,#9b2335,#e8637a)',
      desc: document.getElementById('pf-desc').value.trim(),
      highlights,
      images,
    };
    all.push(newProd);
    showToast('商品已添加', 'success');
  }
  saveProducts(all);
  closeProdModal();
  renderProducts();
});

document.getElementById('addProductBtn').addEventListener('click', () => openProdForm(null));

document.getElementById('resetProductsBtn').addEventListener('click', () => {
  if (!confirm('确定恢复默认商品列表？当前所有改动将丢失。')) return;
  localStorage.removeItem(PROD_KEY);
  renderProducts();
  showToast('已恢复默认商品', 'success');
});

function deleteProduct(id) {
  if (!confirm('确定删除此商品？')) return;
  const all = loadProducts().filter(p => p.id !== id);
  saveProducts(all);
  renderProducts();
  showToast('商品已删除');
}

/* ====================================================================
   CONSULTATIONS MANAGEMENT
   ==================================================================== */
const CON_KEY = 'sm_consultations';

function loadConsultations() {
  try { return JSON.parse(localStorage.getItem(CON_KEY)) || []; }
  catch { return []; }
}
function saveConsultations(list) {
  localStorage.setItem(CON_KEY, JSON.stringify(list));
}

let conPage = 1;
const CON_PER_PAGE = 10;
let currentConId = null;

function renderConsultations() {
  const all = loadConsultations();
  const search = (document.getElementById('conSearch').value || '').toLowerCase();
  const fStatus = document.getElementById('conFilterStatus').value;
  const fDept   = document.getElementById('conFilterDept').value;

  // Update badge
  const newCount = all.filter(c => c.status === 'new').length;
  document.getElementById('consultBadge').textContent = newCount;

  let filtered = all.filter(c => {
    if (fStatus && c.status !== fStatus) return false;
    if (fDept && c.dept !== fDept) return false;
    if (search) {
      const hay = `${c.name} ${c.phone} ${c.region} ${c.dept} ${c.symptoms}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  }).sort((a, b) => b.time - a.time);

  const total = filtered.length;
  const pages = Math.ceil(total / CON_PER_PAGE) || 1;
  if (conPage > pages) conPage = pages;
  const slice = filtered.slice((conPage-1)*CON_PER_PAGE, conPage*CON_PER_PAGE);

  const tbody = document.getElementById('conTableBody');
  if (!slice.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="no-data" style="padding:60px 0">暂无线上问诊预约数据</td></tr>';
  } else {
    tbody.innerHTML = slice.map(c => `
      <tr>
        <td class="td-name">${c.name}</td>
        <td>${c.phone || '—'}</td>
        <td>${c.region || '—'}</td>
        <td><span class="td-service-tag">${c.dept || '—'}</span></td>
        <td>${c.preferred || '—'}</td>
        <td><div class="td-msg" title="${c.symptoms||''}">${c.symptoms || '—'}</div></td>
        <td style="white-space:nowrap;font-size:.78rem;color:var(--mid)">${formatTime(c.time)}</td>
        <td><span class="status-badge status-${c.status}">${statusLabel(c.status)}</span></td>
        <td><button class="btn-detail" data-cid="${c.id}">查看</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-cid]').forEach(btn => {
      btn.addEventListener('click', () => openConModal(btn.dataset.cid));
    });
  }

  // Pagination
  const pg = document.getElementById('conPagination');
  pg.innerHTML = '';
  for (let p = 1; p <= pages; p++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (p === conPage ? ' active' : '');
    btn.textContent = p;
    btn.addEventListener('click', () => { conPage = p; renderConsultations(); });
    pg.appendChild(btn);
  }
}

['conSearch', 'conFilterStatus', 'conFilterDept'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => { conPage = 1; renderConsultations(); });
  document.getElementById(id).addEventListener('change', () => { conPage = 1; renderConsultations(); });
});

// Export CSV
document.getElementById('conExportBtn').addEventListener('click', () => {
  const all = loadConsultations();
  if (!all.length) { showToast('暂无数据可导出', 'error'); return; }
  const headers = ['姓名','联系方式','地区','科室','希望问诊时间','症状描述','提交时间','状态'];
  const rows = all.map(c => [
    c.name, c.phone, c.region, c.dept, c.preferred,
    (c.symptoms||'').replace(/,/g,'，'),
    formatTime(c.time),
    statusLabel(c.status)
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v||''}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `线上问诊_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('导出成功', 'success');
});

function openConModal(id) {
  const all = loadConsultations();
  const c = all.find(x => x.id === id);
  if (!c) return;
  currentConId = id;
  document.getElementById('conModalBody').innerHTML = `
    <div class="modal-field"><label>姓名</label><div class="field-val">${c.name}</div></div>
    <div class="modal-field"><label>联系方式</label><div class="field-val">${c.phone || '未填写'}</div></div>
    <div class="modal-field"><label>所在地区</label><div class="field-val">${c.region || '未填写'}</div></div>
    <div class="modal-field"><label>问诊科室</label><div class="field-val">${c.dept || '未选择'}</div></div>
    <div class="modal-field"><label>希望问诊时间</label><div class="field-val">${c.preferred || '不限'}</div></div>
    <div class="modal-field"><label>症状描述</label><div class="field-val">${c.symptoms || '（无描述）'}</div></div>
    <div class="modal-field"><label>提交时间</label><div class="field-val">${formatTime(c.time)}</div></div>
  `;
  document.getElementById('conModalStatus').value = c.status || 'new';
  document.getElementById('conDetailModal').style.display = 'flex';
}

document.getElementById('conModalClose').addEventListener('click', closeConModal);
document.getElementById('conDetailModal').addEventListener('click', e => {
  if (e.target === document.getElementById('conDetailModal')) closeConModal();
});
function closeConModal() {
  document.getElementById('conDetailModal').style.display = 'none';
  currentConId = null;
}

document.getElementById('saveConStatus').addEventListener('click', () => {
  if (!currentConId) return;
  const all = loadConsultations();
  const idx = all.findIndex(x => x.id === currentConId);
  if (idx < 0) return;
  all[idx].status = document.getElementById('conModalStatus').value;
  saveConsultations(all);
  closeConModal();
  renderConsultations();
  renderOverview();
  showToast('状态已更新', 'success');
});

document.getElementById('deleteConBtn').addEventListener('click', () => {
  if (!currentConId) return;
  if (!confirm('确定删除此条问诊记录？')) return;
  saveConsultations(loadConsultations().filter(c => c.id !== currentConId));
  closeConModal();
  renderConsultations();
  renderOverview();
  showToast('已删除');
});

/* Update consultation badge on init */
(function() {
  const cons = loadConsultations();
  const newCons = cons.filter(c => c.status === 'new').length;
  const badge = document.getElementById('consultBadge');
  if (badge) badge.textContent = newCons;
})();
