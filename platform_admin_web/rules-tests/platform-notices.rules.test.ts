/*
 * Notices to the Platform Admins (recipientType 'platform_admin'): a person
 * writes one right after sending a report (new_report), and a customer after
 * rating 1 or 2 stars (low_review). Local emulator only (npm run test:rules);
 * every user is a fake identity.
 *
 * The report or review must be the caller's own, the only text is its subject
 * or the rated item's name, the id is fixed (one per report or review), and
 * only Platform Admins read, mark read or delete them.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const now = new Date();

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

const as = (uid: string) => env.authenticatedContext(uid).firestore();

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(db, 'users', id), { id, fullName: id, email: `${id}@x.test`, role, isActive: true, createdAt: now, ...extra });
    await user('cust1', 'customer');
    await user('cust2', 'customer');
    await user('custOff', 'customer', { isActive: false });
    await user('ca1', 'company_admin', { companyId: 'c1' });
    await user('admin1', 'platform_admin');
    await user('admin2', 'platform_admin');

    const report = (id: string, reporterId: string, reporterRole: string, subject: string) =>
      setDoc(doc(db, 'reports', id), {
        id,
        reporterId,
        reporterRole,
        reporterName: reporterId,
        reporterEmail: `${reporterId}@x.test`,
        reason: 'other',
        subject,
        details: 'details',
        status: 'new',
        resolution: '',
        createdAt: now,
        updatedAt: now,
      });
    await report('r1', 'cust1', 'customer', 'Late delivery');
    await report('r2', 'ca1', 'company_admin', 'Payment question');
    await report('rOff', 'custOff', 'customer', 'Old report');

    const review = (id: string, customerId: string, stars: number, targetName: string) =>
      setDoc(doc(db, 'reviews', id), {
        id,
        sourceType: 'order',
        customerId,
        authorName: customerId,
        companyId: 'c1',
        companyName: 'Company One',
        targetType: 'product',
        targetId: 'p1',
        targetName,
        stars,
        tags: [],
        comment: '',
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });
    await review('v1', 'cust1', 2, 'Printer X');
    await review('v2', 'cust1', 4, 'Printer X');
    await review('v3', 'cust2', 1, 'Router Y');
  });
});

const reportNotice = (reportId: string, senderId: string, extra: Record<string, unknown> = {}) => ({
  id: `${reportId}_new_report`,
  recipientType: 'platform_admin',
  recipientId: 'platform',
  reportId,
  type: 'new_report',
  productName: 'Late delivery',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId,
  ...extra,
});

const reviewNotice = (reviewId: string, senderId: string, extra: Record<string, unknown> = {}) => ({
  id: `${reviewId}_low_review`,
  recipientType: 'platform_admin',
  recipientId: 'platform',
  reviewId,
  type: 'low_review',
  productName: 'Printer X',
  isRead: false,
  createdAt: serverTimestamp(),
  senderId,
  ...extra,
});

const write = (uid: string, data: Record<string, unknown>, id = data.id as string) =>
  setDoc(doc(as(uid), 'notifications', id), data);

describe('a new report tells the Platform Admins', () => {
  it('its sender writes the notice with the report subject', async () => {
    await assertSucceeds(write('cust1', reportNotice('r1', 'cust1')));
  });

  it('a company admin does the same for its own report', async () => {
    await assertSucceeds(write('ca1', reportNotice('r2', 'ca1', { productName: 'Payment question' })));
  });

  it('is refused for somebody else\'s report', async () => {
    await assertFails(write('cust2', reportNotice('r1', 'cust2')));
  });

  it('is refused for a report that does not exist', async () => {
    await assertFails(write('cust1', reportNotice('nope', 'cust1')));
  });

  it('carries the report subject and nothing else', async () => {
    await assertFails(write('cust1', reportNotice('r1', 'cust1', { productName: 'Something else' })));
    await assertFails(write('cust1', reportNotice('r1', 'cust1', { title: 'Hello' })));
    await assertFails(write('cust1', reportNotice('r1', 'cust1', { body: 'Text' })));
  });

  it('has a fixed id, a fixed recipient and the caller as sender', async () => {
    await assertFails(write('cust1', reportNotice('r1', 'cust1'), 'r1_other'));
    await assertFails(write('cust1', reportNotice('r1', 'cust1', { recipientId: 'admin1' })));
    await assertFails(write('cust1', reportNotice('r1', 'cust1', { recipientType: 'customer' })));
    await assertFails(write('cust1', reportNotice('r1', 'cust2')));
    await assertFails(write('cust1', reportNotice('r1', 'cust1', { isRead: true })));
  });

  it('is sent once per report', async () => {
    await assertSucceeds(write('cust1', reportNotice('r1', 'cust1')));
    await assertFails(write('cust1', reportNotice('r1', 'cust1')));
  });

  it('a deactivated account cannot send one', async () => {
    await assertFails(write('custOff', reportNotice('rOff', 'custOff', { productName: 'Old report' })));
  });
});

describe('a 1 or 2 star rating tells the Platform Admins', () => {
  it('its customer writes the notice with the rated item\'s name', async () => {
    await assertSucceeds(write('cust1', reviewNotice('v1', 'cust1')));
  });

  it('is refused for 3 stars or more', async () => {
    await assertFails(write('cust1', reviewNotice('v2', 'cust1')));
  });

  it('is refused for somebody else\'s review, or one that does not exist', async () => {
    await assertFails(write('cust1', reviewNotice('v3', 'cust1', { productName: 'Router Y' })));
    await assertFails(write('cust1', reviewNotice('nope', 'cust1')));
  });

  it('carries the rated item\'s name, a fixed id and no other text', async () => {
    await assertFails(write('cust1', reviewNotice('v1', 'cust1', { productName: 'Another' })));
    await assertFails(write('cust1', reviewNotice('v1', 'cust1'), 'v1_new_report'));
    await assertFails(write('cust1', reviewNotice('v1', 'cust1', { title: 'Bad' })));
    await assertFails(write('cust1', { ...reviewNotice('v1', 'cust1'), type: 'new_report' }));
  });
});

describe('reading and handling the notices', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'notifications', 'r1_new_report'), { ...reportNotice('r1', 'cust1'), createdAt: now });
    });
  });

  it('every Platform Admin reads them, one at a time or as a list', async () => {
    await assertSucceeds(getDoc(doc(as('admin1'), 'notifications', 'r1_new_report')));
    await assertSucceeds(getDoc(doc(as('admin2'), 'notifications', 'r1_new_report')));
    await assertSucceeds(
      getDocs(
        query(collection(as('admin1'), 'notifications'), where('recipientType', '==', 'platform_admin'), where('recipientId', '==', 'platform')),
      ),
    );
  });

  it('nobody else reads them, the sender included', async () => {
    await assertFails(getDoc(doc(as('cust1'), 'notifications', 'r1_new_report')));
    await assertFails(getDoc(doc(as('ca1'), 'notifications', 'r1_new_report')));
  });

  it('a Platform Admin marks one read or deletes it; the sender cannot', async () => {
    await assertFails(updateDoc(doc(as('cust1'), 'notifications', 'r1_new_report'), { isRead: true }));
    await assertFails(deleteDoc(doc(as('cust1'), 'notifications', 'r1_new_report')));
    await assertSucceeds(updateDoc(doc(as('admin1'), 'notifications', 'r1_new_report'), { isRead: true }));
    await assertFails(updateDoc(doc(as('admin1'), 'notifications', 'r1_new_report'), { productName: 'x' }));
    await assertSucceeds(deleteDoc(doc(as('admin2'), 'notifications', 'r1_new_report')));
  });
});
