/*
 * Reports (reports/{id}): a customer, a company admin or a technician sends one
 * in their own name (new, no reply, server time) and reads only their own;
 * Platform Admin reads all and changes only the status and the written
 * outcome; nobody deletes one. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
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

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, ...extra });
  await user('pa', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('cust2', 'customer');
  await user('cust_off', 'customer', { isActive: false });
  await user('ca1', 'company_admin', { companyId: 'c1' });
  await user('tech1', 'technician', { companyId: 'c1' });
});

const report = (uid: string, role: string, extra: Record<string, unknown> = {}) => ({
  id: 'r1',
  reporterId: uid,
  reporterRole: role,
  reporterName: 'Someone',
  reporterEmail: `${uid}@x.test`,
  reason: 'order_problem',
  subject: 'My order never arrived',
  details: 'Ordered last week, nothing yet.',
  status: 'new',
  resolution: '',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});
/** The report and the quota step that must travel with it (the slot after the one written last). */
async function sendBatch(uid: string, role: string, extra: Record<string, unknown>, id: string, withQuota = true) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'reports', id), report(uid, role, { id, ...extra }));
  if (withQuota) {
    let stored: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      stored = (await getDoc(doc(ctx.firestore(), 'report_quota', uid))).data();
    });
    if (stored) {
      const next = stored.next as number;
      batch.update(doc(db, 'report_quota', uid), { [`t${next}`]: serverTimestamp(), next: (next + 1) % 5, lastReportId: id });
    } else {
      batch.set(doc(db, 'report_quota', uid), { t0: serverTimestamp(), next: 1, lastReportId: id });
    }
  }
  return batch.commit();
}
const send = (uid: string, role: string, extra: Record<string, unknown> = {}, id = 'r1') => sendBatch(uid, role, extra, id);
const seed = (id = 'r1', reporterId = 'cust1', extra: Record<string, unknown> = {}) =>
  put(`reports/${id}`, { ...report(reporterId, 'customer', { id }), createdAt: new Date(), updatedAt: new Date(), ...extra });
const edit = (uid: string, patch: Record<string, unknown>, id = 'r1') => updateDoc(doc(as(uid), 'reports', id), patch);

describe('sending a report', () => {
  it('a customer, a company admin and a technician each send one in their own name', async () => {
    await assertSucceeds(send('cust1', 'customer'));
    await assertSucceeds(send('ca1', 'company_admin', { companyId: 'c1' }, 'r2'));
    await assertSucceeds(send('tech1', 'technician', { companyId: 'c1' }, 'r3'));
  });

  it('may name an order, up to 40 characters', async () => {
    await assertSucceeds(send('cust1', 'customer', { orderRef: 'A1B2C3' }));
    await assertFails(send('cust1', 'customer', { orderRef: 'x'.repeat(41) }, 'r2'));
    await assertFails(send('cust1', 'customer', { orderRef: 5 }, 'r3'));
  });

  it('nobody else can: not signed in, a deactivated account, a Platform Admin', async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'reports', 'r1'), report('x', 'customer')));
    await assertFails(send('cust_off', 'customer'));
    await assertFails(send('pa', 'platform_admin'));
  });

  it('only in your own name and role', async () => {
    await assertFails(send('cust1', 'customer', { reporterId: 'cust2' }));
    await assertFails(send('cust1', 'company_admin'));
    await assertFails(send('cust1', 'platform_admin'));
  });

  it('a company id must be your own company', async () => {
    await assertFails(send('ca1', 'company_admin', { companyId: 'c2' }));
    await assertFails(send('cust1', 'customer', { companyId: 'c1' }, 'r2'));
  });

  it('starts as new with no reply and the server time', async () => {
    await assertFails(send('cust1', 'customer', { status: 'closed' }));
    await assertFails(send('cust1', 'customer', { resolution: 'done' }, 'r2'));
    await assertFails(send('cust1', 'customer', { createdAt: new Date() }, 'r3'));
    await assertFails(send('cust1', 'customer', { updatedAt: new Date() }, 'r4'));
  });

  it('needs a known reason, a subject and details within their limits', async () => {
    await assertFails(send('cust1', 'customer', { reason: 'spam' }));
    await assertFails(send('cust1', 'customer', { subject: '' }, 'r2'));
    await assertFails(send('cust1', 'customer', { subject: 'x'.repeat(121) }, 'r3'));
    await assertFails(send('cust1', 'customer', { details: '' }, 'r4'));
    await assertFails(send('cust1', 'customer', { details: 'x'.repeat(2001) }, 'r5'));
    await assertSucceeds(send('cust1', 'customer', { details: 'x'.repeat(2000) }, 'r6'));
  });

  it('no extra field and the id is the document id', async () => {
    await assertFails(send('cust1', 'customer', { priority: 'high' }));
    await assertFails(setDoc(doc(as('cust1'), 'reports', 'rX'), report('cust1', 'customer', { id: 'other' })));
  });
});

describe('at most five reports in 24 hours', () => {
  it('five go through, the sixth is refused', async () => {
    for (let i = 1; i <= 5; i++) await assertSucceeds(send('cust1', 'customer', {}, `q${i}`));
    await assertFails(send('cust1', 'customer', {}, 'q6'));
  });

  it('each person has their own five', async () => {
    for (let i = 1; i <= 5; i++) await assertSucceeds(send('cust1', 'customer', {}, `q${i}`));
    await assertSucceeds(send('cust2', 'customer', {}, 'other'));
  });

  it('a slot older than 24 hours is free again; one younger is not', async () => {
    const old = Timestamp.fromDate(new Date(Date.now() - 25 * 3600 * 1000));
    const recent = Timestamp.fromDate(new Date(Date.now() - 2 * 3600 * 1000));
    await put('report_quota/cust1', { t0: old, t1: recent, t2: recent, t3: recent, t4: recent, next: 0, lastReportId: 'x' });
    await assertSucceeds(send('cust1', 'customer', {}, 'again'));
    // next is now 1, whose slot is only 2 hours old
    await assertFails(send('cust1', 'customer', {}, 'too-soon'));
  });

  it('a report without its quota step is refused, and the quota cannot be written on its own', async () => {
    await assertFails(sendBatch('cust1', 'customer', {}, 'r1', false));
    await assertFails(setDoc(doc(as('cust1'), 'report_quota', 'cust1'), { t0: serverTimestamp(), next: 1, lastReportId: 'ghost' }));
    await assertFails(setDoc(doc(as('cust1'), 'report_quota', 'cust1'), { t0: serverTimestamp(), next: 0, lastReportId: 'r1' }));
  });

  it('the quota step must be honest: the right slot, the server time, the next index', async () => {
    const db = as('cust1');
    const attempt = (quota: Record<string, unknown>) => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'reports', 'r1'), report('cust1', 'customer', { id: 'r1' }));
      batch.set(doc(db, 'report_quota', 'cust1'), quota);
      return batch.commit();
    };
    await assertFails(attempt({ t0: new Date(), next: 1, lastReportId: 'r1' }));
    await assertFails(attempt({ t0: serverTimestamp(), next: 3, lastReportId: 'r1' }));
    await assertFails(attempt({ t0: serverTimestamp(), next: 1, lastReportId: 'other' }));
    await assertFails(attempt({ t0: serverTimestamp(), next: 1, lastReportId: 'r1', extra: 1 }));
    await assertSucceeds(attempt({ t0: serverTimestamp(), next: 1, lastReportId: 'r1' }));
  });

  it('only the owner and Platform Admin read the quota; nobody lists or deletes it', async () => {
    await put('report_quota/cust1', { t0: new Date(), next: 1, lastReportId: 'x' });
    await assertSucceeds(getDoc(doc(as('cust1'), 'report_quota', 'cust1')));
    await assertSucceeds(getDoc(doc(as('pa'), 'report_quota', 'cust1')));
    await assertFails(getDoc(doc(as('cust2'), 'report_quota', 'cust1')));
    await assertFails(getDocs(collection(as('pa'), 'report_quota')));
    await assertFails(deleteDoc(doc(as('cust1'), 'report_quota', 'cust1')));
  });
});

describe('telling the sender', () => {
  const note = (reportId: string, type: string, extra: Record<string, unknown> = {}) => ({
    id: `${reportId}_${type}`,
    recipientType: 'customer',
    recipientId: 'cust1',
    reportId,
    type,
    productName: 'My order never arrived',
    isRead: false,
    createdAt: serverTimestamp(),
    senderId: 'pa',
    ...extra,
  });
  /** What the panel writes: the report moves on and the notification, in one batch. */
  const closeWithNote = (uid: string, n: Record<string, unknown>, status = 'closed', reportId = 'r1') => {
    const db = as(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, 'reports', reportId), { status, resolution: 'Done', updatedAt: serverTimestamp() });
    batch.set(doc(db, 'notifications', String(n.id)), n);
    return batch.commit();
  };

  beforeEach(async () => {
    await seed('r1', 'cust1');
    await seed('rc', 'ca1', { reporterRole: 'company_admin', companyId: 'c1' });
  });

  it('Platform Admin tells a customer their report is closed, or in progress', async () => {
    await assertSucceeds(closeWithNote('pa', note('r1', 'report_closed')));
    await assertSucceeds(closeWithNote('pa', note('r1', 'report_in_progress'), 'in_progress'));
  });

  it('tells a company through its company id', async () => {
    await assertFails(
      closeWithNote('pa', note('rc', 'report_closed', { recipientType: 'company_admin', recipientId: 'c2' }), 'closed', 'rc'),
    );
    await assertSucceeds(
      closeWithNote('pa', note('rc', 'report_closed', { recipientType: 'company_admin', recipientId: 'c1' }), 'closed', 'rc'),
    );
  });

  it('only about what is true: the report must really be in that status', async () => {
    await assertFails(closeWithNote('pa', note('r1', 'report_closed'), 'in_progress'));
    await assertFails(closeWithNote('pa', note('r1', 'report_in_progress'), 'closed'));
  });

  it('only to the person who sent the report, with the subject of that report', async () => {
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { recipientId: 'cust2' })));
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { recipientType: 'company_admin', recipientId: 'c1' })));
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { productName: 'Something else' })));
  });

  it('the id, the sender and the shape are fixed', async () => {
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { id: 'made-up' })));
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { senderId: 'cust1' })));
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { isRead: true })));
    await assertFails(closeWithNote('pa', note('r1', 'report_closed', { title: 'Hi' })));
    await assertFails(closeWithNote('pa', note('r1', 'order_completed')));
  });

  it('one per report and type', async () => {
    await assertSucceeds(closeWithNote('pa', note('r1', 'report_closed')));
    await assertFails(closeWithNote('pa', note('r1', 'report_closed')));
  });

  it('nobody else can write one: not the sender, a company, a deactivated admin', async () => {
    for (const uid of ['cust1', 'ca1', 'pa_off']) {
      await assertFails(setDoc(doc(as(uid), 'notifications', 'r1_report_closed'), note('r1', 'report_closed', { senderId: uid })));
    }
  });

  it('the sender reads it and marks it read', async () => {
    await closeWithNote('pa', note('r1', 'report_closed'));
    await assertSucceeds(getDoc(doc(as('cust1'), 'notifications', 'r1_report_closed')));
    await assertSucceeds(updateDoc(doc(as('cust1'), 'notifications', 'r1_report_closed'), { isRead: true }));
    await assertFails(getDoc(doc(as('cust2'), 'notifications', 'r1_report_closed')));
  });
});

describe('reading', () => {
  beforeEach(async () => {
    await seed('r1', 'cust1');
    await seed('r2', 'cust2');
  });

  it('you read your own, listed by your id', async () => {
    await assertSucceeds(getDoc(doc(as('cust1'), 'reports', 'r1')));
    await assertSucceeds(getDocs(query(collection(as('cust1'), 'reports'), where('reporterId', '==', 'cust1'))));
  });

  it('never another person\'s, and never the whole collection', async () => {
    await assertFails(getDoc(doc(as('cust1'), 'reports', 'r2')));
    await assertFails(getDocs(collection(as('cust1'), 'reports')));
    await assertFails(getDocs(query(collection(as('cust1'), 'reports'), where('reporterId', '==', 'cust2'))));
  });

  it('an active Platform Admin reads them all; a deactivated one reads none', async () => {
    await assertSucceeds(getDocs(collection(as('pa'), 'reports')));
    await assertSucceeds(getDoc(doc(as('pa'), 'reports', 'r2')));
    await assertFails(getDocs(collection(as('pa_off'), 'reports')));
  });
});

describe('handling a report', () => {
  beforeEach(async () => {
    await seed('r1', 'cust1');
  });

  it('Platform Admin sets the status and writes the outcome', async () => {
    await assertSucceeds(edit('pa', { status: 'in_progress', updatedAt: serverTimestamp() }));
    await assertSucceeds(edit('pa', { status: 'closed', resolution: 'Refunded.', updatedAt: serverTimestamp() }));
    await assertSucceeds(edit('pa', { status: 'new', updatedAt: serverTimestamp() }));
  });

  it('only those fields, in the allowed shape', async () => {
    await assertFails(edit('pa', { reporterId: 'cust2', updatedAt: serverTimestamp() }));
    await assertFails(edit('pa', { details: 'changed', updatedAt: serverTimestamp() }));
    await assertFails(edit('pa', { status: 'resolved', updatedAt: serverTimestamp() }));
    await assertFails(edit('pa', { resolution: 'x'.repeat(501), updatedAt: serverTimestamp() }));
    await assertFails(edit('pa', { resolution: 5, updatedAt: serverTimestamp() }));
    await assertFails(edit('pa', { status: 'closed', updatedAt: new Date() }));
    await assertFails(edit('pa', { status: 'closed' }));
  });

  it('not the sender, another user, a company or a deactivated admin', async () => {
    for (const uid of ['cust1', 'cust2', 'ca1', 'pa_off']) {
      await assertFails(edit(uid, { status: 'closed', updatedAt: serverTimestamp() }));
    }
  });

  it('nobody deletes a report', async () => {
    await assertFails(deleteDoc(doc(as('pa'), 'reports', 'r1')));
    await assertFails(deleteDoc(doc(as('cust1'), 'reports', 'r1')));
  });
});

describe('the activity trail', () => {
  it('accepts an entry about a report', async () => {
    await assertSucceeds(
      setDoc(doc(collection(as('pa'), 'admin_audit_log')), {
        actorId: 'pa',
        actorName: 'pa',
        action: 'report.status',
        targetType: 'report',
        targetId: 'r1',
        targetName: 'My order never arrived',
        createdAt: serverTimestamp(),
      }),
    );
  });
});
