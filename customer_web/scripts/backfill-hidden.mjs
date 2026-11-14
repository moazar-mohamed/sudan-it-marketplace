#!/usr/bin/env node
/*
 * One-time fix before the "hidden products stay hidden" rules go live:
 * customers list products with where hidden == false, and Firestore leaves a
 * product out of that list when it has no `hidden` field at all. This gives
 * every product that has none `hidden: false` (what it always meant), and
 * touches nothing else.
 *
 *   npm --prefix customer_web run backfill-hidden            lists what would change
 *   npm --prefix customer_web run backfill-hidden -- --apply  makes the change
 *
 * It signs in with your Firebase CLI login (the same as the SEO script), or a
 * service account key in GOOGLE_APPLICATION_CREDENTIALS.
 */
import { execSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const PROJECT = 'sudan-it-marketplace';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const apply = process.argv.includes('--apply');

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
  // `npm --prefix customer_web run` sets npm_config_prefix, which would make
  // `npm root -g` answer customer_web/node_modules instead of the global folder.
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_prefix') delete env[key];
  const root = execSync('npm root -g', { encoding: 'utf8', env }).trim();
  const require = createRequire(join(root, 'firebase-tools', 'package.json'));
  // The account `firebase login` saved, handed to the CLI's own sign-in step
  // the way its commands do, then a token for this run.
  const account = require('./lib/auth').getGlobalDefaultAccount();
  if (!account) throw new Error('No Firebase CLI login found: run "firebase login" first.');
  await require('./lib/requireAuth').requireAuth({ user: account.user, tokens: account.tokens });
  return require('./lib/apiv2').getAccessToken();
}

async function accessToken() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return serviceAccountToken(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  return firebaseCliToken();
}

const token = await accessToken();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// Every product, with only the two fields this needs.
const missing = [];
let total = 0;
let pageToken = '';
do {
  const query = new URLSearchParams({ pageSize: '300' });
  if (pageToken) query.set('pageToken', pageToken);
  const url = `${BASE}/products?${query}&mask.fieldPaths=name&mask.fieldPaths=hidden`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Reading products failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  for (const d of body.documents ?? []) {
    total++;
    if (!d.fields || !('hidden' in d.fields)) missing.push({ path: d.name, name: d.fields?.name?.stringValue ?? '' });
  }
  pageToken = body.nextPageToken ?? '';
} while (pageToken);

console.log(`products: ${total}, without "hidden": ${missing.length}`);
for (const p of missing) console.log(`  ${p.path.split('/').pop()}  ${p.name}`);
if (!apply) {
  if (missing.length > 0) console.log('Nothing changed. Run again with --apply to add hidden: false to these.');
  process.exit(0);
}

let changed = 0;
for (const p of missing) {
  // Only `hidden` is written, and only if the product still exists.
  const url = `https://firestore.googleapis.com/v1/${p.path}?updateMask.fieldPaths=hidden&currentDocument.exists=true`;
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: { hidden: { booleanValue: false } } }) });
  if (!res.ok) {
    console.error(`  failed ${p.path.split('/').pop()}: ${res.status} ${await res.text()}`);
    continue;
  }
  changed++;
}
console.log(`done: ${changed} of ${missing.length} products now carry hidden: false`);
