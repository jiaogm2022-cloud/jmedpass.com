const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const files = ['wellness.html', path.join('en', 'wellness.html')];
const dataFile = path.join(root, 'wellness-data.js');

function extractBlock(content) {
  const match = content.match(/\/\* ===== PRODUCT DATA \(default - overridden by admin if set\) ===== \*\/\s*var DEFAULT_PRODUCTS_SH = \[[\s\S]*?\n\];/);
  if (!match) {
    throw new Error('Could not find inline wellness catalog block');
  }
  return match[0];
}

const source = fs.readFileSync(path.join(root, 'wellness.html'), 'utf8');
const block = extractBlock(source);
const arrayBody = block.replace(/^[\s\S]*?var DEFAULT_PRODUCTS_SH = /, '');

fs.writeFileSync(
  dataFile,
  `/* Shared wellness catalog fallback */\nwindow.DEFAULT_PRODUCTS_SH = ${arrayBody}\n`,
  'utf8'
);

files.forEach((file) => {
  const abs = path.join(root, file);
  const before = fs.readFileSync(abs, 'utf8');
  const inline = extractBlock(before);
  const replacement = `/* ===== PRODUCT DATA (default - overridden by admin if set) ===== */\nvar DEFAULT_PRODUCTS_SH = Array.isArray(window.DEFAULT_PRODUCTS_SH) ? window.DEFAULT_PRODUCTS_SH.slice() : [];`;
  const after = before
    .replace('<script src="script.js"></script>', '<script src="/script.js"></script>\n<script src="/wellness-data.js"></script>')
    .replace(inline, replacement);
  fs.writeFileSync(abs, after, 'utf8');
  console.log(`updated ${file}`);
});
