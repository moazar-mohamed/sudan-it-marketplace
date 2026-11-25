/*
 * The notices added 2026-11-18: the customer hears a technician was sent for
 * their order (from the order's company), and a company hears of Platform
 * Admin's decisions on it (status, reviews, services, offers). Local emulator
 * only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

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
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

const order = (id: string, technicianId: string | null) =>
  put(`orders/${id}`, {
    id,
    customerId: 'cust1',
    companyId: 'c1',
    productId: 'p1',
    productName: 'Router',
    quantity: 1,
    orderStatus: 'processing',
    paymentStatus: 'confirmed',
    installationSelected: true,
    technicianId,
    technicianName: technicianId ? 'Tech' : null,
    totalAmount: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, createdAt: new Date(), ...extra });
  await user('pa', 'platform_admin');
  await user('cust1', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('ca2', 'company_admin', { companyId: 'c2' });
  for (const id of ['c1', 'c2']) {
    await put(`companies/${id}`, { name: id, status: 'active', rating: 0, reviewCount: 0, createdAt: new Date() });
  }
  await order('o1', 't1');
  await order('o2', null);
});

const assigned = (orderId: string, sender: string) => ({
  id: `${orderId}_order_technician_assigned`,
  recipientType: 'customer',
  recipientId: 'cust1',
  orderId,
  type: 'order_technician_assigned',
  productName: 'Router',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId: sender,
});

describe('a technician sent for the order, told to the customer', () => {
  it('the order\'s company admin may tell the customer once a technician is set', async () => {
    await assertSucceeds(setDoc(doc(as('ca1'), 'notifications/o1_order_technician_assigned'), assigned('o1', 'ca1')));
  });

  it('not before the order has a technician', async () => {
    await assertFails(setDoc(doc(as('ca1'), 'notifications/o2_order_technician_assigned'), assigned('o2', 'ca1')));
  });

  it('not from another company, nor from the customer', async () => {
    await assertFails(setDoc(doc(as('ca2'), 'notifications/o1_order_technician_assigned'), assigned('o1', 'ca2')));
    await assertFails(setDoc(doc(as('cust1'), 'notifications/o1_order_technician_assigned'), assigned('o1', 'cust1')));
  });
});

const companyNotice = (id: string, type: string, extra: Record<string, unknown> = {}, sender = 'pa') => ({
  id,
  recipientType: 'company_admin',
  recipientId: 'c1',
  type,
  productName: 'c1',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId: sender,
  ...extra,
});

describe('Platform Admin tells a company of a decision on it', () => {
  it('each kind may be sent by Platform Admin', async () => {
    const kinds: [string, Record<string, unknown>][] = [
      ['company_activated', {}],
      ['company_deactivated', {}],
      ['company_rejected', {}],
      ['review_hidden', { reviewId: 'r1' }],
      ['review_shown', { reviewId: 'r1' }],
      ['service_hidden', { serviceId: 's1' }],
      ['service_shown', { serviceId: 's1' }],
      ['product_offer_ended', { productId: 'p1' }],
      ['service_offer_ended', { companyServiceId: 'cs1' }],
    ];
    for (const [type, extra] of kinds) {
      await assertSucceeds(setDoc(doc(as('pa'), `notifications/n_${type}`), companyNotice(`n_${type}`, type, extra)));
    }
  });

  it('a company admin may not send them', async () => {
    await assertFails(setDoc(doc(as('ca1'), 'notifications/n1'), companyNotice('n1', 'company_activated', {}, 'ca1')));
  });

  it('not to a company that does not exist, nor of another kind, nor with free text', async () => {
    await assertFails(setDoc(doc(as('pa'), 'notifications/n2'), { ...companyNotice('n2', 'company_activated'), recipientId: 'nope' }));
    await assertFails(setDoc(doc(as('pa'), 'notifications/n3'), companyNotice('n3', 'new_order')));
    await assertFails(setDoc(doc(as('pa'), 'notifications/n4'), companyNotice('n4', 'review_hidden', { body: 'hi' })));
    await assertFails(setDoc(doc(as('pa'), 'notifications/n5'), { ...companyNotice('n5', 'review_hidden'), recipientType: 'customer' }));
  });

  it('the company reads it, and may delete it', async () => {
    await assertSucceeds(setDoc(doc(as('pa'), 'notifications/n6'), companyNotice('n6', 'company_activated')));
    const { getDoc, deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(as('ca1'), 'notifications/n6')));
    await assertFails(getDoc(doc(as('ca2'), 'notifications/n6')));
    await assertSucceeds(deleteDoc(doc(as('ca1'), 'notifications/n6')));
  });
});
