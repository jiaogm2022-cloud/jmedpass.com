const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const sourcePath = path.join(rootDir, 'i18n.js');
const backupPath = path.join(rootDir, 'i18n.legacy.js');
const chunkDir = path.join(rootDir, 'i18n');
const enDir = path.join(rootDir, 'en');

function readLegacySource() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`);
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, source, 'utf8');
  }
  return source;
}

function loadLegacyData(source) {
  const noop = function () {};
  const sandbox = {
    console,
    window: {
      location: { pathname: '/en/' },
      addEventListener: noop,
      removeEventListener: noop,
    },
    document: {
      readyState: 'loading',
      addEventListener: noop,
      removeEventListener: noop,
      querySelectorAll: () => [],
      querySelector: () => null,
      body: { style: {} },
      documentElement: {
        lang: 'en',
        style: {},
        getAttribute: () => '',
        setAttribute: noop,
      },
    },
    localStorage: {
      getItem: () => '',
      setItem: noop,
      removeItem: noop,
    },
    setTimeout,
    clearTimeout,
  };

  sandbox.window.document = sandbox.document;
  vm.runInNewContext(source, sandbox, { filename: 'i18n.legacy.js' });

  return {
    I18N: sandbox.I18N,
    LANG_FONTS: sandbox.LANG_FONTS,
    PAGE_META: sandbox.PAGE_META,
  };
}

function buildLoaderSource(pageMeta, langFonts) {
  return `/* ===== JMEDPASS I18N LOADER ===== */
var PAGE_META = ${JSON.stringify(pageMeta, null, 2)};
var LANG_FONTS = ${JSON.stringify(langFonts, null, 2)};
var _currentLang = 'zh';
var _langCallbacks = [];
var _langPromises = {};
window.__I18N_CHUNKS__ = window.__I18N_CHUNKS__ || {};
var I18N = window.__I18N_CHUNKS__;

function getChunk(lang) {
  return (window.__I18N_CHUNKS__ && window.__I18N_CHUNKS__[lang]) || null;
}

function getChunkUrl(lang) {
  return '/i18n/' + lang + '.js?v=6';
}

function loadLangChunk(lang) {
  if (getChunk(lang)) return Promise.resolve(getChunk(lang));
  if (_langPromises[lang]) return _langPromises[lang];

  _langPromises[lang] = new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = getChunkUrl(lang);
    script.async = true;
    script.onload = function() {
      var dict = getChunk(lang);
      if (!dict) {
        reject(new Error('missing_lang_chunk:' + lang));
        return;
      }
      resolve(dict);
    };
    script.onerror = function() {
      reject(new Error('failed_lang_chunk:' + lang));
    };
    document.head.appendChild(script);
  });

  return _langPromises[lang];
}

function ensureLang(lang) {
  var queue = [loadLangChunk(lang)];
  if (lang !== 'zh') queue.push(loadLangChunk('zh'));
  return Promise.all(queue);
}

window.t = function(key) {
  var currentDict = getChunk(_currentLang) || {};
  var zhDict = getChunk('zh') || {};
  return currentDict[key] || zhDict[key] || key;
};

window.getLang = function() { return _currentLang; };
window.onLangChange = function(fn) { _langCallbacks.push(fn); };
window.applyLang = function(lang) {
  return ensureLang(lang).then(function() {
    var dict = getChunk(lang) || {};
    var zhDict = getChunk('zh') || {};
    _currentLang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) {
        el.textContent = dict[key];
      } else if (zhDict[key] !== undefined) {
        el.textContent = zhDict[key];
      }
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-html');
      if (dict[key] !== undefined) {
        el.innerHTML = dict[key];
      } else if (zhDict[key] !== undefined) {
        el.innerHTML = zhDict[key];
      }
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-ph');
      if (dict[key] !== undefined) {
        el.setAttribute('placeholder', dict[key]);
      } else if (zhDict[key] !== undefined) {
        el.setAttribute('placeholder', zhDict[key]);
      }
    });

    document.querySelectorAll('[data-i18n-opt]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-opt');
      if (dict[key] !== undefined) {
        el.textContent = dict[key];
      } else if (zhDict[key] !== undefined) {
        el.textContent = zhDict[key];
      }
    });

    var langMap = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko', vi: 'vi' };
    document.documentElement.lang = langMap[lang] || lang;
    if (document.body && LANG_FONTS[lang]) {
      document.body.style.fontFamily = LANG_FONTS[lang];
    }

    var pageId = document.documentElement.getAttribute('data-page');
    if (pageId && PAGE_META[pageId] && PAGE_META[pageId][lang]) {
      var meta = PAGE_META[pageId][lang];
      document.title = meta.t;
      var descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', meta.d);
      var ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', meta.t);
      var ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', meta.d);
      var twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', meta.t);
      var twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', meta.d);
    }

    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    try {
      localStorage.setItem('sm_lang', lang);
    } catch (error) {}

    _langCallbacks.forEach(function(fn) { fn(lang); });
  });
};

(function() {
  var pathLang = window.location.pathname.indexOf('/en/') === 0 || window.location.pathname === '/en' ? 'en' : '';
  var saved = pathLang || (function() {
    try {
      return localStorage.getItem('sm_lang');
    } catch (error) {
      return '';
    }
  })() || 'zh';

  function boot() {
    window.applyLang(saved).catch(function() {
      if (saved !== 'zh') {
        window.applyLang('zh').catch(function() {});
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.lang-btn');
    if (!btn) return;
    window.applyLang(btn.getAttribute('data-lang')).catch(function() {});
  });
})();
`;
}

function writeChunks(i18n, pageMeta, langFonts) {
  fs.mkdirSync(chunkDir, { recursive: true });

  Object.keys(i18n).forEach((lang) => {
    const chunkSource = `window.__I18N_CHUNKS__ = window.__I18N_CHUNKS__ || {};\nwindow.__I18N_CHUNKS__.${lang} = ${JSON.stringify(i18n[lang], null, 2)};\n`;
    fs.writeFileSync(path.join(chunkDir, `${lang}.js`), chunkSource, 'utf8');
  });

  fs.writeFileSync(sourcePath, buildLoaderSource(pageMeta, langFonts), 'utf8');
}

function replaceElementContent(html, attrName, dict) {
  const pattern = new RegExp(
    `<([a-zA-Z0-9:-]+)([^>]*${attrName}="([^"]+)"[^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'g'
  );

  return html.replace(pattern, (match, tag, attrs, key) => {
    if (dict[key] === undefined) return match;
    return `<${tag}${attrs}>${dict[key]}</${tag}>`;
  });
}

function replacePlaceholders(html, dict) {
  return html.replace(/data-i18n-ph="([^"]+)"/g, (match, key) => match).replace(
    /(<[^>]+data-i18n-ph="([^"]+)"[^>]*placeholder=")([^"]*)(")/g,
    (match, prefix, key, _old, suffix) => {
      if (dict[key] === undefined) return match;
      return `${prefix}${dict[key]}${suffix}`;
    }
  );
}

function patchEnglishHtml(filePath, dict, pageMeta) {
  let html = fs.readFileSync(filePath, 'utf8');
  const pageIdMatch = html.match(/<html[^>]*data-page="([^"]+)"/);
  const pageId = pageIdMatch ? pageIdMatch[1] : '';
  const meta = (pageMeta[pageId] && pageMeta[pageId].en) || null;

  html = html.replace(/href="\/en\/(shop|trust)\.css"/g, (_match, name) => `href="/${name}.css"`);
  html = html.replace(/class="lang-btn active" data-lang="zh"/g, 'class="lang-btn" data-lang="zh"');
  html = html.replace(/class="lang-btn" data-lang="en"/g, 'class="lang-btn active" data-lang="en"');
  html = html.replace(/>\s*中文\s*</g, '>中文<').replace(/>\s*EN\s*</g, '>EN<');

  html = replaceElementContent(html, 'data-i18n-html', dict);
  html = replaceElementContent(html, 'data-i18n', dict);
  html = replacePlaceholders(html, dict);

  html = html
    .replace(/日医通<em>JMEDPASS<\/em>/g, 'JMedPass<em>JAPAN MEDICAL CONCIERGE</em>')
    .replace(/日医通 \| JMEDPASS/g, 'JMedPass | Japan Medical Concierge');

  if (meta) {
    html = html.replace(/(<meta name="description" content=")[^"]*(" \/>)/, `$1${meta.d}$2`);
    html = html.replace(/(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${meta.d}$2`);
    html = html.replace(/(<meta name="twitter:description" content=")[^"]*(" \/>)/, `$1${meta.d}$2`);
    html = html.replace(/(<title>)[\\s\\S]*?(<\/title>)/, `$1${meta.t}$2`);
    html = html.replace(/(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${meta.t}$2`);
    html = html.replace(/(<meta name="twitter:title" content=")[^"]*(" \/>)/, `$1${meta.t}$2`);
    html = html.replace(/("description":\s*")([^"]*[一-龥][^"]*)(")/g, `$1${meta.d.replace(/"/g, '\\"')}$3`);
  }

  if (path.basename(filePath) === 'index.html') {
    html = html
      .replace(/"name": "日本医疗与养生服务"/, '"name": "Japan Medical & Wellness Services"')
      .replace(/"name": "日本医美整形"/, '"name": "Japan Aesthetic Surgery"')
      .replace(/"name": "日本精密体检"/, '"name": "Japan Precision Health Screening"')
      .replace(/"name": "日本再生医疗"/, '"name": "Japan Regenerative Medicine"')
      .replace(/"name": "日本免疫疗法"/, '"name": "Japan Immunotherapy"')
      .replace(/"name": "日本远程专家会诊"/, '"name": "Japan Remote Specialist Consultation"')
      .replace(/"name": "日本养生保健品商城"/, '"name": "Japan Wellness Product Concierge"')
      .replace(
        /"description": "专注日本高端医疗服务的跨国医疗机构，提供赴日医美整形、精密体检、干细胞再生医疗、免疫疗法、线上多语言问诊及日本正品保健品"/,
        '"description": "JMedPass is a Japan medical concierge service connecting international clients with aesthetic surgery, precision screening, regenerative medicine, immunotherapy, remote consultations and premium wellness products."'
      );
  }

  if (path.basename(filePath) === 'wellness.html') {
    html = html.replace(
      /"description": "Curated Japan wellness products sourced through official channels, with transparent guidance and worldwide delivery support\."/,
      '"description": "Curated Japan wellness products sourced through official channels, with transparent guidance and worldwide delivery support."'
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
}

function main() {
  const legacySource = readLegacySource();
  const { I18N, LANG_FONTS, PAGE_META } = loadLegacyData(legacySource);
  writeChunks(I18N, PAGE_META, LANG_FONTS);

  fs.readdirSync(enDir)
    .filter((name) => name.endsWith('.html'))
    .forEach((name) => {
      patchEnglishHtml(path.join(enDir, name), I18N.en || {}, PAGE_META);
    });
}

main();
