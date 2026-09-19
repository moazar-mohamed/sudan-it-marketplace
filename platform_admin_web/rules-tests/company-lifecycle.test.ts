/*
 * Company lifecycle: creation links everything by the exact generated id, and
 * deleting a company cascades to its people and data while ORDERS ARE KEPT.
 * Runs the real dashboard code (createCompanyWithAdminAccount, deleteCompanyCascade)
 * against the Auth + Firestore emulators with the project's rules. Local only.
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
import { deleteCompanyCascade, findCompanyOwnedData } from '../src/data/deleteCompany';
import {
  createCompanyWithAdminAccount,
  secondaryAppProvisioner,
  type NewCompanyInput,
  type ProvisionDeps,
} from '../src/data/provisionCompany';

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const PROJECT = 'demo-sudan-rules';
const fakeConfig = { apiKey: 'fake-api-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` };
const now = new Date();

let env: RulesTestEnvironment;

beforeAll(async () => {
  if (!authHost) return;
  env = await initializeTestEnvironment({
    projectId: PROJECT,
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

beforeEach(async () => {
  if (!authHost) return;
  await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, role, extra] of [
      ['admin', 'platform_admin', {}],
      ['cust1', 'customer', {}],
      ['cust2', 'customer', {}],
    ] as const) {
      await setDoc(doc(db, 'users', id), {
        id,
        fullName: id,
        email: `${id}@x.test`,
        role,
        isActive: true,
        createdAt: now,
        ...extra,
      });
    }
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

const input = (name: string, email: string): NewCompanyInput => ({
  name,
  description: '',
  city: '',
  address: 'Street 1',
  latitude: null,
  longitude: null,
  phone: '',
  email,
  pickupAddress: '',
  initialPassword: 'Pass@2026',
});

const provisionDeps = (): ProvisionDeps => ({
  db: as('admin'),
  provisionAccount: secondaryAppProvisioner(fakeConfig, { authEmulatorUrl: `http://${authHost}` }),
  resolveLogo: async () => '',
});

/** Creates a company the way the dashboard does and returns its ids. */
const createCompany = (name: string, email: string) =>
  createCompanyWithAdminAccount(input(name, email), provisionDeps());

const productDoc = (id: string, companyId: string, extra: Record<string, unknown> = {}) => ({
  id,
  companyId,
  companyName: 'x',
  name: `Product ${id}`,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 5,
  inStock: true,
  description: '',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  installationPrice: null,
  ...extra,
});

/** Everything the company admin can create for their own company. */
async function addCompanyData(companyId: string, adminUid: string, tag: string) {
  const db = as(adminUid);
  await assertSucceeds(
    setDoc(doc(db, 'products', `${tag}-p1`), {
      ...productDoc(`${tag}-p1`, companyId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    setDoc(doc(db, 'products', `${tag}-p2`), {
      ...productDoc(`${tag}-p2`, companyId, { price: null }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  const email = `${tag.toLowerCase()}.tech@x.test`; // invite ids are lowercase emails
  await assertSucceeds(
    setDoc(doc(db, 'technicianInvites', email), {
      email,
      fullName: `${tag} tech`,
      phone: '1',
      companyId,
      status: 'pending',
      createdAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    setDoc(doc(db, 'technicians', `${tag}-t1`), {
      id: `${tag}-t1`,
      companyId,
      fullName: `${tag} Tech One`,
      phone: '1',
      email: `${tag}.t1@x.test`,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Data that only exists after real use: staff profiles, notifications, orders... */
async function seedUsage(companyId: string, tag: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', `${tag}-t1`), {
      id: `${tag}-t1`,
      fullName: `${tag} Tech One`,
      email: `${tag}.t1@x.test`,
      role: 'technician',
      companyId,
      isActive: true,
      createdAt: now,
    });
    const note = (id: string, recipientType: string, recipientId: string) =>
      setDoc(doc(db, 'notifications', id), { id, recipientType, recipientId, orderId: `${tag}-o1`, isRead: false, createdAt: now });
    await note(`${tag}-n-admin`, 'company_admin', companyId);
    await note(`${tag}-n-tech`, 'technician', `${tag}-t1`);
    await note(`${tag}-n-cust`, 'customer', 'cust1'); // a customer's own notification: must stay
    await setDoc(doc(db, 'company_services', `${tag}-s1`), { id: `${tag}-s1`, companyId, isActive: true, name: 'Install' });
    await setDoc(doc(db, 'reviews', `${tag}-r1`), { rating: 5, comment: 'ok', companyId });
    await setDoc(doc(db, 'orders', `${tag}-o1`), {
      id: `${tag}-o1`,
      customerId: 'cust1',
      companyId,
      companyName: `Company ${tag}`,
      productId: `${tag}-p1`,
      productName: `Product ${tag}-p1`,
      quantity: 1,
      unitPrice: 100,
      productSubtotal: 100,
      installationSelected: true,
      installationFee: 10,
      deliveryFee: 5,
      totalAmount: 115,
      deliveryAddress: 'Somewhere',
      contactPhone: '1',
      deliveryMethod: 'delivery',
      paymentStatus: 'confirmed',
      orderStatus: 'completed',
      technicianId: `${tag}-t1`,
      technicianName: `${tag} Tech One`,
      createdAt: now,
      updatedAt: now,
    });
  });
}

const deactivate = (companyId: string) =>
  updateDoc(doc(as('admin'), 'companies', companyId), { status: 'inactive', updatedAt: serverTimestamp() });

const exists = async (...path: [string, string]) => {
  let found = false;
  await env.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(ctx.firestore(), ...path))).exists();
  });
  return found;
};

const allOrders = async () => {
  const out: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    (await getDocs(collection(ctx.firestore(), 'orders'))).forEach((d) => (out[d.id] = d.data()));
  });
  return out;
};

/** Company A and company B, each with data and history. */
async function twoCompanies() {
  const a = await createCompany('Company A', 'a@company.test');
  const b = await createCompany('Company B', 'b@company.test');
  await addCompanyData(a.companyId, a.uid, 'A');
  await addCompanyData(b.companyId, b.uid, 'B');
  await seedUsage(a.companyId, 'A');
  await seedUsage(b.companyId, 'B');
  return { a, b };
}

describe.skipIf(!authHost)('creating a company links everything by the exact generated id', () => {
  it('1. creates the company at companies/{companyId}', async () => {
    const { companyId } = await createCompany('Company A', 'a@company.test');
    expect(companyId).toMatch(/^[A-Za-z0-9]{20}$/); // a Firestore-generated id, not typed by hand
    expect(await exists('companies', companyId)).toBe(true);
    // ...and it is the only company document created
    const all = await getDocs(collection(as('admin'), 'companies'));
    expect(all.docs.map((d) => d.id)).toEqual([companyId]);
  });

  it('2. the admin profile carries exactly the same companyId (case-sensitive)', async () => {
    const { companyId, uid } = await createCompany('Company A', 'a@company.test');
    let profile: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      profile = (await getDoc(doc(ctx.firestore(), 'users', uid))).data();
    });
    expect(profile?.companyId).toBe(companyId);
    expect(profile?.companyId === companyId).toBe(true); // strict, no case folding
    expect(typeof profile?.companyId).toBe('string');
  });

  it('3. products created by the company admin use the same company id', async () => {
    const { companyId, uid } = await createCompany('Company A', 'a@company.test');
    await addCompanyData(companyId, uid, 'A');
    const snap = await getDocs(query(collection(as('admin'), 'products'), where('companyId', '==', companyId)));
    expect(snap.size).toBe(2);
    // the same product with the id typed in a different case is refused
    const other = companyId.toLowerCase() === companyId ? companyId.toUpperCase() : companyId.toLowerCase();
    await assertFails(
      setDoc(doc(as(uid), 'products', 'wrong-case'), {
        ...productDoc('wrong-case', other),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('4. technicians and technician invites use the same company id', async () => {
    const { companyId, uid } = await createCompany('Company A', 'a@company.test');
    await addCompanyData(companyId, uid, 'A');
    const admin = as('admin');
    const techs = await getDocs(query(collection(admin, 'technicians'), where('companyId', '==', companyId)));
    const invites = await getDocs(query(collection(admin, 'technicianInvites'), where('companyId', '==', companyId)));
    expect([techs.size, invites.size]).toEqual([1, 1]);

    const other = companyId.toLowerCase() === companyId ? companyId.toUpperCase() : companyId.toLowerCase();
    await assertFails(
      setDoc(doc(as(uid), 'technicianInvites', 'x@x.test'), {
        email: 'x@x.test',
        fullName: 'X',
        phone: '1',
        companyId: other,
        status: 'pending',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('12. the C1 / c1 mismatch cannot happen for a new company', async () => {
    const { companyId } = await createCompany('Company A', 'a@company.test');
    const db = as('admin');

    // a profile can only link to the company created in the same batch, by its exact id
    const batch = writeBatch(db);
    batch.set(doc(db, 'companies', 'c1'), {
      name: 'x', logoUrl: '', description: '', city: '', address: '', phone: '', email: 'x@x.test',
      pickupAddress: '', rating: 0, reviewCount: 0, status: 'active',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', 'someUid'), {
      id: 'someUid', fullName: 'x', email: 'x@x.test', role: 'company_admin', companyId: 'C1',
      isActive: true, mustChangePassword: true, createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());

    // and it can never be attached to a company that already exists
    await assertFails(
      setDoc(doc(db, 'users', 'someUid2'), {
        id: 'someUid2', fullName: 'x', email: 'a@company.test', role: 'company_admin', companyId,
        isActive: true, mustChangePassword: true, createdAt: serverTimestamp(),
      }),
    );
  });
});

describe.skipIf(!authHost)('deleting a company cascades, but keeps every order', () => {
  it('5-8. deletes the products, employees, invitations and the company admin profile', async () => {
    const { a } = await twoCompanies();
    await deactivate(a.companyId);

    const summary = await deleteCompanyCascade(as('admin'), a.companyId);

    expect(summary.companyDeleted).toBe(true);
    expect(await exists('companies', a.companyId)).toBe(false);
    // 5. products
    expect(await exists('products', 'A-p1')).toBe(false);
    expect(await exists('products', 'A-p2')).toBe(false);
    // 6. employees (record + profile)
    expect(await exists('technicians', 'A-t1')).toBe(false);
    expect(await exists('users', 'A-t1')).toBe(false);
    // 7. invitations
    expect(await exists('technicianInvites', 'a.tech@x.test')).toBe(false);
    // 8. the company admin's profile
    expect(await exists('users', a.uid)).toBe(false);
    // other company-owned data
    expect(await exists('company_services', 'A-s1')).toBe(false);
    expect(await exists('reviews', 'A-r1')).toBe(false);
    expect(await exists('notifications', 'A-n-admin')).toBe(false);
    expect(await exists('notifications', 'A-n-tech')).toBe(false);
    expect(summary).toMatchObject({ admins: 1, technicians: 1, invites: 1, products: 2, ordersKept: 1 });
    expect(summary.other).toBe(4); // service, review, admin + technician notification
  });

  it('9-10. never deletes an order, and orders stay readable as history', async () => {
    const { a, b } = await twoCompanies();
    const before = await allOrders();
    await deactivate(a.companyId);

    await deleteCompanyCascade(as('admin'), a.companyId);

    expect(await allOrders()).toEqual(before); // identical documents, none removed
    // still readable by the customer who placed it and by Platform Admin, though the
    // company, its product and its technician are gone
    const order = (await assertSucceeds(getDoc(doc(as('cust1'), 'orders', 'A-o1')))).data();
    expect(order?.productName).toBe('Product A-p1');
    expect(order?.technicianName).toBe('A Tech One');
    expect(order?.companyId).toBe(a.companyId);
    await assertSucceeds(getDoc(doc(as('admin'), 'orders', 'A-o1')));
    const history = await assertSucceeds(getDocs(query(collection(as('admin'), 'orders'), where('companyId', '==', a.companyId))));
    expect(history.size).toBe(1);
    expect(await exists('products', 'A-p1')).toBe(false);
    expect(await exists('technicians', 'A-t1')).toBe(false);
    expect(b.companyId).not.toBe(a.companyId);
  });

  it('orders cannot be deleted by anyone, including Platform Admin', async () => {
    const { a } = await twoCompanies();
    await assertFails(deleteDoc(doc(as('admin'), 'orders', 'A-o1')));
    await assertFails(deleteDoc(doc(as('cust1'), 'orders', 'A-o1')));
    await assertFails(deleteDoc(doc(as(a.uid), 'orders', 'A-o1')));
    expect(await exists('orders', 'A-o1')).toBe(true);
  });

  it('11. deleting Company A leaves Company B completely untouched', async () => {
    const { a, b } = await twoCompanies();
    await deactivate(a.companyId);
    await deleteCompanyCascade(as('admin'), a.companyId);

    expect(await exists('companies', b.companyId)).toBe(true);
    expect(await exists('users', b.uid)).toBe(true);
    for (const [col, id] of [
      ['products', 'B-p1'], ['products', 'B-p2'], ['technicians', 'B-t1'], ['users', 'B-t1'],
      ['technicianInvites', 'b.tech@x.test'], ['company_services', 'B-s1'], ['reviews', 'B-r1'],
      ['notifications', 'B-n-admin'], ['notifications', 'B-n-tech'], ['orders', 'B-o1'],
    ] as const) {
      expect(await exists(col, id), `${col}/${id}`).toBe(true);
    }
    // B's admin is still linked to B, exactly
    let profile: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      profile = (await getDoc(doc(ctx.firestore(), 'users', b.uid))).data();
    });
    expect(profile?.companyId).toBe(b.companyId);
  });

  it('keeps customers, customer notifications and Platform Admin', async () => {
    const { a } = await twoCompanies();
    await deactivate(a.companyId);
    await deleteCompanyCascade(as('admin'), a.companyId);
    expect(await exists('users', 'cust1')).toBe(true);
    expect(await exists('users', 'admin')).toBe(true);
    expect(await exists('notifications', 'A-n-cust')).toBe(true);
  });

  it('is safe to run again (idempotent)', async () => {
    const { a } = await twoCompanies();
    await deactivate(a.companyId);
    const first = await deleteCompanyCascade(as('admin'), a.companyId);
    const second = await deleteCompanyCascade(as('admin'), a.companyId);
    expect(first.products).toBe(2);
    expect(second).toMatchObject({ companyDeleted: false, admins: 0, technicians: 0, invites: 0, products: 0, other: 0, ordersKept: 1 });
  });

  it('finishes cleaning a company whose document is already gone (the old C1 case)', async () => {
    // Data left behind under a hand-typed id, with no company document at all.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'oldAdmin'), { id: 'oldAdmin', role: 'company_admin', companyId: 'C1' });
      await setDoc(doc(db, 'users', 'oldTech'), { id: 'oldTech', role: 'technician', companyId: 'C1', email: 't@x.test' });
      await setDoc(doc(db, 'technicians', 'oldTech'), { id: 'oldTech', companyId: 'C1', fullName: 'T', email: 't@x.test' });
      await setDoc(doc(db, 'technicianInvites', 't@x.test'), { email: 't@x.test', companyId: 'C1', status: 'claimed' });
      await setDoc(doc(db, 'products', 'oldP'), productDoc('oldP', 'C1'));
      await setDoc(doc(db, 'notifications', 'oldN1'), { recipientType: 'company_admin', recipientId: 'C1', orderId: 'oldO' });
      await setDoc(doc(db, 'notifications', 'oldN2'), { recipientType: 'technician', recipientId: 'oldTech', orderId: 'oldO' });
      await setDoc(doc(db, 'orders', 'oldO'), { id: 'oldO', customerId: 'cust1', companyId: 'C1', productName: 'Old', totalAmount: 5 });
      // an unrelated real company that must not be touched
      await setDoc(doc(db, 'products', 'otherP'), productDoc('otherP', 'someOtherCompany'));
    });

    const summary = await deleteCompanyCascade(as('admin'), 'C1');

    expect(summary.companyDeleted).toBe(false);
    for (const [col, id] of [
      ['users', 'oldAdmin'], ['users', 'oldTech'], ['technicians', 'oldTech'],
      ['technicianInvites', 't@x.test'], ['products', 'oldP'], ['notifications', 'oldN1'], ['notifications', 'oldN2'],
    ] as const) {
      expect(await exists(col, id), `${col}/${id}`).toBe(false);
    }
    expect(await exists('orders', 'oldO')).toBe(true); // history kept
    expect(await exists('products', 'otherP')).toBe(true); // other company untouched
    expect(summary.ordersKept).toBe(1);
  });

  it('handles a large company (more than one batch)', async () => {
    const { a } = await twoCompanies();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let start = 0; start < 620; start += 300) {
        const batch = writeBatch(db);
        for (let i = start; i < Math.min(start + 300, 620); i++) {
          batch.set(doc(db, 'products', `bulk-${i}`), productDoc(`bulk-${i}`, a.companyId));
        }
        await batch.commit();
      }
    });
    await deactivate(a.companyId);

    const summary = await deleteCompanyCascade(as('admin'), a.companyId);

    expect(summary.products).toBe(622); // 620 bulk + A-p1, A-p2
    const left = await getDocs(query(collection(as('admin'), 'products'), where('companyId', '==', a.companyId)));
    expect(left.size).toBe(0);
    expect(await exists('products', 'B-p1')).toBe(true);
    expect(await exists('orders', 'A-o1')).toBe(true);
  });

  it('refuses to delete an ACTIVE company and removes nothing', async () => {
    const { a } = await twoCompanies();
    await expect(deleteCompanyCascade(as('admin'), a.companyId)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await exists('companies', a.companyId)).toBe(true);
    expect(await exists('products', 'A-p1')).toBe(true);
    expect(await exists('users', a.uid)).toBe(true);
  });

  it('the rules do not let anyone delete a live company\'s data one piece at a time', async () => {
    const { a } = await twoCompanies();
    const admin = as('admin');
    await assertFails(deleteDoc(doc(admin, 'products', 'A-p1')));
    await assertFails(deleteDoc(doc(admin, 'technicians', 'A-t1')));
    await assertFails(deleteDoc(doc(admin, 'technicianInvites', 'a.tech@x.test')));
    await assertFails(deleteDoc(doc(admin, 'users', a.uid)));
    await assertFails(deleteDoc(doc(admin, 'users', 'A-t1')));
    await assertFails(deleteDoc(doc(admin, 'notifications', 'A-n-admin')));
    // and no role can delete customers or Platform Admin profiles
    await assertFails(deleteDoc(doc(admin, 'users', 'cust1')));
    await assertFails(deleteDoc(doc(admin, 'users', 'admin')));
    // a customer's own notification is never deletable, even for a deleted company
    await deactivate(a.companyId);
    await deleteCompanyCascade(admin, a.companyId);
    await assertFails(deleteDoc(doc(admin, 'notifications', 'A-n-cust')));
    // a company admin / customer cannot use the cascade rules
    await assertFails(deleteDoc(doc(as('cust1'), 'products', 'B-p1')));
  });

  it('finds the listed data before anything is deleted (read-only); staff profiles only once the company is gone', async () => {
    const { a } = await twoCompanies();
    const found = await findCompanyOwnedData(as('admin'), a.companyId);
    expect(found.company?.path).toBe(`companies/${a.companyId}`);
    expect(found.technicians.map((r) => r.path)).toEqual(['technicians/A-t1']);
    expect(found.invites.map((r) => r.path)).toEqual(['technicianInvites/a.tech@x.test']);
    expect(found.products.map((r) => r.path).sort()).toEqual(['products/A-p1', 'products/A-p2']);
    expect(found.adminNotifications.map((r) => r.path)).toEqual(['notifications/A-n-admin']);
    expect(found.technicianNotifications.map((r) => r.path)).toEqual(['notifications/A-n-tech']);
    // A live company's people are NOT visible to Platform Admin.
    expect(found.admins).toEqual([]);
    expect(found.technicianProfiles).toEqual([]);
    // nothing was deleted by looking
    expect(await exists('companies', a.companyId)).toBe(true);
    expect(await exists('orders', 'A-o1')).toBe(true);
  });

  it('Platform Admin cannot read the people of a live company, only orphaned ones', async () => {
    const { a } = await twoCompanies();
    const admin = as('admin');
    await assertFails(getDoc(doc(admin, 'users', a.uid))); // company admin of a live company
    await assertFails(getDoc(doc(admin, 'users', 'A-t1'))); // its technician
    await assertFails(
      getDocs(query(collection(admin, 'users'), where('companyId', '==', a.companyId), where('role', '==', 'company_admin'))),
    );
    await assertFails(getDocs(collection(admin, 'users'))); // no blanket listing

    await deactivate(a.companyId);
    await deleteCompanyCascade(admin, a.companyId);

    // Company B is still live: its people are still unreadable.
    const b = await getDocs(query(collection(admin, 'products'), where('id', '==', 'B-p1')));
    expect(b.size).toBe(1);
  });

  it('after the company is gone, its leftover profiles are readable by Platform Admin (cleanup)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'orphanAdmin'), { id: 'orphanAdmin', role: 'company_admin', companyId: 'GoneCo' });
    });
    await assertSucceeds(getDoc(doc(as('admin'), 'users', 'orphanAdmin')));
    const list = await assertSucceeds(
      getDocs(query(collection(as('admin'), 'users'), where('companyId', '==', 'GoneCo'), where('role', '==', 'company_admin'))),
    );
    expect(list.size).toBe(1);
  });
});
