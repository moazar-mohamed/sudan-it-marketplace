/*
 * Firestore security-rules tests for the optional map location (latitude /
 * longitude) on companies and orders. Local emulator only (npm run test:rules):
 * every user below is a fake identity inside the emulator.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const profile = {
  logoUrl: '',
  description: 'd',
  city: 'Khartoum',
  address: 'Street 1',
  phone: '1',
  email: 'e@x.test',
  pickupAddress: 'p',
};

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = new Date();
    const user = (id: string, role: string, extra: object = {}) =>
      setDoc(doc(db, 'users', id), {
        id,
        fullName: `Name ${id}`,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: now,
        ...extra,
      });
    await user('admin', 'platform_admin');
    await user('cust1', 'customer');
    await user('cust2', 'customer');
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('ca2', 'company_admin', { companyId: 'c2' });
    await user('tech1', 'technician', { companyId: 'c1', phone: '1' });
    await user('tech2', 'technician', { companyId: 'c2', phone: '1' });

    const technician = (id: string, companyId: string) =>
      setDoc(doc(db, 'technicians', id), {
        id,
        uid: id,
        companyId,
        fullName: `Name ${id}`,
        phone: '1',
        email: `${id}@x.test`,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    await technician('tech1', 'c1');
    await technician('tech2', 'c2');

    // c1 has a map point; c_legacy only has text (an old company).
    await setDoc(doc(db, 'companies', 'c1'), {
      name: 'Company 1',
      rating: 4,
      reviewCount: 1,
      status: 'active',
      createdAt: now,
      ...profile,
      latitude: 15.5,
      longitude: 32.5,
    });
    await setDoc(doc(db, 'companies', 'c2'), {
      name: 'Company 2',
      rating: 0,
      reviewCount: 0,
      status: 'active',
      createdAt: now,
      ...profile,
    });
    await setDoc(doc(db, 'companies', 'c_legacy'), {
      name: 'Legacy',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      ...profile,
    });

    const order = (id: string, extra: object = {}) =>
      setDoc(doc(db, 'orders', id), {
        id,
        customerId: 'cust1',
        companyId: 'c1',
        companyName: 'Company 1',
        productId: 'p1',
        productName: 'Router',
        quantity: 1,
        unitPrice: 100,
        productSubtotal: 100,
        installationSelected: true,
        installationFee: 10,
        deliveryFee: 5,
        totalAmount: 115,
        deliveryAddress: 'Customer street',
        contactPhone: '1',
        deliveryMethod: 'delivery',
        paymentStatus: 'pending_verification',
        orderStatus: 'processing',
        receiptFileName: 'r.jpg',
        createdAt: now,
        updatedAt: now,
        ...extra,
      });
    // An assigned installation order that carries the customer's delivery point.
    await order('o_pin', {
      technicianId: 'tech1',
      technicianName: 'Name tech1',
      deliveryLatitude: 15.6,
      deliveryLongitude: 32.6,
    });
    // A legacy order with only a written address, assigned to tech1.
    await order('o_text', { technicianId: 'tech1', technicianName: 'Name tech1' });
    // Not assigned to any technician.
    await order('o_unassigned');
  });
}

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
beforeEach(seed);

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('Company location: who can change it', () => {
  const patch = (extra: object) => ({ ...extra, updatedAt: serverTimestamp() });

  it('company admin saves text and coordinates together', async () => {
    await assertSucceeds(
      updateDoc(
        doc(as('ca1'), 'companies', 'c1'),
        patch({ address: 'New street', latitude: 15.55, longitude: 32.55 }),
      ),
    );
  });

  it('company admin can save coordinates without any text', async () => {
    await assertSucceeds(
      updateDoc(
        doc(as('ca1'), 'companies', 'c1'),
        patch({ address: '', latitude: 15.55, longitude: 32.55 }),
      ),
    );
  });

  it('company admin can save text only (no coordinates)', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'companies', 'c1'), patch({ address: 'Text only' })),
    );
  });

  it('a legacy text-only company keeps working and can add a point later', async () => {
    const legacyAdmin = env.authenticatedContext('ca_legacy').firestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'ca_legacy'), {
        id: 'ca_legacy',
        fullName: 'L',
        email: 'l@x.test',
        role: 'company_admin',
        isActive: true,
        companyId: 'c_legacy',
        createdAt: new Date(),
      });
    });
    await assertSucceeds(
      updateDoc(doc(legacyAdmin, 'companies', 'c_legacy'), patch({ address: 'Edited text' })),
    );
    await assertSucceeds(
      updateDoc(
        doc(legacyAdmin, 'companies', 'c_legacy'),
        patch({ latitude: 15.1, longitude: 32.1 }),
      ),
    );
  });

  it('company admin can remove the map point', async () => {
    await assertSucceeds(
      updateDoc(
        doc(as('ca1'), 'companies', 'c1'),
        patch({ latitude: deleteField(), longitude: deleteField() }),
      ),
    );
  });

  it('rejects a half point: latitude alone on a company that has no point', async () => {
    // c2 has no coordinates, so the resulting document would hold only one.
    await assertFails(updateDoc(doc(as('ca2'), 'companies', 'c2'), patch({ latitude: 15.5 })));
    await assertFails(updateDoc(doc(as('ca2'), 'companies', 'c2'), patch({ longitude: 32.5 })));
  });

  it('rejects removing only one half of an existing point', async () => {
    await assertFails(
      updateDoc(doc(as('ca1'), 'companies', 'c1'), patch({ latitude: deleteField() })),
    );
  });

  it.each([
    ['out-of-range latitude', { latitude: 91, longitude: 32 }],
    ['out-of-range longitude', { latitude: 15, longitude: 181 }],
    ['coordinates stored as strings', { latitude: '15.5', longitude: '32.5' }],
  ])('rejects %s', async (_name, extra) => {
    await assertFails(updateDoc(doc(as('ca1'), 'companies', 'c1'), patch(extra)));
  });

  it('another company admin cannot change this company location', async () => {
    await assertFails(
      updateDoc(doc(as('ca2'), 'companies', 'c1'), patch({ latitude: 1, longitude: 1 })),
    );
  });

  it('customers cannot change a company location', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'companies', 'c1'), patch({ latitude: 1, longitude: 1 })),
    );
  });

  it('technicians cannot change a company location', async () => {
    await assertFails(
      updateDoc(doc(as('tech1'), 'companies', 'c1'), patch({ latitude: 1, longitude: 1 })),
    );
    await assertFails(
      updateDoc(doc(as('tech1'), 'companies', 'c1'), patch({ address: 'hijack' })),
    );
  });

  it('platform admin keeps status-only control over an existing company', async () => {
    await assertFails(
      updateDoc(doc(as('admin'), 'companies', 'c1'), patch({ latitude: 1, longitude: 1 })),
    );
  });

  it('every signed-in role can read a company location; signed-out cannot', async () => {
    for (const uid of ['cust1', 'tech1', 'ca2', 'admin']) {
      await assertSucceeds(getDoc(doc(as(uid), 'companies', 'c1')));
    }
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'companies', 'c1')));
  });
});

describe('Platform Admin adds a company with a location', () => {
  const base = {
    name: 'New Co',
    logoUrl: '',
    description: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    pickupAddress: '',
    rating: 0,
    reviewCount: 0,
    status: 'active',
  };
  const create = (id: string, extra: object) =>
    setDoc(doc(as('admin'), 'companies', id), {
      ...base,
      ...extra,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

  it('accepts text only, coordinates only, or both', async () => {
    await assertSucceeds(create('n1', { address: 'Only text' }));
    await assertSucceeds(create('n2', { latitude: 15.5, longitude: 32.5 }));
    await assertSucceeds(create('n3', { address: 'Both', latitude: 15.5, longitude: 32.5 }));
  });

  it('rejects an incomplete, out-of-range or string point', async () => {
    await assertFails(create('bad1', { latitude: 15.5 }));
    await assertFails(create('bad2', { latitude: 120, longitude: 32.5 }));
    await assertFails(create('bad3', { latitude: '15.5', longitude: '32.5' }));
  });

  it('only Platform Admin can add a company', async () => {
    await assertFails(
      setDoc(doc(as('ca1'), 'companies', 'x1'), {
        ...base,
        latitude: 1,
        longitude: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe('Order delivery location captured at checkout', () => {
  const newOrder = (id: string, extra: object = {}) => ({
    id,
    customerId: 'cust1',
    companyId: 'c1',
    companyName: 'Company 1',
    productId: 'p1',
    productName: 'Router',
    quantity: 1,
    unitPrice: 100,
    productSubtotal: 100,
    installationSelected: false,
    installationFee: 0,
    deliveryFee: 15,
    totalAmount: 115,
    deliveryAddress: 'Customer street',
    contactPhone: '0911111111',
    deliveryMethod: 'delivery',
    customerName: 'Name cust1',
    paymentStatus: 'pending_verification',
    orderStatus: 'processing',
    receiptFileName: 'r.jpg',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });
  const create = (id: string, extra: object = {}, uid = 'cust1') =>
    setDoc(doc(as(uid), 'orders', id), newOrder(id, extra));

  it('accepts a typed address only (legacy shape)', async () => {
    await assertSucceeds(create('n1'));
  });

  it('accepts an address plus a map point', async () => {
    await assertSucceeds(create('n2', { deliveryLatitude: 15.6, deliveryLongitude: 32.6 }));
  });

  it('accepts a map point with no typed address', async () => {
    await assertSucceeds(
      create('n3', { deliveryAddress: '', deliveryLatitude: 15.6, deliveryLongitude: 32.6 }),
    );
  });

  it('rejects an order with neither an address nor a map point', async () => {
    await assertFails(create('bad0', { deliveryAddress: '' }));
  });

  it.each([
    ['latitude without longitude', { deliveryLatitude: 15.6 }],
    ['out-of-range latitude', { deliveryLatitude: 95, deliveryLongitude: 32 }],
    ['out-of-range longitude', { deliveryLatitude: 15, deliveryLongitude: -181 }],
    ['string coordinates', { deliveryLatitude: '15.6', deliveryLongitude: '32.6' }],
  ])('rejects %s', async (_name, extra) => {
    await assertFails(create('bad1', extra));
  });

  it('a pickup order uses the company location, not a customer point', async () => {
    await assertSucceeds(
      create('p1', { deliveryMethod: 'pickup', deliveryFee: 0, totalAmount: 100 }),
    );
    await assertFails(
      create('p2', {
        deliveryMethod: 'pickup',
        deliveryFee: 0,
        totalAmount: 100,
        deliveryLatitude: 15.6,
        deliveryLongitude: 32.6,
      }),
    );
  });

  it('a customer cannot create an order for someone else', async () => {
    await assertFails(create('n9', {}, 'cust2'));
  });
});

describe('Saved delivery coordinates cannot be edited afterwards', () => {
  const move = { deliveryLatitude: 1, deliveryLongitude: 1, updatedAt: serverTimestamp() };

  it('company admin cannot change customer delivery coordinates', async () => {
    await assertFails(updateDoc(doc(as('ca1'), 'orders', 'o_pin'), move));
    await assertFails(
      updateDoc(doc(as('ca1'), 'orders', 'o_pin'), {
        deliveryAddress: 'moved',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('company admin can still manage the order without touching them', async () => {
    const ref = doc(as('ca1'), 'orders', 'o_pin');
    await assertSucceeds(
      updateDoc(ref, { orderStatus: 'out_for_delivery', updatedAt: serverTimestamp() }),
    );
    const after = (await getDoc(ref)).data();
    if (after?.deliveryLatitude !== 15.6 || after?.deliveryLongitude !== 32.6) {
      throw new Error('delivery coordinates changed');
    }
  });

  it('the customer cannot rewrite the point (only attach a receipt)', async () => {
    await assertFails(updateDoc(doc(as('cust1'), 'orders', 'o_pin'), move));
  });

  it('technician cannot change customer delivery coordinates', async () => {
    await assertFails(updateDoc(doc(as('tech1'), 'orders', 'o_pin'), move));
  });

  it('technician can only move the assigned order status forward', async () => {
    await assertSucceeds(
      updateDoc(doc(as('tech1'), 'orders', 'o_pin'), {
        orderStatus: 'out_for_delivery',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('platform admin cannot change an order', async () => {
    await assertFails(updateDoc(doc(as('admin'), 'orders', 'o_pin'), move));
  });
});

describe('Who can read an order location', () => {
  it('the assigned technician reads the order delivery point (and legacy text)', async () => {
    const pin = (await assertSucceeds(getDoc(doc(as('tech1'), 'orders', 'o_pin')))).data();
    if (pin?.deliveryLatitude !== 15.6) throw new Error('missing delivery point');
    const text = (await assertSucceeds(getDoc(doc(as('tech1'), 'orders', 'o_text')))).data();
    if (text?.deliveryAddress !== 'Customer street') throw new Error('missing address');
  });

  it('a technician cannot read orders that are not assigned to them', async () => {
    await assertFails(getDoc(doc(as('tech1'), 'orders', 'o_unassigned')));
    await assertFails(getDoc(doc(as('tech2'), 'orders', 'o_pin')));
  });

  it('technician list queries only return their assigned orders', async () => {
    await assertSucceeds(
      getDocs(query(collection(as('tech1'), 'orders'), where('technicianId', '==', 'tech1'))),
    );
    await assertFails(getDocs(collection(as('tech1'), 'orders')));
  });

  it('customer and the owning company admin can read the order location', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'orders', 'o_pin')));
    await assertSucceeds(getDoc(doc(as('ca1'), 'orders', 'o_pin')));
    await assertFails(getDoc(doc(as('ca2'), 'orders', 'o_pin')));
    await assertFails(getDoc(doc(as('cust2'), 'orders', 'o_pin')));
  });
});
