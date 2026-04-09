const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SHARED_CATALOG_PATH = path.join(__dirname, '..', '..', 'wellness-data.js');

const FALLBACK_PRODUCTS = [
  { id: 1, cat: 'nmn', brand: 'AFC Japan', name: 'NMN 9000 Ultra 超高纯度', spec: '60粒 · 60日量', price: 29570 },
  { id: 2, cat: 'nmn', brand: 'Mirai Lab', name: 'Pure NMN 12000 高纯胶囊', spec: '60粒 · 60日量', price: 38810 },
  { id: 3, cat: 'nmn', brand: 'MitoGen', name: 'NMN Plus 复合抗衰配方', spec: '60粒 · 60日量', price: 22640 },
  { id: 4, cat: 'nmn', brand: 'Cosmo Health', name: 'NMN 3000 入门纯粹版', spec: '60粒 · 60日量', price: 15710 },
  { id: 5, cat: 'men', brand: 'DHC', name: '玛卡锌精力配方', spec: '30粒 · 30日量', price: 6880 },
  { id: 6, cat: 'men', brand: '三得利 Suntory', name: '芝麻明E + DHA 男性活力', spec: '90粒 · 30日量', price: 8270 },
  { id: 7, cat: 'men', brand: 'Fancl', name: '男性综合营养包 30岁+', spec: '30包 · 30日量', price: 9890 },
  { id: 8, cat: 'men', brand: 'Sato Pharmaceutical', name: '男性活力睡眠综合配方', spec: '60粒 · 30日量', price: 7810 },
  { id: 9, cat: 'women', brand: 'Asahi', name: '胶原蛋白粉 天然柚子味', spec: '225g · 30日量', price: 4570 },
  { id: 10, cat: 'women', brand: 'DHC', name: '胶原蛋白片 黄金配比', spec: '120粒 · 60日量', price: 3880 },
  { id: 11, cat: 'women', brand: 'Fancl', name: '抗糖化胶囊 活化肌底', spec: '30粒 · 30日量', price: 8960 },
  { id: 12, cat: 'women', brand: 'Meiji', name: '胶原蛋白饮料 弹肌版', spec: '10瓶装', price: 5730 },
  { id: 13, cat: 'women', brand: 'Eisai', name: '女性铁元素综合营养', spec: '60粒 · 30日量', price: 5270 },
  { id: 14, cat: 'gut', brand: 'Yakult', name: '益力多 1000 强效乳酸菌', spec: '7瓶装', price: 3880 },
  { id: 15, cat: 'gut', brand: 'Asahi', name: '万田酵素 Plus 综合酵素', spec: '180粒 · 30日量', price: 6880 },
  { id: 16, cat: 'gut', brand: 'DHC', name: '膳食纤维 速溶颗粒', spec: '30包 · 30日量', price: 3190 },
  { id: 17, cat: 'gut', brand: 'Morinaga', name: '比菲德氏菌 益生菌套装', spec: '60粒 · 30日量', price: 5040 },
  { id: 18, cat: 'immune', brand: 'DHC', name: '维生素C缓释 高浓度', spec: '120粒 · 60日量', price: 2960 },
  { id: 19, cat: 'immune', brand: 'Fancl', name: '辅酶Q10 护心活力', spec: '60粒 · 30日量', price: 6880 },
  { id: 20, cat: 'immune', brand: '大塚制药 Otsuka', name: 'DENY 综合维生素矿物质', spec: '30日量', price: 4340 },
  { id: 21, cat: 'immune', brand: 'Ribon', name: '维生素D3 + K2 骨质强化', spec: '60粒 · 60日量', price: 3880 },
  { id: 22, cat: 'icon', brand: '三得利 Suntory', name: '葡萄糖胺软骨素 关节守护', spec: '270粒 · 90日量', price: 7580 },
  { id: 23, cat: 'icon', brand: 'DHC', name: '深海鱼油 EPA+DHA 心血管', spec: '120粒 · 60日量', price: 3880 },
  { id: 24, cat: 'icon', brand: 'AFC Japan', name: '白芸豆阻糖 饭前必备', spec: '90粒 · 30日量', price: 5730 },
  { id: 25, cat: 'icon', brand: 'Fancl', name: '纳豆激酶 血液循环', spec: '30粒 · 30日量', price: 7350 },
];

function cloneList(items) {
  return items.map((item) => ({
    ...item,
    highlights: Array.isArray(item.highlights) ? item.highlights.slice() : item.highlights,
    hlEN: Array.isArray(item.hlEN) ? item.hlEN.slice() : item.hlEN,
    hlJA: Array.isArray(item.hlJA) ? item.hlJA.slice() : item.hlJA,
    hlKO: Array.isArray(item.hlKO) ? item.hlKO.slice() : item.hlKO,
    hlVI: Array.isArray(item.hlVI) ? item.hlVI.slice() : item.hlVI,
    images: Array.isArray(item.images) ? item.images.slice() : item.images,
  }));
}

function loadSharedCatalog() {
  try {
    const source = fs.readFileSync(SHARED_CATALOG_PATH, 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox, { filename: SHARED_CATALOG_PATH });
    if (Array.isArray(sandbox.window.DEFAULT_PRODUCTS_SH) && sandbox.window.DEFAULT_PRODUCTS_SH.length) {
      return cloneList(sandbox.window.DEFAULT_PRODUCTS_SH);
    }
  } catch (error) {
    // Fall through to the minimal catalog below.
  }

  return cloneList(FALLBACK_PRODUCTS);
}

const DEFAULT_PRODUCTS = loadSharedCatalog();

function getDefaultProducts() {
  return cloneList(DEFAULT_PRODUCTS);
}

function findCatalogProduct(productId) {
  return DEFAULT_PRODUCTS.find((item) => item.id === Number(productId)) || null;
}

module.exports = {
  getDefaultProducts,
  findCatalogProduct,
};
