const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content);
}

function replaceAll(content, pairs) {
  let next = content;
  pairs.forEach(([from, to]) => {
    next = next.split(from).join(to);
  });
  return next;
}

function patchFile(file, pairs) {
  const before = read(file);
  const after = replaceAll(before, pairs);
  if (after !== before) {
    write(file, after);
    console.log(`updated ${file}`);
  }
}

const globalPairs = [
  ['<span class="footer-name">樱医集团</span>', '<span class="footer-name">Sakura Medical Group</span>'],
  ['href="#">微信: artipsg</a>', 'href="#">WeChat: artipsg</a>'],
  ['title="WhatsApp咨询"', 'title="WhatsApp Consultation"'],
  ['title="WhatsApp预约专员"', 'title="WhatsApp Booking Specialist"'],
];

fs.readdirSync(path.join(root, 'en'))
  .filter((name) => name.endsWith('.html'))
  .forEach((name) => {
    patchFile(path.join('en', name), globalPairs);
  });

patchFile('en/online-consultation.html', [
  ['      <div class="section-tag">专属顾问预约</div>', '      <div class="section-tag">Dedicated Booking Support</div>'],
  ['      <h2 class="section-title">启动深度评估方案</h2>', '      <h2 class="section-title">Start Your In-Depth Assessment</h2>'],
  ['      <p class="section-sub">填写以下信息，资深顾问将在24小时内与您确认资料准备、专家匹配方向与会诊时间窗口。</p>', '      <p class="section-sub">Share the details below and our senior care team will confirm document preparation, specialist matching and consultation timing within 24 hours.</p>'],
  ['            <label for="zxName">姓名 <em>*</em></label>', '            <label for="zxName">Full Name <em>*</em></label>'],
  ['            <input type="text" id="zxName" placeholder="请输入您的姓名" required />', '            <input type="text" id="zxName" placeholder="Enter your full name" required />'],
  ['            <label for="zxPhone">联系方式 <em>*</em></label>', '            <label for="zxPhone">Phone / WhatsApp <em>*</em></label>'],
  ['            <input type="text" id="zxPhone" placeholder="手机 / WhatsApp / 微信" required />', '            <input type="text" id="zxPhone" placeholder="Mobile / WhatsApp / WeChat" required />'],
  ['            <label for="zxRegion">所在地区</label>', '            <label for="zxRegion">Region</label>'],
  ['              <option value="">请选择地区</option>', '              <option value="">Select your region</option>'],
  ['              <option>中国大陆</option>', '              <option>Mainland China</option>'],
  ['              <option>香港/澳门</option>', '              <option>Hong Kong / Macau</option>'],
  ['              <option>日本</option>', '              <option>Japan</option>'],
  ['              <option>韩国</option>', '              <option>South Korea</option>'],
  ['              <option>新加坡</option>', '              <option>Singapore</option>'],
  ['              <option>马来西亚</option>', '              <option>Malaysia</option>'],
  ['              <option>泰国</option>', '              <option>Thailand</option>'],
  ['              <option>越南</option>', '              <option>Vietnam</option>'],
  ['              <option>印度尼西亚</option>', '              <option>Indonesia</option>'],
  ['              <option>菲律宾</option>', '              <option>Philippines</option>'],
  ['              <option>柬埔寨</option>', '              <option>Cambodia</option>'],
  ['              <option>缅甸</option>', '              <option>Myanmar</option>'],
  ['              <option>印度</option>', '              <option>India</option>'],
  ['              <option>蒙古</option>', '              <option>Mongolia</option>'],
  ['              <option>其他</option>', '              <option>Other</option>'],
  ['            <label for="zxDept">希望会诊方向 <em>*</em></label>', '            <label for="zxDept">Consultation Focus <em>*</em></label>'],
  ['              <option value="">请选择会诊方向</option>', '              <option value="">Select a department</option>'],
  ['              <option>内科</option>', '              <option>Internal Medicine</option>'],
  ['              <option>耳鼻喉科</option>', '              <option>ENT</option>'],
  ['              <option>皮肤科</option>', '              <option>Dermatology</option>'],
  ['              <option>儿科</option>', '              <option>Pediatrics</option>'],
  ['              <option>AGA脱发</option>', '              <option>AGA Hair Loss</option>'],
  ['              <option>减重管理</option>', '              <option>Weight Management</option>'],
  ['            <label for="zxPreferred">希望会诊时间</label>', '            <label for="zxPreferred">Preferred Consultation Time</label>'],
  ['          <input type="text" id="zxPreferred" placeholder="如：工作日下午、周末上午，或具体日期时段" />', '          <input type="text" id="zxPreferred" placeholder="For example: weekday afternoons, weekend mornings, or a specific date and time window" />'],
  ['          <label for="zxSymptoms">病情背景 / 会诊目的</label>', '          <label for="zxSymptoms">Medical Background / Consultation Goal</label>'],
  ['          <textarea id="zxSymptoms" rows="4" placeholder="请简要描述既往检查、用药记录、核心诉求或希望获得第二医学意见的问题…"></textarea>', '          <textarea id="zxSymptoms" rows="4" placeholder="Briefly describe past tests, medications, key concerns, or the question you want a second medical opinion on..."></textarea>'],
  ['          提交评估申请', '          Submit Assessment Request'],
  ['        <p class="zx-form-note">🔒 加密资料提交 · 医学隐私严格保护 · 我们将在24小时内与您联系确认</p>', '        <p class="zx-form-note">🔒 Encrypted submission · Medical privacy protected · We will contact you within 24 hours to confirm next steps</p>'],
  ['        <h3>评估申请已提交！</h3>', '        <h3>Your assessment request has been submitted.</h3>'],
  ['        <p>感谢您的信任，资深顾问将在<strong>24小时内</strong>通过您提供的联系方式与您确认资料准备与会诊时间窗口。</p>', '        <p>Thank you for your trust. A senior consultant will reach out within <strong>24 hours</strong> using your preferred contact method to confirm preparation details and scheduling.</p>'],
  ['        <a href="https://wa.me/6589427926" target="_blank" rel="noopener noreferrer" class="zxs-wa-btn">WhatsApp 预约专员</a>', '        <a href="https://wa.me/6589427926" target="_blank" rel="noopener noreferrer" class="zxs-wa-btn">WhatsApp Booking Specialist</a>'],
  ["    alert('请填写姓名、联系方式及会诊方向');", "    alert('Please fill in your name, contact details and consultation focus.');"],
]);

patchFile('en/ovarian-rejuvenation.html', [
  ['    <div class="svc-hero-tag">女性专属 · 卵巢年轻化</div>', '    <div class="svc-hero-tag">Women\'s Health · Ovarian Rejuvenation</div>'],
  ['    <h1 class="svc-hero-title">干细胞卵巢年轻化<br /><span style="font-size:.6em;font-weight:300;opacity:.8">重启卵巢生命力，从源头守护女性健康</span></h1>', '    <h1 class="svc-hero-title">Stem Cell Ovarian Rejuvenation<br /><span style="font-size:.6em;font-weight:300;opacity:.8">Restore ovarian vitality and support long-term hormonal health</span></h1>'],
  ['    <p class="svc-hero-desc">卵巢是女性青春与健康的核心器官。当卵巢功能衰退，皮肤、情绪、生育力、骨骼与心血管健康将全面受累。干细胞卵巢年轻化疗法，通过靶向修复卵巢组织，从根本上重启生命活力。</p>', '    <p class="svc-hero-desc">The ovaries sit at the centre of fertility, hormones and whole-body vitality. When ovarian function declines, skin quality, mood, bone health and cardiovascular resilience all suffer. Stem cell ovarian rejuvenation focuses on repairing ovarian tissue and supporting hormone recovery at the source.</p>'],
  ['      <a href="/en/#contact" class="svc-hero-cta">预约适应性评估 →</a>', '      <a href="/en/#contact" class="svc-hero-cta">Book a suitability assessment →</a>'],
  ['  <a href="/en/">首页</a><span class="breadcrumb-sep">›</span>', '  <a href="/en/">Home</a><span class="breadcrumb-sep">›</span>'],
  ['  <span>干细胞卵巢年轻化</span>', '  <span>Stem Cell Ovarian Rejuvenation</span>'],
  ['    <div class="cs-item"><div class="cs-num">2.5–3亿</div><div class="cs-label">单次干细胞回输量<br>国际常规的3–5倍</div></div>', '    <div class="cs-item"><div class="cs-num">250–300M</div><div class="cs-label">Stem cells per infusion<br>3–5x typical international dosing</div></div>'],
  ['    <div class="cs-item"><div class="cs-num">≤3代</div><div class="cs-label">细胞培养代次上限<br>最大化修复活性</div></div>', '    <div class="cs-item"><div class="cs-num">≤3 Passages</div><div class="cs-label">Low-passage culture ceiling<br>to preserve cellular activity</div></div>'],
  ['    <div class="cs-item"><div class="cs-num">0小时</div><div class="cs-label">院内鲜活即时回输<br>无冷冻损耗</div></div>', '    <div class="cs-item"><div class="cs-num">0-Hour</div><div class="cs-label">Fresh same-day infusion onsite<br>with no freezing loss</div></div>'],
  ['    <div class="cs-item"><div class="cs-num">3项</div><div class="cs-label">厚生劳动省+PMDA<br>全流程合法认证</div></div>', '    <div class="cs-item"><div class="cs-num">3 Certifications</div><div class="cs-label">MHLW + PMDA compliant<br>across the full treatment flow</div></div>'],
  ['        <p class="intro-lead">卵巢是女性体内雌激素与孕激素的主要来源。一旦卵巢功能开始衰退，影响的绝不仅仅是生育力——皮肤、骨骼、心血管、情绪、睡眠，每一个系统都会受到波及。</p>', '        <p class="intro-lead">The ovaries are the primary source of estrogen and progesterone. Once function starts to decline, the impact reaches far beyond fertility, affecting skin quality, bone density, cardiovascular health, mood and sleep.</p>'],
  ['        <p class="intro-text">卵巢早衰（POI）指40岁以前卵巢功能减退，在女性人群中发病率约为1–3%。更广泛的卵巢功能下降则从35岁前后便悄然开始。传统激素替代疗法只能暂时补充，而干细胞疗法通过修复卵巢组织本身，激活自体激素分泌能力。</p>', '        <p class="intro-text">Premature ovarian insufficiency (POI) refers to ovarian decline before age 40 and affects roughly 1–3% of women. Broader ovarian aging often begins quietly around age 35. Traditional hormone replacement can temporarily supplement hormones, while stem cell therapy aims to repair ovarian tissue itself and support endogenous hormone production.</p>'],
  ['          <h4>🌸 樱医干细胞卵巢疗法优势</h4>', '          <h4>🌸 Why our ovarian rejuvenation programme stands out</h4>'],
  ['          <p>日本最大规模干细胞培养科研中心之一，核心团队源自东京大学。独家掌握干细胞年轻化、颗粒式培养等专利技术，配合"1:1手工精养"与二次洗净技术，确保每一个回输细胞处于最佳状态。</p>', '          <p>Our partner institutions work with one of Japan\'s largest stem cell culture research centres, with core expertise linked to the University of Tokyo. Proprietary rejuvenation, granule-culture and double-wash processes help keep every infusion at peak viability.</p>'],
  ['          <div class="stat-box"><div class="stat-box-num">AMH↑</div><div class="stat-box-label">卵巢储备指标改善</div></div>', '          <div class="stat-box"><div class="stat-box-num">AMH ↑</div><div class="stat-box-label">Improved ovarian reserve markers</div></div>'],
  ['          <div class="stat-box"><div class="stat-box-num">自然排卵</div><div class="stat-box-label">部分患者恢复自然排卵</div></div>', '          <div class="stat-box"><div class="stat-box-num">Ovulation</div><div class="stat-box-label">Some patients regain natural ovulation</div></div>'],
  ['<p>月经周期不规律、经量异常减少或提前闭经</p>', '<p>Irregular cycles, very light flow or periods stopping earlier than expected</p>'],
  ['<p>抗苗勒管激素检测值低，卵巢储备功能不足</p>', '<p>Low AMH results suggesting diminished ovarian reserve</p>'],
  ['<p>试管婴儿失败、自然受孕困难，与卵巢功能相关</p>', '<p>Difficulty conceiving naturally or repeated IVF setbacks linked to ovarian function</p>'],
  ['<p>潮热盗汗、情绪波动、睡眠障碍在40岁前出现</p>', '<p>Hot flashes, night sweats, mood swings or sleep disruption before age 40</p>'],
  ['<p>癌症治疗后卵巢功能受损，激素水平异常</p>', '<p>Ovarian damage and hormone disruption after chemotherapy or other cancer treatment</p>'],
  ['<p>长期精力不足、记忆力下降与激素紊乱相关</p>', '<p>Persistent fatigue and reduced concentration associated with hormone imbalance</p>'],
  ['<p>雌激素减少导致骨质流失加速，骨质疏松风险升高</p>', '<p>Falling estrogen levels accelerating bone loss and osteoporosis risk</p>'],
  ['<p>皮肤干燥、弹性下降、暗沉加重，雌激素不足所致</p>', '<p>Dryness, reduced elasticity and dull skin linked to estrogen decline</p>'],
  ['<p>核心技术团队源自东京大学医学部，专注女性生殖内分泌干细胞研究，技术积累超过10年，在卵巢修复领域处于全球前沿。</p>', '<p>Core scientific leadership traces back to the University of Tokyo and focuses on women\'s reproductive endocrinology, with more than a decade of experience in ovarian repair.</p>'],
  ['<p>独家掌握干细胞颗粒式培养专利技术，结合"1:1手工精养"工艺，每一批细胞均经过严格质检，确保最优状态回输。</p>', '<p>Patented granule-culture methods and intensive low-passage handling help each batch pass strict quality checks before infusion.</p>'],
  ['<p>回输前经专利二次洗净工艺去除培养液残留，提高细胞在体内的存活率与向卵巢组织的靶向迁移效率。</p>', '<p>A proprietary double-wash process removes residual medium before infusion, improving in-body survival and targeted ovarian migration.</p>'],
  ['<p>干细胞采集、培养与回输全程在同一认证机构内完成，无需冷冻运输，细胞活性损耗降至最低。</p>', '<p>Collection, culture and infusion all happen inside the same certified institution, avoiding frozen transport and minimizing activity loss.</p>'],
  ['<p>单次回输2.5–3亿高活性干细胞，是国际常规方案的3–5倍，确保足够数量细胞到达卵巢靶向组织发挥修复作用。</p>', '<p>Each session delivers 250–300 million high-activity cells, roughly 3–5 times common international dosing, to improve the chance of meaningful ovarian repair.</p>'],
  ['<p>合作机构持有厚生劳动省"计划番号"及PMDA三项全流程合法资质，是日本政府对干细胞卵巢疗法安全性的最高级别背书。</p>', '<p>Partner institutions hold the required MHLW treatment plan numbers and PMDA-linked compliance approvals, providing a strong legal and safety foundation in Japan.</p>'],
  ['<p>卵巢激素分泌恢复规律性，月经周期逐渐正常化，经量改善，痛经减轻。</p>', '<p>Hormone secretion becomes more stable, cycles often normalize and menstrual symptoms may ease.</p>'],
  ['<p>AMH值回升，FSH水平趋于正常，卵巢储备功能改善，窦卵泡数量增加。</p>', '<p>AMH may improve, FSH may move closer to range and ovarian reserve indicators can show recovery.</p>'],
  ['<p>雌激素、孕激素水平趋于正常，更年期相关症状（潮热、盗汗、情绪波动）显著缓解。</p>', '<p>Estrogen and progesterone balance may improve, easing hot flashes, night sweats and mood fluctuation.</p>'],
  ['<p>雌激素水平提升带动皮肤弹性恢复，干燥、暗沉减轻，整体肤质年轻化。</p>', '<p>Healthier estrogen support can improve skin elasticity, dryness and overall radiance.</p>'],
  ['<p>激素平衡改善带动睡眠质量提升、白天精力恢复，疲劳感减轻，工作生活状态改善。</p>', '<p>Better hormone balance often supports sleep quality, energy recovery and less day-to-day fatigue.</p>'],
  ['<p>部分卵巢早衰患者在治疗后恢复自然排卵，为备孕困难的女性提供新的可能性。</p>', '<p>Some patients with ovarian insufficiency recover natural ovulation, opening new fertility possibilities after specialist review.</p>'],
  ['<div class="faq-a">对于因卵巢功能衰退或卵巢早衰导致的排卵障碍，干细胞卵巢年轻化疗法有可能改善卵泡发育和卵巢储备功能。部分案例在治疗后出现AMH值上升、月经恢复规律等积极变化。但效果因个体情况差异较大，且目前仍属于再生医疗前沿领域，无法保证每位患者均能成功怀孕。我们建议在专科医生评估后综合判断。</div>', '<div class="faq-a">For ovulation disorders linked to ovarian decline or premature ovarian insufficiency, stem cell ovarian rejuvenation may help support follicle development and ovarian reserve. Some cases report improved AMH and more regular cycles after treatment, but outcomes vary widely and pregnancy can never be guaranteed. A specialist assessment remains essential.</div>'],
  ['<div class="faq-a">通常采集您自身的脂肪来源间充质干细胞（AD-MSC）。采集过程类似小范围脂肪抽取，在局麻下进行，约30分钟完成，创伤极小，无需全麻。采集后送入Class100无菌实验室培养扩增至约2.5–3亿个，再以最鲜活的状态回输体内，全程不冷冻保存，最大程度保留细胞活性。</div>', '<div class="faq-a">Most programmes use your own adipose-derived mesenchymal stem cells (AD-MSCs). Collection is similar to a small-volume fat harvest under local anaesthesia, usually taking around 30 minutes. Cells are expanded in a Class 100 clean-room environment to roughly 250–300 million before being infused fresh without freezing.</div>'],
  ['<div class="faq-a">基础疗程为2–3次回输，每次间隔1–2个月。由于使用鲜活细胞，每次治疗均需亲赴日本，每次停留约2–3天。治疗结束后，后续复查和激素指标监测可通过远程方式进行，樱医顾问团队将持续协助跟进。</div>', '<div class="faq-a">A standard programme usually involves 2–3 infusions spaced 1–2 months apart. Because the treatment uses fresh cells, travel to Japan is generally required for each session, with a typical stay of 2–3 days. Follow-up reviews and hormone monitoring can often continue remotely afterwards.</div>'],
  ['<div class="faq-a">即便卵巢功能已经明显下降，干细胞疗法仍有可能帮助改善激素分泌和更年期相关症状（如潮热、失眠、情绪波动等）。疗效与剩余卵巢功能、治疗及时性及个体体质有关。我们建议先进行卵巢功能评估（AMH、AFC等指标），再由日本专科医生判断最合适的介入时机和方案。</div>', '<div class="faq-a">Even when ovarian function has already declined significantly, stem cell therapy may still help improve hormone output and menopause-related symptoms such as hot flashes, insomnia and mood swings. Results depend on remaining ovarian reserve, timing and individual response, so AMH/AFC review and specialist judgement come first.</div>'],
]);

patchFile('en/stem-cell-anti-aging.html', [
  ['    <div class="svc-hero-tag">日本厚生劳动省认证 · 自体干细胞</div>', '    <div class="svc-hero-tag">Japan MHLW-Compliant Care · Autologous Stem Cells</div>'],
  ['    <h1 class="svc-hero-title">干细胞抗衰老<br /><span style="font-size:.6em;font-weight:300;opacity:.8">衰老从细胞开始，逆龄也从细胞出发</span></h1>', '    <h1 class="svc-hero-title">Stem Cell Anti-Ageing<br /><span style="font-size:.6em;font-weight:300;opacity:.8">Ageing begins in the cells, and so does rejuvenation</span></h1>'],
  ['    <p class="svc-hero-desc">传统抗衰手段作用于皮肤表面，而干细胞疗法直达根源——修复受损老化细胞，激活沉睡的再生机制，实现皮肤、体能、内脏与激素的全面年轻化。</p>', '    <p class="svc-hero-desc">Traditional anti-ageing methods mainly target the skin surface. Stem cell therapy works deeper, aiming to repair ageing cells, reactivate regenerative signalling and support visible, energetic and metabolic rejuvenation across the whole body.</p>'],
  ['      <a href="/en/#contact" class="svc-hero-cta">预约适应性评估 →</a>', '      <a href="/en/#contact" class="svc-hero-cta">Book a suitability assessment →</a>'],
  ['      <a href="#process" style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.3);color:white;padding:13px 28px;border-radius:100px;font-size:.95rem;font-weight:500;transition:all .3s" onmouseover="this.style.background=\'rgba(255,255,255,.18)\'" onmouseout="this.style.background=\'rgba(255,255,255,.1)\'">了解疗程流程</a>', '      <a href="#process" style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.3);color:white;padding:13px 28px;border-radius:100px;font-size:.95rem;font-weight:500;transition:all .3s" onmouseover="this.style.background=\'rgba(255,255,255,.18)\'" onmouseout="this.style.background=\'rgba(255,255,255,.1)\'">See the treatment journey</a>'],
  ['  <a href="/en/">首页</a><span class="breadcrumb-sep">›</span>', '  <a href="/en/">Home</a><span class="breadcrumb-sep">›</span>'],
  ['  <span>干细胞抗衰老</span>', '  <span>Stem Cell Anti-Ageing</span>'],
  ['      <div class="cs-num">2.5–3亿</div>', '      <div class="cs-num">250–300M</div>'],
  ['      <div class="cs-unit">细胞/次</div>', '      <div class="cs-unit">cells / session</div>'],
  ['      <div class="cs-label">单次回输量<br>（国际标准的3–5倍）</div>', '      <div class="cs-label">Dose per infusion<br>(3–5x common international practice)</div>'],
  ['      <div class="cs-unit">传代上限</div>', '      <div class="cs-unit">culture cap</div>'],
  ['      <div class="cs-label">严格控制细胞活性<br>（国际普遍6–8代）</div>', '      <div class="cs-label">Low-passage handling for cell vitality<br>(often 6–8 passages elsewhere)</div>'],
  ['      <div class="cs-num">0小时</div>', '      <div class="cs-num">0-Hour</div>'],
  ['      <div class="cs-unit">新鲜回输</div>', '      <div class="cs-unit">fresh infusion</div>'],
  ['      <div class="cs-label">创新无冷冻运输技术<br>最大化细胞存活率</div>', '      <div class="cs-label">No frozen transport<br>to maximize cell viability</div>'],
  ['      <div class="cs-unit">持续效果</div>', '      <div class="cs-unit">lasting effect</div>'],
  ['      <div class="cs-label">体内细胞持续增殖<br>非一次性短效刺激</div>', '      <div class="cs-label">Cell activity continues over time<br>not a one-off superficial boost</div>'],
  ['        <p class="intro-lead">无论多昂贵的护肤品、多先进的医美项目，作用都停留在皮肤表层。真正的衰老，源于细胞修复能力的下降、干细胞数量的减少、代谢效率的失衡。</p>', '        <p class="intro-lead">Even expensive skincare and advanced aesthetic procedures mainly work at the surface. True ageing is driven by weaker cellular repair, declining stem cell reserves and less efficient metabolism.</p>'],
  ['        <p class="intro-text">人体约有37万亿个细胞，每天都有细胞死亡与再生。25岁后，干细胞数量以每年约1%的速度持续减少，这正是体能下滑、皮肤松弛、免疫力减弱的根本原因。</p>', '        <p class="intro-text">The body contains roughly 37 trillion cells, constantly renewing every day. After age 25, stem cell reserves can decline by around 1% each year, contributing to lower energy, skin laxity and reduced immune resilience.</p>'],
  ['        <p class="intro-text" style="margin-top:12px">干细胞抗衰老疗法通过向体内补充大量高活性自体干细胞，直接重启细胞修复程序，从源头逆转衰老进程。</p>', '        <p class="intro-text" style="margin-top:12px">Stem cell anti-ageing therapy introduces a large volume of high-activity autologous cells, aiming to restart repair pathways and address ageing at the cellular level.</p>'],
  ['          <h4>细胞层面的深度修复</h4>', '          <h4>Deep repair at the cellular level</h4>'],
  ['          <p>自体干细胞 · 无排斥 · 全身系统改善</p>', '          <p>Autologous stem cells · No rejection risk · Whole-body support</p>'],
  ['        <h4>细胞老化</h4>', '        <h4>Cellular ageing</h4>'],
  ['        <p>细胞端粒缩短、线粒体功能下降，导致能量代谢效率降低，全身组织修复速度减慢</p>', '        <p>Telomere shortening and weaker mitochondrial function reduce energy metabolism and slow tissue repair throughout the body.</p>'],
  ['        <h4>干细胞减少</h4>', '        <h4>Stem cell decline</h4>'],
  ['        <p>25岁后干细胞数量年均减少约1%，40岁时仅剩年轻时的30%，身体自愈能力大幅下滑</p>', '        <p>Stem cell reserves can fall by about 1% per year after 25, leaving far fewer regenerative cells by midlife.</p>'],
  ['        <h4>代谢失衡</h4>', '        <h4>Metabolic imbalance</h4>'],
  ['        <p>激素分泌紊乱、慢性轻度炎症积累、氧化应激加剧，共同加速全身系统的老化进程</p>', '        <p>Hormonal disruption, chronic low-grade inflammation and oxidative stress together accelerate whole-body ageing.</p>'],
  ['        <p>不作用于皮肤表面，而是深入修复受损老化的细胞，激活体内沉睡的年轻因子，从生命最基础的单位开始逆转衰老。</p>', '        <p>Rather than only treating the skin surface, the therapy aims to repair ageing cells and reactivate dormant regenerative signalling from the body\'s most basic building blocks.</p>'],
  ['        <p>一次疗程同步改善皮肤紧致度、睡眠质量、体力精力、免疫功能与激素平衡，非单一局部作用，而是整体生命状态的提升。</p>', '        <p>A single programme is designed to support skin firmness, sleep, energy, immunity and hormone balance together, not just one isolated area.</p>'],
  ['        <p>干细胞在体内持续增殖分化，效果随时间逐步深化。与注射玻尿酸、肉毒素等一次性短效项目截然不同，改善效果可持续5年以上。</p>', '        <p>Stem cells can continue differentiating after infusion, so results may deepen over time. This is fundamentally different from short-lived filler or toxin-based procedures.</p>'],
  ['        <p>多疗程治疗具有叠加效果，每次回输都在前一次基础上继续深化改善，身体年轻化状态逐步巩固提升，越治越好。</p>', '        <p>Multi-session programmes can build on earlier gains, helping consolidate and deepen improvement over time.</p>'],
  ['        <p>30岁轻熟龄预防性抗衰，40–50岁全面逆龄修复，50岁以上内脏功能提升延缓老年病，不同年龄阶段均有针对性方案。</p>', '        <p>Programmes can be tailored for early prevention in the 30s, deeper recovery in the 40s–50s, and broader resilience support later in life.</p>'],
  ['        <p>取自患者本人脂肪组织，与自身完全相容，无任何免疫排斥反应风险。日本厚生劳动省与PMDA全程合法认证，安全有保障。</p>', '        <p>Cells are harvested from the patient\'s own tissue, so compatibility is high and immune rejection risk is minimized. Treatment is arranged through compliant Japanese institutions.</p>'],
  ['        <div class="tech-badge">学术背书</div>', '        <div class="tech-badge">Research backing</div>'],
  ['        <p>与东京大学、庆应义塾大学医学部及多家国立研究机构深度合作，全流程技术自主掌控，非简单外包生产。</p>', '        <p>Our partners work with teams connected to the University of Tokyo, Keio and other national research institutions, with close control over the full technical workflow.</p>'],
  ['        <div class="tech-badge">细胞质量</div>', '        <div class="tech-badge">Cell quality</div>'],
  ['        <p>培养代次严格控制在3代以内，采用完全无血清培养基，彻底消除动物源性污染风险。</p>', '        <p>Cell passage is tightly controlled at three or fewer rounds, with serum-free media used to reduce contamination risk.</p>'],
  ['          <span class="tech-h-num">≤3代</span>', '          <span class="tech-h-num">≤3 passages</span>'],
  ['          <span class="tech-h-label">vs 国际普遍 6–8代</span>', '          <span class="tech-h-label">vs. 6–8 passages elsewhere</span>'],
  ['        <div class="tech-badge">创新技术</div>', '        <div class="tech-badge">Fresh-cell logistics</div>'],
  ['        <p>独创无冷冻常温运输技术，干细胞从培养到回输全程保持鲜活状态，存活率与分化能力大幅优于冷冻保存方案。</p>', '        <p>Fresh-cell handling avoids frozen transport so cells remain highly viable from culture through infusion.</p>'],
  ['        <div class="tech-badge">数量优势</div>', '        <div class="tech-badge">Dose advantage</div>'],
  ['        <p>单次回输2.5–3亿高活性干细胞，是国际常规方案的3–5倍，确保足够数量的细胞抵达全身各靶向组织。</p>', '        <p>Each session delivers 250–300 million high-activity cells, about 3–5 times common international practice, to support meaningful whole-body coverage.</p>'],
  ['          <span class="tech-h-num">3亿</span>', '          <span class="tech-h-num">300M</span>'],
  ['          <span class="tech-h-label">vs 国际常规 5000万–1亿</span>', '          <span class="tech-h-label">vs. 50M–100M commonly elsewhere</span>'],
  ['        <div class="tech-badge">给药方案</div>', '        <div class="tech-badge">Delivery design</div>'],
  ['        <p>静脉全身回输 + 皮肤靶向注射 + 辅助营养支持三种途径联合，覆盖全身系统改善与局部精准治疗双重效果。</p>', '        <p>Combined delivery can include systemic infusion, targeted local support and adjunctive nutrition planning for both broad and focused results.</p>'],
  ['        <div class="tech-badge">法规认证</div>', '        <div class="tech-badge">Regulatory path</div>'],
  ['        <p>所有合作机构持有厚生劳动省颁发的"计划番号"，并通过PMDA多项审批，是日本政府对安全性与合法性的最高背书。</p>', '        <p>All partner institutions operate under the required MHLW treatment plan framework and PMDA-linked compliance checks.</p>'],
  ['      <h3 style="font-family:\'Noto Serif SC\',serif;color:white;font-size:1.1rem;margin-bottom:28px;text-align:center">樱医标准 vs 国际常规对比</h3>', '      <h3 style="font-family:\'Noto Serif SC\',serif;color:white;font-size:1.1rem;margin-bottom:28px;text-align:center">Our treatment standard vs. common international practice</h3>'],
  ['            <span class="cb-label" style="color:white">单次细胞回输量</span>', '            <span class="cb-label" style="color:white">Cells delivered per session</span>'],
  ['            <div class="cb-vals"><span class="cb-jp">樱医：2.5–3亿</span><span>国际：5000万–1亿</span></div>', '            <div class="cb-vals"><span class="cb-jp">Ours: 250–300M</span><span>Common: 50–100M</span></div>'],
  ['            <span class="cb-label" style="color:white">细胞活性（低代次更佳）</span>', '            <span class="cb-label" style="color:white">Cell vitality (lower passages are better)</span>'],
  ['            <div class="cb-vals"><span class="cb-jp">樱医：≤3代</span><span>国际：6–8代</span></div>', '            <div class="cb-vals"><span class="cb-jp">Ours: ≤3 passages</span><span>Common: 6–8 passages</span></div>'],
  ['            <span class="cb-label" style="color:white">鲜活度（无冷冻技术）</span>', '            <span class="cb-label" style="color:white">Freshness (no frozen transport)</span>'],
  ['            <div class="cb-vals"><span class="cb-jp">樱医：100% 新鲜</span><span>国际：冷冻保存</span></div>', '            <div class="cb-vals"><span class="cb-jp">Ours: fresh-cell handling</span><span>Common: frozen storage</span></div>'],
  ['        <p>樱医专属顾问收集完整健康档案，与日本医生进行初诊评估，确认适应性</p>', '        <p>A dedicated care consultant gathers your health profile and coordinates an initial review with a Japanese doctor.</p>'],
  ['        <p>在认证医院由专科医生采用微创技术提取少量自体脂肪组织，过程安全无痛</p>', '        <p>A specialist at a certified hospital performs a minimally invasive collection of a small amount of your own adipose tissue.</p>'],
  ['        <p>在Class100无菌洁净室中分离、扩增干细胞，严格保持≤3代培养质量标准</p>', '        <p>Cells are isolated and expanded in a Class 100 sterile lab while maintaining low-passage quality standards.</p>'],
  ['        <p>静脉全身回输 + 皮肤靶向注射双通道给药，2.5–3亿鲜活干细胞精准到达全身</p>', '        <p>Fresh cells are delivered through a systemic infusion plan with targeted support according to the treatment design.</p>'],
  ['        <p>治疗后定期追踪各项指标变化，樱医中文团队持续陪伴，优化长期效果</p>', '        <p>After treatment, the team tracks key indicators and follows up regularly to support long-term outcomes.</p>'],
  ['          <p>面部轮廓明显提升，细纹淡化，皮肤弹性恢复，暗沉改善，毛孔缩小。客户平均反馈看起来年轻3–7岁。</p>', '          <p>Clients commonly report improved contour definition, softer fine lines, better elasticity and a more rested complexion.</p>'],
  ['          <p>入睡更快、深睡时间延长、早晨起床精神饱满。睡眠改善通常是客户最早感受到的变化之一。</p>', '          <p>Falling asleep more easily, deeper sleep and better morning energy are often among the earliest improvements reported.</p>'],
  ['          <p>白天精神状态明显改善，运动耐力提升，疲劳感减轻，工作效率和专注力显著回升。</p>', '          <p>Many patients feel stronger daytime energy, better exercise tolerance and a lighter overall fatigue burden.</p>'],
  ['          <p>感冒频率降低，病后恢复更快，慢性轻度炎症指标改善，整体抗病能力显著提升。</p>', '          <p>People often notice better resilience, quicker recovery after illness and improved inflammatory balance.</p>'],
  ['          <p>更年期症状缓解，情绪波动减少，内分泌系统趋于平衡，女性客户尤其反馈改善明显。</p>', '          <p>Hormonal symptoms can become more stable, with less mood fluctuation and broader endocrine support.</p>'],
  ['          <p>肝功能、肾功能、心血管弹性指标改善，血管内皮细胞修复，预防慢性病发生风险降低。</p>', '          <p>Programmes may support healthier cardiometabolic and organ-function markers as part of a broader rejuvenation plan.</p>'],
  ['          <p>思维清晰度提高，记忆力改善，大脑衰老进程减缓，对预防认知功能退化有积极作用。</p>', '          <p>Some clients describe clearer thinking, improved memory and better mental stamina over time.</p>'],
  ['          <p>基础代谢率提升，体重管理更容易，血糖、血脂指标趋于正常化，代谢综合征风险降低。</p>', '          <p>Metabolic efficiency may improve, supporting weight management and healthier glucose and lipid trends.</p>'],
  ['        <p>提前布局，在衰老症状明显出现前补充干细胞，延缓老化进程，保持长期竞争力</p>', '        <p>Ideal for people in their 30s or early 40s who want to invest early in resilience before ageing signs become obvious.</p>'],
  ['        <p>感受到体能、皮肤、精力明显下滑，希望从细胞层面进行系统性修复与提升</p>', '        <p>Suitable for those who already feel meaningful declines in energy, skin quality or recovery and want a more systemic approach.</p>'],
  ['        <p>激素变化导致的皮肤萎缩、情绪波动、睡眠障碍，通过干细胞疗法从根源改善内分泌</p>', '        <p>Women navigating menopause-related skin, mood or sleep changes may benefit from coordinated endocrine-support planning.</p>'],
  ['        <p>长期高强度工作导致的提前衰老、亚健康积累，需要系统性修复与能量补给</p>', '        <p>High-stress professionals seeking structured recovery, energy support and long-term performance maintenance may also be a fit.</p>'],
  ['      <p class="section-sub">科学抗衰，从了解开始</p>', '      <p class="section-sub">Start with a clear view of how the therapy works, who it suits and what to expect.</p>'],
  ['        <div class="faq-a">标准疗程为3次回输，每次间隔约1个月。多数客户在第2次疗程后开始明显感受到精力改善和皮肤状态提升。完成三次标准疗程后，年轻化效果通常可持续3–5年。此后建议每年进行1–2次维护疗程，以保持最佳状态。</div>', '        <div class="faq-a">A standard programme often includes three infusions spaced about one month apart. Many clients report meaningful energy and skin changes after the second session. After a full programme, benefits may continue for years, with maintenance planned case by case.</div>'],
  ['        <div class="faq-a">我们使用自体干细胞，即从您本人体内采集（通常为脂肪组织或骨髓），经体外扩增培养后回输，完全不存在免疫排斥风险。这是日本合法再生医疗最主流的方式，安全性经过厚生劳动省严格审查。</div>', '        <div class="faq-a">The therapy typically uses autologous stem cells collected from your own body, often adipose tissue. Because the cells are your own, immune rejection risk is minimized. Treatment is coordinated through compliant Japanese regenerative medicine pathways.</div>'],
  ['        <div class="faq-a">不需要。细胞回输通过静脉注射进行，过程约30–60分钟，与普通输液相似。回输后可能有轻微疲乏感，通常次日即可恢复正常活动。每次来日本接受治疗只需停留约2–3天，不会对正常生活造成重大影响。</div>', '        <div class="faq-a">Most patients do not need major downtime. Infusion generally takes about 30–60 minutes and feels similar to an IV session. Mild fatigue can happen afterwards, but normal activity often resumes quickly. Each treatment trip to Japan is usually short.</div>'],
  ['        <div class="faq-a">建议35岁以上开始考虑，此时自身干细胞活性开始下降，是补充的最佳时机。40–65岁是最主要的受益人群。年龄越大，体内干细胞储备越少，治疗前评估也越重要。我们会根据您的实际细胞活性指标制定最适合的疗程方案。</div>', '        <div class="faq-a">Many people begin considering the therapy from their mid-30s onward, when natural stem cell activity starts to decline. The best timing depends on your baseline health, goals and current cellular reserve, so assessment comes first.</div>'],
]);
