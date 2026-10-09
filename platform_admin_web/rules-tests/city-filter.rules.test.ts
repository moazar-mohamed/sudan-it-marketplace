/*
 * Firestore security-rules tests for the city filter: a customer's `cityId`,
 * a company's `serviceCityIds`, and the refusal of an order or a service
 * request sent to a company that does not serve the customer's city.
 * Local emulator only (npm run test:rules); every user is a fake identity.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from './support/checkout';

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

const product = (id: string, companyId: string): Data => ({
  id,
  companyId,
  companyName: `Company ${companyId}`,
  name: `Product ${id}`,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 50,
  inStock: true,
  description: 'd',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  createdAt: now,
  updatedAt: now,
});

const order = (id: string, customerId: string, companyId: string, productId: string): Data => ({
  id,
  customerId,
  companyId,
  companyName: `Company ${companyId}`,
  productId,
  productName: `Product ${productId}`,
  quantity: 1,
  unitPrice: 100,
  productSubtotal: 100,
  installationSelected: false,
  installationFee: 0,
  deliveryFee: 15000,
  totalAmount: 15100,
  deliveryAddress: 'Street 15',
  contactPhone: '+249912345678',
  deliveryMethod: 'delivery',
  customerName: customerId,
  paymentStatus: 'pending_verification',
  orderStatus: 'processing',
  stockReserved: false,
  receiptFileName: 'receipt.jpg',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path: string, data: Data) => setDoc(doc(db, path), data);
    const user = (id: string, fields: Data) =>
      put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, isActive: true, createdAt: now, ...fields });
    await user('khartoumCust', { role: 'customer', cityId: 'khartoum' });
    await user('portCust', { role: 'customer', cityId: 'port_sudan' });
    await user('noCityCust', { role: 'customer' });
    await user('ca1', { role: 'company_admin', companyId: 'cKhartoum' });
    await user('ca2', { role: 'company_admin', companyId: 'cEverywhere' });
    await user('pa', { role: 'platform_admin' });
    const company = (id: string, extra: Data = {}) =>
      put(`companies/${id}`, {
        name: `Company ${id}`,
        status: 'active',
        rating: 0,
        reviewCount: 0,
        createdAt: now,
        ...extra,
      });
    await company('cKhartoum', {
      logoUrl: '',
      description: '',
      city: '',
      address: '',
      phone: '',
      email: '',
      pickupAddress: '',
      serviceCityIds: ['khartoum', 'omdurman'],
    });
    await company('cEverywhere'); // predates the setting: no serviceCityIds
    await company('cEmpty', { serviceCityIds: [] });
    for (const [pid, cid] of [
      ['pK', 'cKhartoum'],
      ['pE', 'cEverywhere'],
      ['pEmpty', 'cEmpty'],
    ]) {
      await put(`products/${pid}`, product(pid, cid));
    }
    await put('categories/cat1', {
      id: 'cat1',
      name: 'IT',
      description: '',
      iconName: '',
      isActive: true,
      createdAt: now,
    });
    await put('services/svc1', {
      id: 'svc1',
      categoryId: 'cat1',
      name: 'Service',
      description: '',
      isActive: true,
      createdAt: now,
    });
    for (const cid of ['cKhartoum', 'cEverywhere']) {
      await put(`company_services/${cid}_svc1`, {
        id: `${cid}_svc1`,
        companyId: cid,
        serviceId: 'svc1',
        isActive: true,
        createdAt: now,
      });
    }
  });
});

const readCity = async (uid: string) => {
  let city: unknown;
  await env.withSecurityRulesDisabled(async (ctx) => {
    city = (await getDoc(doc(ctx.firestore(), 'users', uid))).data()?.cityId;
  });
  return city;
};

describe('a customer city', () => {
  it('can be set and changed to a city of the list', async () => {
    await assertSucceeds(updateDoc(doc(as('noCityCust'), 'users', 'noCityCust'), { cityId: 'kassala' }));
    expect(await readCity('noCityCust')).toBe('kassala');
    await assertSucceeds(updateDoc(doc(as('noCityCust'), 'users', 'noCityCust'), { cityId: 'nyala' }));
  });

  it('rejects an unknown city or a wrong type', async () => {
    for (const bad of ['mars', '', 'KHARTOUM', 5, null, ['khartoum']]) {
      await assertFails(updateDoc(doc(as('noCityCust'), 'users', 'noCityCust'), { cityId: bad }));
    }
    await assertFails(updateDoc(doc(as('khartoumCust'), 'users', 'khartoumCust'), { cityId: deleteField() }));
  });

  it('cannot ride along with another field, and is not editable by others', async () => {
    await assertFails(
      updateDoc(doc(as('noCityCust'), 'users', 'noCityCust'), { cityId: 'kassala', role: 'platform_admin' }),
    );
    await assertFails(updateDoc(doc(as('portCust'), 'users', 'khartoumCust'), { cityId: 'nyala' }));
    await assertFails(updateDoc(doc(as('pa'), 'users', 'khartoumCust'), { cityId: 'nyala' }));
  });

  it('a company admin has no city to set', async () => {
    await assertFails(updateDoc(doc(as('ca1'), 'users', 'ca1'), { cityId: 'khartoum' }));
  });
});

describe('the service cities of a company', () => {
  const profile = (extra: Data) => ({
    logoUrl: '',
    description: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    pickupAddress: '',
    name: 'Company cKhartoum',
    ...extra,
    updatedAt: serverTimestamp(),
  });

  it('its own admin can change them to cities of the list, or clear them', async () => {
    const ref = doc(as('ca1'), 'companies', 'cKhartoum');
    await assertSucceeds(updateDoc(ref, profile({ serviceCityIds: ['khartoum', 'bahri', 'port_sudan'] })));
    await assertSucceeds(updateDoc(ref, profile({ serviceCityIds: [] })));
  });

  it('rejects unknown cities and values that are not a list', async () => {
    const ref = doc(as('ca1'), 'companies', 'cKhartoum');
    await assertFails(updateDoc(ref, profile({ serviceCityIds: ['khartoum', 'mars'] })));
    await assertFails(updateDoc(ref, profile({ serviceCityIds: 'khartoum' })));
    await assertFails(updateDoc(ref, profile({ serviceCityIds: [1] })));
  });

  it('another company admin and a customer cannot change them', async () => {
    const change = { serviceCityIds: ['kassala'], updatedAt: serverTimestamp() };
    await assertFails(updateDoc(doc(as('ca2'), 'companies', 'cKhartoum'), change));
    await assertFails(updateDoc(doc(as('khartoumCust'), 'companies', 'cKhartoum'), change));
  });

  it('Platform Admin can set them, and nothing else with them', async () => {
    const ref = doc(as('pa'), 'companies', 'cKhartoum');
    await assertSucceeds(updateDoc(ref, { serviceCityIds: ['kassala', 'nyala'], updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { serviceCityIds: [], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { serviceCityIds: ['atlantis'], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { serviceCityIds: ['kassala'] }));
    await assertFails(updateDoc(ref, { serviceCityIds: ['kassala'], name: 'Renamed', updatedAt: serverTimestamp() }));
  });

  it('Platform Admin can create a company that serves chosen cities', async () => {
    const base = { name: 'New Co', status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as('pa'), 'companies', 'new1'), { ...base, serviceCityIds: ['khartoum', 'bahri'] }));
    await assertFails(setDoc(doc(as('pa'), 'companies', 'new2'), { ...base, serviceCityIds: ['atlantis'] }));
  });
});

describe('orders and service requests follow the city', () => {
  const place = (uid: string, companyId: string, productId: string) =>
    placeOrder(as(uid), uid, order(`o_${uid}_${companyId}`, uid, companyId, productId));

  it('a customer orders from a company that serves their city', async () => {
    await assertSucceeds(place('khartoumCust', 'cKhartoum', 'pK'));
  });

  it('a customer cannot order from a company that does not serve their city', async () => {
    await assertFails(place('portCust', 'cKhartoum', 'pK'));
  });

  it('a company with no cities (or an empty list) takes orders from any city', async () => {
    await assertSucceeds(place('portCust', 'cEverywhere', 'pE'));
    await assertSucceeds(place('noCityCust', 'cEmpty', 'pEmpty'));
  });

  it('a customer with no city cannot order from a company that lists cities', async () => {
    await assertFails(place('noCityCust', 'cKhartoum', 'pK'));
  });

  const request = (db: ReturnType<typeof as>, id: string, customerId: string, companyId: string) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'service_requests', id), {
      id,
      customerId,
      customerName: customerId,
      companyId,
      companyName: `Company ${companyId}`,
      companyServiceId: `${companyId}_svc1`,
      serviceId: 'svc1',
      serviceName: 'Service',
      price: null,
      details: 'Please help',
      address: 'Street 1',
      latitude: null,
      longitude: null,
      contactPhone: '+249912345678',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'chats', id), {
      id,
      serviceRequestId: id,
      customerId,
      companyId,
      customerName: customerId,
      companyName: `Company ${companyId}`,
      serviceName: 'Service',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return batch.commit();
  };

  it('a service request goes only to a company that serves the customer city', async () => {
    await assertSucceeds(request(as('khartoumCust'), 'r1', 'khartoumCust', 'cKhartoum'));
    await assertFails(request(as('portCust'), 'r2', 'portCust', 'cKhartoum'));
    await assertSucceeds(request(as('portCust'), 'r3', 'portCust', 'cEverywhere'));
  });
});

describe('Platform Admin and the city of a customer', () => {
  it('can set it, together with the profile fields', async () => {
    const ref = doc(as('pa'), 'users', 'noCityCust');
    await assertSucceeds(updateDoc(ref, { cityId: 'kassala', updatedAt: serverTimestamp() }));
    expect(await readCity('noCityCust')).toBe('kassala');
    await assertSucceeds(updateDoc(ref, { cityId: 'nyala', fullName: 'Renamed', updatedAt: serverTimestamp() }));
  });

  it('rejects an unknown city, a missing server time, or another field with it', async () => {
    const ref = doc(as('pa'), 'users', 'noCityCust');
    await assertFails(updateDoc(ref, { cityId: 'mars', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { cityId: 'kassala' }));
    await assertFails(updateDoc(ref, { cityId: 'kassala', role: 'platform_admin', updatedAt: serverTimestamp() }));
  });

  it('cannot set the city of a company admin', async () => {
    await assertFails(updateDoc(doc(as('pa'), 'users', 'ca1'), { cityId: 'kassala', updatedAt: serverTimestamp() }));
  });
});
