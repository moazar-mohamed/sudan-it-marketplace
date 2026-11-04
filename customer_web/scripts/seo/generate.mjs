#!/usr/bin/env node
// Writes the public catalog pages (customer_web/public/catalog, sitemap.xml, robots.txt)
// from the live Firestore data, ready for the next build and deploy.
//
//   npm run seo                          live data, as the Firebase CLI user (run `firebase login` once)
//   npm run seo -- --emulator            the local emulator (seeded with scratchpad/seed.mjs)
//   npm run seo -- --fixture data.json   a JSON file {products, companies, categories}
//   npm run seo -- --site-url https://shop.example.com   the address written into the pages
//
// Live data is read with the signed-in Firebase CLI's own access token (or SEO_ACCESS_TOKEN,
// or the service account in GOOGLE_APPLICATION_CREDENTIALS), and only the fields the pages
// need are requested: contact details and payment accounts are never fetched.
import { execSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSite } from './site.mjs';

const PROJECT = 'sudan-it-marketplace';
const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(here, '../../public');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const siteUrl = option('--site-url') ?? process.env.SITE_URL ?? 'https://sudan-it-market.web.app';

const FIELDS = {
  products: ['companyId', 'companyName', 'categoryId', 'name', 'brand', 'description', 'imageUrl', 'imageUrls', 'price', 'currency', 'offerPrice', 'offerEndsAt', 'stockCount', 'inStock', 'status', 'hidden', 'specifications', 'specificationsOrder', 'isDeliveryAvailable', 'isInstallationAvailable', 'createdAt'],
  companies: ['name', 'logoUrl', 'description', 'status', 'serviceCityIds'],
  categories: ['name', 'nameAr', 'nameEn', 'description', 'parentId', 'sortOrder', 'isActive', 'deletionPending'],
};

// ── Firestore REST values → plain JS ─────────────────────────────────────────

function decode(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]));
  return null;
}

const decodeDoc = (doc) => ({
  id: doc.name.split('/').pop(),
  ...Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, v]) => [k, decode(v)])),
});

// ── Where the data comes from ────────────────────────────────────────────────

async function serviceAccountToken(file) {
  const key = JSON.parse(readFileSync(file, 'utf8'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Service account sign-in failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** The Firebase CLI's own login, through its library (nothing is read from its files here). */
async function firebaseCliToken() {
  const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
  const require = createRequire(join(root, 'firebase-tools', 'package.json'));
  return require('./lib/apiv2').getAccessToken();
}

async function accessToken() {
  if (process.env.SEO_ACCESS_TOKEN) return process.env.SEO_ACCESS_TOKEN;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return serviceAccountToken(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  try {
    return await firebaseCliToken();
  } catch (e) {
    throw new Error(`Could not use the Firebase CLI login (${e.message}). Run "firebase login", or set GOOGLE_APPLICATION_CREDENTIALS to a service account key file.`);
  }
}

async function loadData() {
  if (option('--fixture')) return JSON.parse(readFileSync(resolve(option('--fixture')), 'utf8'));
  const emulator = flag('--emulator');
  const base = emulator
    ? `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
  const token = emulator ? 'owner' : await accessToken();
  const data = {};
  for (const [name, fields] of Object.entries(FIELDS)) {
    const docs = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({ pageSize: '300' });
      if (pageToken) query.set('pageToken', pageToken);
      const url = `${base}/${name}?${query}&${fields.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&')}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Reading ${name} failed: ${res.status} ${await res.text()}`);
      const body = await res.json();
      docs.push(...(body.documents ?? []).map(decodeDoc));
      pageToken = body.nextPageToken ?? '';
    } while (pageToken);
    data[name] = docs;
  }
  return data;
}

// ── Write ────────────────────────────────────────────────────────────────────

const data = await loadData();
const { files, counts } = renderSite(data, { siteUrl });

rmSync(join(PUBLIC, 'catalog'), { recursive: true, force: true });
for (const [path, text] of files) {
  const target = join(PUBLIC, path);
  if (!target.startsWith(PUBLIC)) throw new Error(`Refusing to write outside public/: ${path}`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
}
console.log(`${files.size} files written to ${PUBLIC}`);
console.log(`products: ${counts.products}, companies: ${counts.companies}, categories: ${counts.categories}, address: ${siteUrl}`);
