/*
 * Firestore security-rules tests for the Platform Admin permissions.
 * Runs against the local Firestore emulator only (npm run test:rules): every
 * user below is a fake identity inside the emulator, nothing touches the real
 * Firebase project and no accounts or orders are created anywhere.
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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let env: RulesTestEnvironment;

const profile = {
  logoUrl: 'logo',
  description: 'd',
  city: 'Khartoum',
  address: 'a',
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
    await user('admin_off', 'platform_admin', { isActive: false });
    await setDoc(doc(db, 'users', 'admin_noflag'), {
      id: 'admin_noflag',
      fullName: 'No flag',
      email: 'nf@x.test',
      role: 'platform_admin',
      createdAt: now,
    });
    await user('cust1', 'customer', { phone: '0911' });
    await user('cust2', 'customer');
    await user('ca1', 'company_admin', { companyId: 'c_active' });
    await user('tech1', 'technician', { companyId: 'c_active' });

    const company = (id: string, status?: string) =>
      setDoc(doc(db, 'companies', id), {
        name: `Company ${id}`,
        rating: 4,
        reviewCount: 1,
        createdAt: now,
        ...profile,
        ...(status ? { status } : {}),
      });
    await company('c_pending', 'pending');
    await company('c_active', 'active');
    await company('c_legacy');
    await company('c_inactive', 'inactive');
    await company('c_rejected', 'rejected');

    await setDoc(doc(db, 'products', 'p1'), {
      id: 'p1',
      companyId: 'c_active',
      name: 'Router',
      price: 100,
      stockCount: 5,
      inStock: true,
      createdAt: now,
    });
    // A deactivated company with a catalogue and an order in its history.
    for (const id of ['p_in1', 'p_in2']) {
      await setDoc(doc(db, 'products', id), {
        id,
        companyId: 'c_inactive',
        companyName: 'Company c_inactive',
        name: `Product ${id}`,
        price: 50,
        stockCount: 3,
        inStock: true,
        createdAt: now,
      });
    }
    await setDoc(doc(db, 'orders', 'o_hist'), {
      id: 'o_hist',
      customerId: 'cust1',
      companyId: 'c_inactive',
      companyName: 'Company c_inactive',
      productId: 'p_in1',
      productName: 'Product p_in1',
      quantity: 1,
      unitPrice: 50,
      productSubtotal: 50,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 0,
      totalAmount: 50,
      deliveryAddress: 'x',
      contactPhone: '1',
      paymentStatus: 'confirmed',
      orderStatus: 'completed',
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'orders', 'o1'), {
      id: 'o1',
      customerId: 'cust1',
      companyId: 'c_active',
      productId: 'p1',
      productName: 'Router',
      quantity: 1,
      unitPrice: 100,
      productSubtotal: 100,
      installationSelected: false,
      installationFee: 0,
      deliveryFee: 0,
      totalAmount: 100,
      deliveryAddress: 'x',
      contactPhone: '1',
      paymentStatus: 'pending_verification',
      orderStatus: 'processing',
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'categories', 'k1'), {
      id: 'k1',
      name: 'Networking',
      description: 'd',
      iconName: '',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, 'reviews', 'r1'), { rating: 5, comment: 'ok', companyId: 'c_active' });
    await setDoc(doc(db, 'services', 's1'), {
      id: 's1',
      categoryId: 'k1',
      name: 'Install',
      description: '',
      isActive: true,
      createdAt: now,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sudan-rules',
    firestore: {
      // RULES_FILE lets you point the suite at another version of the rules.
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
const admin = () => as('admin');

describe('Platform Admin privilege requires role AND isActive', () => {
  it('active admin can read companies, orders and reviews', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'companies')));
    await assertSucceeds(getDocs(collection(admin(), 'orders')));
    await assertSucceeds(getDocs(collection(admin(), 'reviews')));
  });
  it.each(['admin_off', 'admin_noflag'])('%s loses every admin permission', async (uid) => {
    const db = as(uid);
    await assertFails(getDocs(collection(db, 'orders')));
    await assertFails(getDocs(collection(db, 'reviews')));
    await assertFails(getDocs(query(collection(db, 'users'), where('role', '==', 'customer'))));
    await assertFails(
      updateDoc(doc(db, 'companies', 'c_pending'), { status: 'active', updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(db, 'users', 'cust1'), { isActive: false }));
    await assertFails(updateDoc(doc(db, 'categories', 'k1'), { isActive: false }));
  });
});

describe('Companies', () => {
  const status = (id: string, next: string) =>
    updateDoc(doc(admin(), 'companies', id), { status: next, updatedAt: serverTimestamp() });

  it('approve / reject pending, activate / deactivate', async () => {
    await assertSucceeds(status('c_pending', 'active'));
    await assertSucceeds(status('c_active', 'inactive'));
    await assertSucceeds(status('c_inactive', 'active'));
    await assertSucceeds(status('c_rejected', 'active'));
  });
  it('reject a pending company', async () => {
    await assertSucceeds(status('c_pending', 'rejected'));
  });
  it('deactivates a legacy company that has no stored status', async () => {
    await assertSucceeds(status('c_legacy', 'inactive'));
  });
  it('rejects invalid status values and transitions', async () => {
    await assertFails(status('c_pending', 'banana'));
    await assertFails(status('c_active', 'pending'));
    await assertFails(status('c_active', 'rejected'));
    await assertFails(status('c_pending', 'inactive'));
    await assertFails(status('c_active', 'active'));
  });
  it('cannot edit any profile field, alone or with status', async () => {
    for (const field of ['name', 'logoUrl', 'description', 'city', 'address', 'phone', 'email', 'pickupAddress']) {
      await assertFails(updateDoc(doc(admin(), 'companies', 'c_active'), { [field]: 'changed', updatedAt: serverTimestamp() }));
      await assertFails(
        updateDoc(doc(admin(), 'companies', 'c_pending'), { status: 'active', [field]: 'changed', updatedAt: serverTimestamp() }),
      );
    }
    await assertFails(updateDoc(doc(admin(), 'companies', 'c_active'), { ownerId: 'x', updatedAt: serverTimestamp() }));
  });
  const newCompany = (extra: object = {}) => ({
    name: 'New Co',
    ...profile,
    rating: 0,
    reviewCount: 0,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  });
  it('can add an active, unrated company with only profile fields', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'companies', 'new1'), newCompany()));
    await assertSucceeds(
      setDoc(doc(admin(), 'companies', 'new2'), { name: 'Minimal', status: 'active', createdAt: serverTimestamp() }),
    );
  });
  it('rejects invalid company additions', async () => {
    const bad: object[] = [
      { name: '' },
      { name: 'x'.repeat(121) },
      { status: 'pending' },
      { status: 'inactive' },
      { rating: 5 },
      { reviewCount: 3 },
      { ownerId: 'someone' },
      { city: 123 },
      { createdAt: new Date() },
    ];
    for (const extra of bad) {
      await assertFails(setDoc(doc(admin(), 'companies', 'bad'), newCompany(extra)));
    }
    const { name: _omit, ...withoutName } = newCompany();
    void _omit;
    await assertFails(setDoc(doc(admin(), 'companies', 'bad'), withoutName));
  });
  it('only an active Platform Admin can add a company', async () => {
    for (const uid of ['cust1', 'ca1', 'tech1', 'admin_off', 'admin_noflag']) {
      await assertFails(setDoc(doc(as(uid), 'companies', 'nope'), newCompany()));
    }
  });
  it('can delete a non-active company but not an active one', async () => {
    await assertSucceeds(deleteDoc(doc(admin(), 'companies', 'c_pending')));
    await assertSucceeds(deleteDoc(doc(admin(), 'companies', 'c_inactive')));
    await assertSucceeds(deleteDoc(doc(admin(), 'companies', 'c_rejected')));
    await assertFails(deleteDoc(doc(admin(), 'companies', 'c_active')));
    await assertFails(deleteDoc(doc(admin(), 'companies', 'c_legacy'))); // no status = active
  });
  it('nobody else can delete a company', async () => {
    for (const uid of ['cust1', 'ca1', 'tech1', 'admin_off']) {
      await assertFails(deleteDoc(doc(as(uid), 'companies', 'c_inactive')));
    }
  });
  it('company admin can still edit own profile but not its status', async () => {
    const db = as('ca1');
    await assertSucceeds(
      updateDoc(doc(db, 'companies', 'c_active'), { name: 'Renamed', ...profile, updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(doc(db, 'companies', 'c_active'), { status: 'inactive', updatedAt: serverTimestamp() }));
  });
  it('customer cannot change a company', async () => {
    await assertFails(
      updateDoc(doc(as('cust1'), 'companies', 'c_pending'), { status: 'active', updatedAt: serverTimestamp() }),
    );
  });
});

describe('Company lifecycle: hide, restore, delete', () => {
  // Reads with rules disabled, so it shows what is really stored.
  const exists = async (path: [string, string]) => {
    let found = false;
    await env.withSecurityRulesDisabled(async (ctx) => {
      found = (await getDoc(doc(ctx.firestore(), ...path))).exists();
    });
    return found;
  };

  it('deactivating and reactivating keeps the company and its products', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'companies', 'c_active'), { status: 'inactive', updatedAt: serverTimestamp() }),
    );
    expect(await exists(['products', 'p1'])).toBe(true);
    await assertSucceeds(
      updateDoc(doc(admin(), 'companies', 'c_active'), { status: 'active', updatedAt: serverTimestamp() }),
    );
    expect(await exists(['products', 'p1'])).toBe(true);
  });

  it('deleting a company with its products in one batch keeps order history', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', 'c_inactive'));
    batch.delete(doc(db, 'products', 'p_in1'));
    batch.delete(doc(db, 'products', 'p_in2'));
    await assertSucceeds(batch.commit());

    expect(await exists(['companies', 'c_inactive'])).toBe(false);
    expect(await exists(['products', 'p_in1'])).toBe(false);
    expect(await exists(['products', 'p_in2'])).toBe(false);
    // The historical order is still there, with its own copy of the names,
    // and Platform Admin can still read it.
    const order = await assertSucceeds(getDoc(doc(admin(), 'orders', 'o_hist')));
    expect(order.exists()).toBe(true);
    expect(order.data()?.companyName).toBe('Company c_inactive');
    expect(order.data()?.productName).toBe('Product p_in1');
    expect((await getDocs(collection(admin(), 'orders'))).size).toBe(2);
  });

  it('cannot delete a product of a company that still exists', async () => {
    await assertFails(deleteDoc(doc(admin(), 'products', 'p_in1')));
    const db = admin();
    const onlyProducts = writeBatch(db);
    onlyProducts.delete(doc(db, 'products', 'p_in1'));
    await assertFails(onlyProducts.commit());
    expect(await exists(['products', 'p_in1'])).toBe(true);
  });

  it('an active company cannot be deleted, even in a batch with its products', async () => {
    const db = admin();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', 'c_active'));
    batch.delete(doc(db, 'products', 'p1'));
    await assertFails(batch.commit());
    expect(await exists(['companies', 'c_active'])).toBe(true);
    expect(await exists(['products', 'p1'])).toBe(true);
  });

  it('can clean up leftover products once their company is gone', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'companies', 'c_inactive'));
    });
    await assertSucceeds(deleteDoc(doc(admin(), 'products', 'p_in1')));
  });

  it('orders can never be deleted, before or after a company is removed', async () => {
    await assertFails(deleteDoc(doc(admin(), 'orders', 'o_hist')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'companies', 'c_inactive'));
    });
    await assertFails(deleteDoc(doc(admin(), 'orders', 'o_hist')));
  });

  it('other roles still cannot delete products they do not own', async () => {
    await assertFails(deleteDoc(doc(as('cust1'), 'products', 'p1')));
    await assertFails(deleteDoc(doc(as('tech1'), 'products', 'p1')));
    await assertFails(deleteDoc(doc(as('admin_off'), 'products', 'p1')));
  });

  it('a company admin can still delete their own product (role unchanged)', async () => {
    await assertSucceeds(deleteDoc(doc(as('ca1'), 'products', 'p1')));
  });
});

describe('Orders with a deactivated company', () => {
  const order = (companyId: string) => ({
    id: 'o_new', customerId: 'cust1', companyId, companyName: 'C', productId: 'px', productName: 'Thing',
    quantity: 1, unitPrice: 10, productSubtotal: 10, installationSelected: false, installationFee: 0,
    deliveryFee: 0, totalAmount: 10, deliveryAddress: 'x', contactPhone: '1', deliveryMethod: 'delivery',
    customerName: 'N', paymentStatus: 'pending_verification', orderStatus: 'processing',
    receiptFileName: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const place = (companyId: string) => setDoc(doc(as('cust1'), 'orders', 'o_new'), order(companyId));

  it('cannot place an order with a deactivated, pending or rejected company', async () => {
    await assertFails(place('c_inactive'));
    await assertFails(place('c_pending'));
    await assertFails(place('c_rejected'));
  });
  it('can order again once the company is reactivated', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'companies', 'c_inactive'), { status: 'active', updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(place('c_inactive'));
  });
  it('active and legacy (no status) companies, and companies not in Firestore, still work', async () => {
    await assertSucceeds(place('c_active'));
    await env.clearFirestore();
    await seed();
    await assertSucceeds(place('c_legacy'));
    await seed();
    await assertSucceeds(place('demo_company_not_in_firestore'));
  });
});

describe('Customers', () => {
  it('lists customers (role filter) and reads one', async () => {
    const snap = await assertSucceeds(getDocs(query(collection(admin(), 'users'), where('role', '==', 'customer'))));
    expect(snap.size).toBe(2);
    await assertSucceeds(getDoc(doc(admin(), 'users', 'cust1')));
  });
  it('cannot list all users or read non-customer profiles', async () => {
    await assertFails(getDocs(collection(admin(), 'users')));
    await assertFails(getDocs(query(collection(admin(), 'users'), where('role', '==', 'company_admin'))));
    await assertFails(getDoc(doc(admin(), 'users', 'ca1')));
    await assertFails(getDoc(doc(admin(), 'users', 'tech1')));
  });
  it('can deactivate and reactivate a customer, keeping all other data', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust1'), { isActive: false }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = (await getDoc(doc(ctx.firestore(), 'users', 'cust1'))).data()!;
      expect(d.isActive).toBe(false);
      expect(d.fullName).toBe('Name cust1');
      expect(d.role).toBe('customer');
      expect((await getDoc(doc(ctx.firestore(), 'orders', 'o1'))).exists()).toBe(true);
    });
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust1'), { isActive: true }));
  });
  it('can edit the profile fields: full name and phone', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'users', 'cust1'), { fullName: 'Renamed', phone: '0922', updatedAt: serverTimestamp() }),
    );
    // A customer that never had a phone can be given one.
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust2'), { phone: '0933', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust2'), { fullName: 'Only Name', updatedAt: serverTimestamp() }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = (await getDoc(doc(ctx.firestore(), 'users', 'cust1'))).data()!;
      expect(d).toMatchObject({ fullName: 'Renamed', phone: '0922', role: 'customer', email: 'cust1@x.test', isActive: true });
    });
  });
  it('can edit and change the active flag in one write', async () => {
    await assertSucceeds(
      updateDoc(doc(admin(), 'users', 'cust1'), { fullName: 'Both', isActive: false, updatedAt: serverTimestamp() }),
    );
  });
  it('rejects invalid profile edits', async () => {
    for (const patch of [
      { fullName: '', updatedAt: serverTimestamp() },
      { fullName: 'x'.repeat(101), updatedAt: serverTimestamp() },
      { fullName: 42, updatedAt: serverTimestamp() },
      { phone: 42, updatedAt: serverTimestamp() },
      { phone: '1'.repeat(31), updatedAt: serverTimestamp() },
      { fullName: 'No timestamp' },
      { phone: '000' },
      { fullName: 'Client clock', updatedAt: new Date() },
      { isActive: 'no' },
      { isActive: null },
    ]) {
      await assertFails(updateDoc(doc(admin(), 'users', 'cust1'), patch));
    }
  });
  it('cannot change role, companyId, uid, email, createdAt or any other protected field', async () => {
    for (const patch of [
      { role: 'platform_admin' },
      { role: 'company_admin' },
      { role: 'technician' },
      { companyId: 'c_active' },
      { id: 'someone-else' },
      { uid: 'someone-else' },
      { email: 'x@x.test' },
      { createdAt: new Date() },
      { isAdmin: true },
      { fullName: 'Ok', role: 'platform_admin', updatedAt: serverTimestamp() },
      { fullName: 'Ok', companyId: 'c_active', updatedAt: serverTimestamp() },
      { fullName: 'Ok', email: 'x@x.test', updatedAt: serverTimestamp() },
      { isActive: false, role: 'company_admin' },
    ]) {
      await assertFails(updateDoc(doc(admin(), 'users', 'cust1'), patch));
    }
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = (await getDoc(doc(ctx.firestore(), 'users', 'cust1'))).data()!;
      expect(d).toMatchObject({ role: 'customer', id: 'cust1', email: 'cust1@x.test' });
      expect(d).not.toHaveProperty('companyId');
    });
  });
  it('deactivating keeps historical orders, and reactivating restores the customer', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust1'), { isActive: false }));
    expect((await assertSucceeds(getDoc(doc(admin(), 'orders', 'o_hist')))).exists()).toBe(true);
    expect((await assertSucceeds(getDoc(doc(admin(), 'orders', 'o1')))).exists()).toBe(true);
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust1'), { isActive: true }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await getDoc(doc(ctx.firestore(), 'users', 'cust1'))).data()?.isActive).toBe(true);
    });
  });
  it('other roles cannot use the customer-management permissions', async () => {
    const edit = { fullName: 'Hijack', updatedAt: serverTimestamp() };
    for (const uid of ['cust1', 'cust2', 'ca1', 'tech1', 'admin_off', 'admin_noflag']) {
      const db = as(uid);
      if (uid !== 'cust1') await assertFails(updateDoc(doc(db, 'users', 'cust1'), edit));
      if (uid !== 'cust1') await assertFails(updateDoc(doc(db, 'users', 'cust1'), { isActive: false }));
      if (uid !== 'cust2') await assertFails(updateDoc(doc(db, 'users', 'cust2'), { isActive: false }));
    }
    await assertFails(getDocs(query(collection(as('ca1'), 'users'), where('role', '==', 'customer'))));
    await assertFails(getDocs(query(collection(as('tech1'), 'users'), where('role', '==', 'customer'))));
  });
  it('a platform admin cannot edit other admins or staff', async () => {
    await assertFails(updateDoc(doc(admin(), 'users', 'admin_off'), { fullName: 'x', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin(), 'users', 'ca1'), { fullName: 'x', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(admin(), 'users', 'tech1'), { phone: '1', updatedAt: serverTimestamp() }));
  });
  it('new customer self-registration (what Add Customer relies on) still works', async () => {
    const ok = {
      id: 'fresh', fullName: 'Fresh', email: 'fresh@x.test', role: 'customer', isActive: true, createdAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(as('fresh'), 'users', 'fresh'), ok));
    // ...but nobody can register as anything else, inactive, or with extra keys.
    await assertFails(setDoc(doc(as('f2'), 'users', 'f2'), { ...ok, id: 'f2', role: 'platform_admin' }));
    await assertFails(setDoc(doc(as('f3'), 'users', 'f3'), { ...ok, id: 'f3', isActive: false }));
    await assertFails(setDoc(doc(as('f4'), 'users', 'f4'), { ...ok, id: 'f4', phone: '1' }));
    await assertFails(setDoc(doc(as('f5'), 'users', 'f5'), { ...ok, id: 'f5', companyId: 'c_active' }));
  });
  // A real customer deletion also has to remove the Firebase Authentication
  // account, which the client SDK cannot do for someone else. Deleting only the
  // profile would leave a working login, so no role may delete a user document.
  it('a customer profile can never be deleted through the client, by anyone', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust1'), { isActive: false }));
    for (const uid of ['admin', 'admin_off', 'cust1', 'cust2', 'ca1', 'tech1']) {
      await assertFails(deleteDoc(doc(as(uid), 'users', 'cust1')));
    }
    for (const target of ['admin', 'ca1', 'tech1']) {
      await assertFails(deleteDoc(doc(admin(), 'users', target)));
    }
    // Nothing was removed: profiles and the customers' order history are intact.
    for (const path of [
      ['users', 'cust1'], ['users', 'cust2'], ['users', 'ca1'], ['users', 'tech1'],
      ['orders', 'o1'], ['orders', 'o_hist'], ['companies', 'c_active'], ['products', 'p1'],
    ] as [string, string][]) {
      let found = false;
      await env.withSecurityRulesDisabled(async (ctx) => {
        found = (await getDoc(doc(ctx.firestore(), ...path))).exists();
      });
      expect(found, path.join('/')).toBe(true);
    }
  });
  it('cannot deactivate non-customers, create or delete customers', async () => {
    await assertFails(updateDoc(doc(admin(), 'users', 'ca1'), { isActive: false }));
    await assertFails(updateDoc(doc(admin(), 'users', 'tech1'), { isActive: false }));
    await assertFails(updateDoc(doc(admin(), 'users', 'admin_off'), { isActive: true }));
    await assertFails(
      setDoc(doc(admin(), 'users', 'newcust'), {
        id: 'newcust', fullName: 'N', email: 'n@x.test', role: 'customer', isActive: true, createdAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(doc(admin(), 'users', 'cust1')));
  });
  it('customers cannot read others or reactivate themselves', async () => {
    await assertFails(getDoc(doc(as('cust1'), 'users', 'cust2')));
    await assertFails(getDocs(query(collection(as('cust1'), 'users'), where('role', '==', 'customer'))));
    await assertFails(updateDoc(doc(as('cust2'), 'users', 'cust2'), { isActive: false }));
  });
  it('customer can still update own name/phone', async () => {
    await assertSucceeds(updateDoc(doc(as('cust1'), 'users', 'cust1'), { fullName: 'New', updatedAt: serverTimestamp() }));
  });
});

describe('A deactivated customer cannot use the customer app', () => {
  const order = (uid: string) => ({
    id: 'o_dead', customerId: uid, companyId: 'c_active', companyName: 'C', productId: 'p1', productName: 'Router',
    quantity: 1, unitPrice: 10, productSubtotal: 10, installationSelected: false, installationFee: 0,
    deliveryFee: 0, totalAmount: 10, deliveryAddress: 'x', contactPhone: '1', deliveryMethod: 'delivery',
    customerName: 'N', paymentStatus: 'pending_verification', orderStatus: 'processing',
    receiptFileName: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  const deactivate = () =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'users', 'cust1'), { isActive: false });
    });

  it('cannot place an order or attach a receipt once deactivated, but can again after reactivation', async () => {
    await deactivate();
    await assertFails(setDoc(doc(as('cust1'), 'orders', 'o_dead'), order('cust1')));
    await assertFails(updateDoc(doc(as('cust1'), 'orders', 'o1'), { receiptFileName: 'r.jpg', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin(), 'users', 'cust1'), { isActive: true }));
    await assertSucceeds(setDoc(doc(as('cust1'), 'orders', 'o_dead'), order('cust1')));
    await assertSucceeds(updateDoc(doc(as('cust1'), 'orders', 'o1'), { receiptFileName: 'r.jpg', updatedAt: serverTimestamp() }));
  });
  it('active customers, and users without a profile document, are unaffected', async () => {
    await assertSucceeds(setDoc(doc(as('cust2'), 'orders', 'o_dead'), order('cust2')));
    await assertSucceeds(setDoc(doc(as('no_profile_user'), 'orders', 'o_dead2'), { ...order('no_profile_user'), id: 'o_dead2' }));
  });
  it('a deactivated customer keeps their history readable by the admin', async () => {
    await deactivate();
    expect((await assertSucceeds(getDoc(doc(admin(), 'orders', 'o1')))).exists()).toBe(true);
  });
});

describe('Products (read-only)', () => {
  it('can list and read', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'products')));
    await assertSucceeds(getDoc(doc(admin(), 'products', 'p1')));
  });
  it('cannot edit, toggle stock, reassign, create or delete', async () => {
    for (const patch of [
      { inStock: false },
      { price: 1 },
      { stockCount: 0 },
      { isDeliveryAvailable: false },
      { isInstallationAvailable: true },
      { companyId: 'c_pending' },
    ]) {
      await assertFails(updateDoc(doc(admin(), 'products', 'p1'), patch));
    }
    await assertFails(deleteDoc(doc(admin(), 'products', 'p1')));
    await assertFails(setDoc(doc(admin(), 'products', 'p2'), { id: 'p2', companyId: 'c_active', name: 'x' }));
  });
});

describe('Orders (read-only)', () => {
  const now = () => serverTimestamp();
  it('can list and read', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'orders')));
    await assertSucceeds(getDoc(doc(admin(), 'orders', 'o1')));
  });
  it('cannot change status, payment, technician or any info, nor delete', async () => {
    for (const patch of [
      { orderStatus: 'out_for_delivery', updatedAt: now() },
      { orderStatus: 'completed' },
      { paymentStatus: 'confirmed', updatedAt: now() },
      { technicianId: 't1', technicianName: 'T', updatedAt: now() },
      { customerName: 'X' },
      { companyName: 'X' },
      { productName: 'X' },
      { contactPhone: '9' },
    ]) {
      await assertFails(updateDoc(doc(admin(), 'orders', 'o1'), patch));
    }
    await assertFails(deleteDoc(doc(admin(), 'orders', 'o1')));
  });
  const newOrder = (customerId: string) => ({
    id: 'o2', customerId, companyId: 'c_active', companyName: 'C', productId: 'p1', productName: 'Router',
    quantity: 1, unitPrice: 100, productSubtotal: 100, installationSelected: false, installationFee: 0,
    deliveryFee: 0, totalAmount: 100, deliveryAddress: 'x', contactPhone: '1', deliveryMethod: 'delivery',
    customerName: 'N', paymentStatus: 'pending_verification', orderStatus: 'processing',
    receiptFileName: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  it('cannot create an order', async () => {
    await assertFails(setDoc(doc(admin(), 'orders', 'o2'), newOrder('admin')));
  });
  it('customer can still place their own order (customer role unchanged)', async () => {
    await assertSucceeds(setDoc(doc(as('cust1'), 'orders', 'o2'), newOrder('cust1')));
  });
  it('company admin can still advance an order (company admin role unchanged)', async () => {
    await assertSucceeds(
      updateDoc(doc(as('ca1'), 'orders', 'o1'), { orderStatus: 'out_for_delivery', updatedAt: serverTimestamp() }),
    );
  });
});

describe('Categories', () => {
  const category = { id: 'k2', name: 'New', description: 'd', iconName: '', isActive: true };
  it('can list, create, edit and toggle', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'categories')));
    await assertSucceeds(setDoc(doc(admin(), 'categories', 'k2'), { ...category, createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'k1'), { name: 'Renamed', description: 'x', iconName: 'i' }));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'k1'), { isActive: false }));
    await assertSucceeds(updateDoc(doc(admin(), 'categories', 'k1'), { isActive: true }));
  });
  it('keeps the safe field restrictions', async () => {
    await assertFails(updateDoc(doc(admin(), 'categories', 'k1'), { createdAt: new Date() }));
    await assertFails(updateDoc(doc(admin(), 'categories', 'k1'), { id: 'other' }));
    await assertFails(updateDoc(doc(admin(), 'categories', 'k1'), { extra: 1 }));
    await assertFails(updateDoc(doc(admin(), 'categories', 'k1'), { name: '' }));
    await assertFails(setDoc(doc(admin(), 'categories', 'k3'), { ...category, id: 'k3', isActive: false, createdAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(admin(), 'categories', 'k1')));
  });
  it('non-admins cannot write', async () => {
    await assertFails(setDoc(doc(as('cust1'), 'categories', 'k2'), { ...category, createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('ca1'), 'categories', 'k1'), { isActive: false }));
  });
});

describe('Reviews (read-only, admin only)', () => {
  it('can list and read', async () => {
    await assertSucceeds(getDocs(collection(admin(), 'reviews')));
    await assertSucceeds(getDoc(doc(admin(), 'reviews', 'r1')));
  });
  it('cannot create, edit or delete', async () => {
    await assertFails(setDoc(doc(admin(), 'reviews', 'r2'), { rating: 5 }));
    await assertFails(updateDoc(doc(admin(), 'reviews', 'r1'), { rating: 1 }));
    await assertFails(deleteDoc(doc(admin(), 'reviews', 'r1')));
  });
  it('other roles have no access', async () => {
    await assertFails(getDocs(collection(as('cust1'), 'reviews')));
    await assertFails(getDocs(collection(as('ca1'), 'reviews')));
    await assertFails(getDocs(collection(as('tech1'), 'reviews')));
  });
});

describe('Profile', () => {
  it('reads own profile', async () => {
    const snap = await assertSucceeds(getDoc(doc(admin(), 'users', 'admin')));
    expect(snap.data()?.role).toBe('platform_admin');
  });
  it('cannot change own role or active flag, or delete', async () => {
    await assertFails(updateDoc(doc(admin(), 'users', 'admin'), { role: 'customer' }));
    await assertFails(updateDoc(doc(admin(), 'users', 'admin'), { isActive: false }));
    await assertFails(deleteDoc(doc(admin(), 'users', 'admin')));
  });
});

describe('services stay untouched', () => {
  it('active admin keeps its existing read/update access (rule unchanged)', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'services', 's1')));
    await assertSucceeds(updateDoc(doc(admin(), 'services', 's1'), { isActive: false }));
  });
});
