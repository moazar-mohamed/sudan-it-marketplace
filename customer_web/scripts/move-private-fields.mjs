#!/usr/bin/env node
/*
 * One-time move of what visitors must not read out of public documents:
 *
 *   companies/{id}.email            -> company_private/{id}.email
 *   companies/{id}.paymentAccounts  -> company_payment/{id}.paymentAccounts
 *   reviews/{id}.customerId         -> removed (the rules find the customer
 *                                      through the order / request instead)
 *
 * Two steps, so checkout never shows "no payment accounts" while the new site
 * and panels go live:
 *
 *   node customer_web/scripts/move-private-fields.mjs             lists what would change
 *   node customer_web/scripts/move-private-fields.mjs --copy      writes the private documents (safe to repeat)
 *   node customer_web/scripts/move-private-fields.mjs --strip     removes the fields from the public documents
 *
 * --strip removes a company's fields only when its private documents already
 * hold the same values. It signs in with your Firebase CLI login (or a service
 * account key in GOOGLE_APPLICATION_CREDENTIALS), like backfill-hidden.mjs.
 */
import { execSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const PROJECT = 'sudan-it-marketplace';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;
const copy = process.argv.includes('--copy');
const strip = process.argv.includes('--strip');
if (copy && strip) throw new Error('Run --copy and --strip separately.');

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

/** The Firebase CLI's own login, through its library. */
async function firebaseCliToken() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_prefix') delete env[key];
  const root = execSync('npm root -g', { encoding: 'utf8', env }).trim();
  const require = createRequire(join(root, 'firebase-tools', 'package.json'));
  const account = require('./lib/auth').getGlobalDefaultAccount();
  if (!account) throw new Error('No Firebase CLI login found: run "firebase login" first.');
  await require('./lib/requireAuth').requireAuth({ user: account.user, tokens: account.tokens });
  return require('./lib/apiv2').getAccessToken();
}

const token = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? await serviceAccountToken(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : await firebaseCliToken();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function listAll(collection, fields) {
  const out = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({ pageSize: '300' });
    if (pageToken) q.set('pageToken', pageToken);
    for (const f of fields) q.append('mask.fieldPaths', f);
    const res = await fetch(`${BASE}/${collection}?${q}`, { headers });
    if (!res.ok) throw new Error(`Reading ${collection} failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    out.push(...(body.documents ?? []));
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

async function getDoc(path) {
  const res = await fetch(`${BASE}/${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Reading ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function commit(writes) {
  if (writes.length === 0) return;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`Write failed: ${res.status} ${await res.text()}`);
}

const idOf = (d) => d.name.split('/').pop();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const accountsOf = (v) => v?.arrayValue?.values ?? [];
const emailOf = (v) => (v?.stringValue ?? '').trim();
const nowTransform = { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' };

// ── companies ──
const companies = await listAll('companies', ['name', 'email', 'paymentAccounts']);
let toCopy = 0;
let toStrip = 0;
let notReady = 0;
for (const c of companies) {
  const id = idOf(c);
  const f = c.fields ?? {};
  const has = { email: 'email' in f, payment: 'paymentAccounts' in f };
  if (!has.email && !has.payment) continue;
  const name = f.name?.stringValue ?? id;
  const email = emailOf(f.email);
  const accounts = accountsOf(f.paymentAccounts);
  console.log(`company ${name} (${id}): email ${email ? 'yes' : 'none'}, ${accounts.length} bank account(s)`);

  if (copy) {
    const writes = [];
    if (email) {
      writes.push({
        update: { name: `${ROOT}/company_private/${id}`, fields: { companyId: { stringValue: id }, email: { stringValue: email } } },
        updateMask: { fieldPaths: ['companyId', 'email'] },
        updateTransforms: [nowTransform],
      });
    }
    if (accounts.length > 0) {
      writes.push({
        update: { name: `${ROOT}/company_payment/${id}`, fields: { companyId: { stringValue: id }, paymentAccounts: f.paymentAccounts } },
        updateMask: { fieldPaths: ['companyId', 'paymentAccounts'] },
        updateTransforms: [nowTransform],
      });
    }
    await commit(writes);
    toCopy += writes.length;
  }

  if (strip) {
    const priv = email ? await getDoc(`company_private/${id}`) : null;
    const pay = accounts.length > 0 ? await getDoc(`company_payment/${id}`) : null;
    const emailReady = !email || emailOf(priv?.fields?.email) === email;
    const payReady = accounts.length === 0 || same(accountsOf(pay?.fields?.paymentAccounts), accounts);
    if (!emailReady || !payReady) {
      console.log('  NOT stripped: run --copy first (the private documents do not match yet)');
      notReady++;
      continue;
    }
    // A field named in the mask but absent from `fields` is deleted.
    await commit([{ update: { name: c.name, fields: {} }, updateMask: { fieldPaths: ['email', 'paymentAccounts'] }, currentDocument: { exists: true } }]);
    toStrip++;
  }
}

// ── reviews ──
const reviews = (await listAll('reviews', ['customerId'])).filter((r) => r.fields && 'customerId' in r.fields);
console.log(`reviews naming their customer: ${reviews.length}`);
if (strip) {
  for (let i = 0; i < reviews.length; i += 400) {
    await commit(
      reviews.slice(i, i + 400).map((r) => ({ update: { name: r.name, fields: {} }, updateMask: { fieldPaths: ['customerId'] }, currentDocument: { exists: true } })),
    );
  }
}

if (copy) console.log(`\nCopied: ${toCopy} private document(s) written.`);
else if (strip) console.log(`\nStripped: ${toStrip} company document(s), ${reviews.length} review(s).${notReady ? ` ${notReady} company(ies) skipped (not copied yet).` : ''}`);
else console.log('\nNothing changed. Run with --copy, then (after the new site and panels are live) --strip.');
