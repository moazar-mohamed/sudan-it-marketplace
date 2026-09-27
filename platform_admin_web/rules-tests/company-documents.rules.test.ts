/*
 * Company registration documents (`company_documents/{companyId}`): the
 * registration number and a compressed JPEG of the document, Platform Admin
 * only. Local emulator only (npm run test:rules); every user is a fake identity.
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
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { companyDocumentData, fetchCompanyDocument } from '../src/data/companyDocuments';
import { deleteCompanyCascade } from '../src/data/deleteCompany';

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
const anon = () => env.unauthenticatedContext().firestore();

const user = (id: string, role: string, extra: Record<string, unknown> = {}) => ({
  id,
  fullName: id,
  email: `${id}@x.test`,
  role,
  isActive: true,
  createdAt: now,
  ...extra,
});

const image = (size = 2048) => ({
  bytes: new Uint8Array(size).fill(7),
  contentType: 'image/jpeg' as const,
  width: 1200,
  height: 1600,
  fileName: 'licence.jpg',
});

const pdf = (size = 2048) => ({
  bytes: new Uint8Array(size).fill(7),
  contentType: 'application/pdf' as const,
  width: 0,
  height: 0,
  fileName: 'licence.pdf',
});

const payload = (companyId = 'c1', number = 'CR-2024-0091', size?: number) =>
  companyDocumentData(companyId, number, image(size));

const pdfPayload = (companyId = 'c1', number = 'CR-2024-0091', size?: number) =>
  companyDocumentData(companyId, number, pdf(size));

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [
      user('cust1', 'customer'),
      user('ca1', 'company_admin', { companyId: 'c1' }),
      user('tech1', 'technician', { companyId: 'c1' }),
      user('pa1', 'platform_admin'),
      user('paOff', 'platform_admin', { isActive: false }),
    ]) {
      await setDoc(doc(db, 'users', u.id), u);
    }
    await setDoc(doc(db, 'companies', 'c1'), {
      name: 'c1',
      status: 'inactive',
      rating: 0,
      reviewCount: 0,
      createdAt: now,
    });
  });
});

async function seedDocument() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'company_documents', 'c1'), {
      ...payload(),
      updatedAt: now,
    });
  });
}

describe('who can read a registration document', () => {
  it('Platform Admin can, through the dashboard code', async () => {
    await seedDocument();
    const stored = await fetchCompanyDocument(as('pa1'), 'c1');
    expect(stored?.registrationNumber).toBe('CR-2024-0091');
    expect(stored?.bytes.length).toBe(2048);
    // A company without one reads as "none", not as an error.
    expect(await fetchCompanyDocument(as('pa1'), 'c2')).toBeNull();
  });

  it('nobody else can: not the company, its staff, customers or visitors', async () => {
    await seedDocument();
    for (const db of [as('ca1'), as('tech1'), as('cust1'), as('paOff'), anon()]) {
      await assertFails(getDoc(doc(db, 'company_documents', 'c1')));
    }
  });

  it('the documents cannot be listed, even by Platform Admin', async () => {
    await seedDocument();
    await assertFails(getDocs(collection(as('pa1'), 'company_documents')));
  });
});

describe('adding and updating', () => {
  it('Platform Admin adds it together with a new company, in one batch', async () => {
    const db = as('pa1');
    const batch = writeBatch(db);
    batch.set(doc(db, 'companies', 'cNew'), {
      name: 'New Co',
      logoUrl: '',
      description: '',
      city: '',
      address: '',
      phone: '',
      email: 'new@x.test',
      pickupAddress: '',
      rating: 0,
      reviewCount: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'company_documents', 'cNew'), payload('cNew'));
    await assertSucceeds(batch.commit());
  });

  it('Platform Admin adds or replaces it for an existing company', async () => {
    await assertSucceeds(setDoc(doc(as('pa1'), 'company_documents', 'c1'), payload()));
    await assertSucceeds(
      setDoc(doc(as('pa1'), 'company_documents', 'c1'), payload('c1', 'CR-NEW-7')),
    );
  });

  it('is refused for a company that does not exist', async () => {
    await assertFails(setDoc(doc(as('pa1'), 'company_documents', 'ghost'), payload('ghost')));
  });

  it('nobody but an active Platform Admin can write it', async () => {
    for (const db of [as('ca1'), as('tech1'), as('cust1'), as('paOff'), anon()]) {
      await assertFails(setDoc(doc(db, 'company_documents', 'c1'), payload()));
    }
  });

  it('the stored fields must be complete and sane', async () => {
    const db = as('pa1');
    const ref = doc(db, 'company_documents', 'c1');
    const bad: Record<string, unknown>[] = [
      { ...payload(), registrationNumber: '   ' },
      { ...payload(), registrationNumber: 'x'.repeat(61) },
      { ...payload(), companyId: 'c2' },
      { ...payload(), contentType: 'image/png' },
      { ...payload(), sizeBytes: 1 },
      { ...payload(), fileName: '' },
      { ...payload(), updatedAt: now },
      { ...payload(), extra: true },
      payload('c1', 'CR-1', 700_001),
    ];
    for (const data of bad) {
      await assertFails(setDoc(ref, data));
    }
    const withoutImage: Record<string, unknown> = { ...payload() };
    delete withoutImage.image;
    await assertFails(setDoc(ref, withoutImage));
  });

  it('a PDF is accepted as picked, with no pixel size', async () => {
    await assertSucceeds(setDoc(doc(as('pa1'), 'company_documents', 'c1'), pdfPayload()));
  });

  it('a PDF is refused if it is too large, or carries a width/height', async () => {
    const db = as('pa1');
    const ref = doc(db, 'company_documents', 'c1');
    await assertFails(setDoc(ref, pdfPayload('c1', 'CR-1', 700_001)));
    await assertFails(setDoc(ref, { ...pdfPayload(), width: 100 }));
    await assertFails(setDoc(ref, { ...pdfPayload(), height: 100 }));
  });

  it('an image still needs a real width and height', async () => {
    const db = as('pa1');
    const ref = doc(db, 'company_documents', 'c1');
    await assertFails(setDoc(ref, { ...payload(), width: 0 }));
    await assertFails(setDoc(ref, { ...payload(), height: -1 }));
  });

  it('one field cannot be patched on its own', async () => {
    await seedDocument();
    await assertFails(
      updateDoc(doc(as('pa1'), 'company_documents', 'c1'), { registrationNumber: 'CR-9' }),
    );
  });
});

describe('deleting', () => {
  it('is refused while the company exists', async () => {
    await seedDocument();
    await assertFails(deleteDoc(doc(as('pa1'), 'company_documents', 'c1')));
  });

  it('goes with the company when Platform Admin deletes it', async () => {
    await seedDocument();
    const summary = await deleteCompanyCascade(as('pa1'), 'c1');
    expect(summary.companyDeleted).toBe(true);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const left = await getDoc(doc(ctx.firestore(), 'company_documents', 'c1'));
      expect(left.exists()).toBe(false);
    });
  });
});
