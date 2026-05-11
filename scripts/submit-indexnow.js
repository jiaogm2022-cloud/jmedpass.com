const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const rootArg = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const rootDir = rootArg ? path.resolve(rootArg) : process.cwd();
const sitemapPath = path.join(rootDir, 'sitemap.xml');

function readIndexNowKey(root) {
  const keyFiles = fs
    .readdirSync(root)
    .filter((file) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(file))
    .sort();

  if (keyFiles.length === 0) {
    throw new Error('Missing IndexNow key file in site root');
  }

  const keyFile = keyFiles[0];
  const key = fs.readFileSync(path.join(root, keyFile), 'utf8').trim();
  if (!key) {
    throw new Error(`IndexNow key file is empty: ${keyFile}`);
  }

  return {
    key,
    keyFile,
    keyLocation: `https://jmedpass.com/${keyFile}`,
  };
}

function extractUrlsFromSitemap(xml) {
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map((match) => match[1].trim()).filter(Boolean);
  return [...new Set(urls)];
}

async function main() {
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(`Missing sitemap: ${sitemapPath}`);
  }

  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const urlList = extractUrlsFromSitemap(xml);
  if (urlList.length === 0) {
    throw new Error('No URLs found in sitemap.xml');
  }

  const { key, keyFile, keyLocation } = readIndexNowKey(rootDir);
  const payload = {
    host: 'jmedpass.com',
    key,
    keyLocation,
    urlList,
  };

  console.log(`Prepared ${urlList.length} URLs from sitemap.xml`);
  console.log(`Using key file: ${keyFile}`);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IndexNow submission failed: ${response.status} ${response.statusText}\n${body}`);
  }

  console.log(`IndexNow accepted ${urlList.length} URLs.`);
  if (body.trim()) {
    console.log(body.trim());
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
