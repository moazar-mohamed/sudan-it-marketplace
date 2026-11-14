/*
 * Firestore security-rules tests for the editable city list
 * (platform_settings/cities) and the "a company now serves your city"
 * announcements (city_announcements). Local emulator only
 * (npm run test:rules); every user is a fake identity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { SUDAN_CITIES } from '../src/data/cities';

let env: RulesTestEnvironment;
const now = new Date();
type Data = Record<string, unknown>;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sudan-rules',
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ?? fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid, { email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const item = (id: string, extra: Data = {}) => ({ id, nameAr: id, nameEn: id, active: true, ...extra });
const builtinItems = SUDAN_CITIES.map((c) => item(c.id));
const builtinIds = SUDAN_CITIES.map((c) => c.id);

const citiesDoc = (ids: string[], extra: Data = {}) => ({
  ids,
  items: ids.map((id) => item(id)),
  updatedAt: serverTimestamp(),
  ...extra,
});

async function seedCitiesDocument(ids: string[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'platform_settings', 'cities'), {
      ids,
      items: ids.map((id) => item(id)),
      updatedAt: now,
    });
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path: string, data: Data) => setDoc(doc(db, path), data);
    const user = (id: string, fields: Data) =>
      put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, isActive: true, createdAt: now, ...fields });
    await user('cust', { role: 'customer' });
    await user('ca1', { role: 'company_admin', companyId: 'c1' });
    await user('ca2', { role: 'company_admin', companyId: 'c2' });
    await user('pa', { role: 'platform_admin' });
    const company = (id: string, extra: Data = {}) =>
      put(`companies/${id}`, {
        name: `Company ${id}`,
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        logoUrl: '',
        description: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        pickupAddress: '',
        ...extra,
      });
    await company('c1', { serviceCityIds: ['khartoum', 'bahri'] });
    await company('c2', { serviceCityIds: ['nyala'] });
    await company('cOff', { status: 'inactive', serviceCityIds: ['khartoum'] });
  });
});

describe('the list of cities', () => {
  it('is readable by anyone, and can be listed by no one', async () => {
    await seedCitiesDocument(builtinIds);
    await assertSucceeds(getDoc(doc(anon(), 'platform_settings', 'cities')));
    await assertSucceeds(getDoc(doc(as('cust'), 'platform_settings', 'cities')));
  });

  it('Platform Admin can save it, the first time and again', async () => {
    await assertSucceeds(setDoc(doc(as('pa'), 'platform_settings', 'cities'), citiesDoc(builtinIds)));
    await assertSucceeds(
      setDoc(doc(as('pa'), 'platform_settings', 'cities'), citiesDoc([...builtinIds, 'atlantis'])),
    );
  });

  it('nobody else can write it', async () => {
    for (const uid of ['cust', 'ca1']) {
      await assertFails(setDoc(doc(as(uid), 'platform_settings', 'cities'), citiesDoc(builtinIds)));
    }
    await assertFails(setDoc(doc(anon(), 'platform_settings', 'cities'), citiesDoc(builtinIds)));
  });

  it('a city id can never be taken out, so nothing already saved turns invalid', async () => {
    await seedCitiesDocument([...builtinIds, 'atlantis']);
    await assertFails(setDoc(doc(as('pa'), 'platform_settings', 'cities'), citiesDoc(builtinIds)));
    await assertSucceeds(
      setDoc(doc(as('pa'), 'platform_settings', 'cities'), citiesDoc([...builtinIds, 'atlantis', 'camelot'])),
    );
  });

  it('the first save must keep every city the app ships with', async () => {
    await assertFails(setDoc(doc(as('pa'), 'platform_settings', 'cities'), citiesDoc(builtinIds.slice(1))));
  });

  it('rejects a malformed document', async () => {
    const ref = doc(as('pa'), 'platform_settings', 'cities');
    await assertFails(setDoc(ref, citiesDoc(builtinIds, { items: builtinItems.slice(1) })));
    await assertFails(setDoc(ref, citiesDoc(builtinIds, { extra: true })));
    await assertFails(setDoc(ref, citiesDoc(builtinIds, { updatedAt: new Date() })));
    await assertFails(setDoc(ref, citiesDoc(builtinIds, { ids: 'khartoum' })));
  });

  it('a city Platform Admin added can be chosen by customers and companies', async () => {
    await assertFails(updateDoc(doc(as('cust'), 'users', 'cust'), { cityId: 'atlantis' }));
    await seedCitiesDocument([...builtinIds, 'atlantis']);
    await assertSucceeds(updateDoc(doc(as('cust'), 'users', 'cust'), { cityId: 'atlantis' }));
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'companies', 'c1'), {
        serviceCityIds: ['khartoum', 'atlantis'],
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('a company announces a city it now serves', () => {
  const announcement = (companyId: string, cityId: string, uid: string, extra: Data = {}) => ({
    companyId,
    companyName: `Company ${companyId}`,
    cityId,
    senderId: uid,
    createdAt: serverTimestamp(),
    ...extra,
  });
  const create = (uid: string, companyId: string, cityId: string, extra: Data = {}) =>
    setDoc(doc(as(uid), 'city_announcements', `${companyId}_${cityId}`), announcement(companyId, cityId, uid, extra));

  it('its own admin can announce a city the company serves', async () => {
    await assertSucceeds(create('ca1', 'c1', 'khartoum'));
  });

  it('Platform Admin can announce for a company', async () => {
    await assertSucceeds(create('pa', 'c1', 'bahri'));
  });

  it('only once for a company and a city, and never changed or removed', async () => {
    await assertSucceeds(create('ca1', 'c1', 'khartoum'));
    await assertFails(create('ca1', 'c1', 'khartoum'));
    await assertFails(
      updateDoc(doc(as('ca1'), 'city_announcements', 'c1_khartoum'), { createdAt: serverTimestamp() }),
    );
  });

  it('refuses a city the company does not serve, another company, and a customer', async () => {
    await assertFails(create('ca1', 'c1', 'nyala'));
    await assertFails(create('ca1', 'c2', 'nyala'));
    await assertFails(create('ca2', 'c1', 'khartoum'));
    await assertFails(create('cust', 'c1', 'khartoum'));
  });

  it('refuses a made-up name, sender, id, key, time or city', async () => {
    await assertFails(create('ca1', 'c1', 'khartoum', { companyName: 'Free money' }));
    await assertFails(create('ca1', 'c1', 'khartoum', { senderId: 'pa' }));
    await assertFails(create('ca1', 'c1', 'khartoum', { extra: 'x' }));
    await assertFails(create('ca1', 'c1', 'khartoum', { createdAt: new Date() }));
    await assertFails(
      setDoc(doc(as('ca1'), 'city_announcements', 'anything'), announcement('c1', 'khartoum', 'ca1')),
    );
    await assertFails(create('ca1', 'c1', 'mars'));
  });

  it('a company that is not active announces nothing', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'caOff'), {
        id: 'caOff',
        fullName: 'x',
        email: 'x@x.test',
        role: 'company_admin',
        companyId: 'cOff',
        isActive: true,
        createdAt: now,
      });
    });
    await assertFails(create('caOff', 'cOff', 'khartoum'));
  });

  it('nobody can read an announcement from an app', async () => {
    await assertSucceeds(create('ca1', 'c1', 'khartoum'));
    await assertFails(getDoc(doc(as('ca1'), 'city_announcements', 'c1_khartoum')));
    await assertFails(getDoc(doc(as('pa'), 'city_announcements', 'c1_khartoum')));
  });

  it('a company can announce all its new cities together with saving them', async () => {
    const cities = builtinIds.slice(0, 25);
    const db = as('ca1');
    await assertSucceeds(
      updateDoc(doc(db, 'companies', 'c1'), { serviceCityIds: cities, updatedAt: serverTimestamp() }),
    );
    const batch = writeBatch(db);
    for (const cityId of cities) {
      batch.set(doc(db, 'city_announcements', `c1_${cityId}`), announcement('c1', cityId, 'ca1'));
    }
    await assertSucceeds(batch.commit());
  });
});
