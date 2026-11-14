import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut as signOutOf,
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db, firebaseConfig } from '../firebase';
import { mapReview } from './mappers';
import { sendNotice } from './notify';
import type { Company, PaymentAccount, PickupPoint, Review, Technician } from './types';

// ── The company's own profile ──────────────────────────────────────────────

/**
 * The rules need every text field of the profile to be a string whenever it is
 * saved, so each save carries them (as the company has them now) together with
 * what changed.
 */
function profileBase(company: Company) {
  return {
    name: company.name,
    logoUrl: company.logoUrl,
    description: company.description,
    city: company.city,
    address: company.address,
    phone: company.phone,
    pickupAddress: company.pickupAddress,
  };
}

export async function saveProfile(
  company: Company,
  changes: { name: string; logoUrl: string; description: string; address: string; phone: string; latitude: number | null; longitude: number | null },
): Promise<void> {
  await updateDoc(doc(db, 'companies', company.id), {
    ...profileBase(company),
    name: changes.name.trim(),
    logoUrl: changes.logoUrl,
    description: changes.description.trim(),
    address: changes.address.trim(),
    phone: changes.phone.trim(),
    latitude: changes.latitude,
    longitude: changes.longitude,
    updatedAt: serverTimestamp(),
  });
}

/** The bank accounts live in their own document: only signed-in customers read them, never visitors. */
export async function savePaymentAccounts(company: Company, accounts: PaymentAccount[]): Promise<void> {
  await setDoc(doc(db, 'company_payment', company.id), {
    companyId: company.id,
    paymentAccounts: accounts.map((a) => ({
      bankName: a.bankName.trim(),
      accountName: a.accountName.trim(),
      accountNumber: a.accountNumber.trim(),
      phoneNumber: a.phoneNumber.trim(),
    })),
    updatedAt: serverTimestamp(),
  });
}

export async function savePickupPoints(company: Company, points: PickupPoint[]): Promise<void> {
  await updateDoc(doc(db, 'companies', company.id), {
    ...profileBase(company),
    // The first point is mirrored into the single written address, so older apps still show where orders are collected.
    pickupAddress: points.length > 0 ? [points[0].name, points[0].address].filter(Boolean).join(' · ') : company.pickupAddress,
    pickupPoints: points.map((p) => ({
      name: p.name.trim(),
      address: p.address.trim(),
      ...(p.latitude !== null && p.longitude !== null ? { latitude: p.latitude, longitude: p.longitude } : {}),
    })),
    updatedAt: serverTimestamp(),
  });
}

export async function saveServiceCities(company: Company, cityIds: string[]): Promise<void> {
  await updateDoc(doc(db, 'companies', company.id), {
    ...profileBase(company),
    serviceCityIds: cityIds,
    updatedAt: serverTimestamp(),
  });
}

// ── Technicians ────────────────────────────────────────────────────────────

export type TechnicianProblem = 'email-in-use' | 'weak-password' | 'invalid-email' | 'failed';

export class TechnicianError extends Error {
  constructor(readonly problem: TechnicianProblem) {
    super(problem);
  }
}

/**
 * Creates the technician's login with a temporary password and their records,
 * in ONE batch signed by the company admin (so either both exist or neither).
 * The login is made with a second, throw-away Firebase app so the admin stays
 * signed in. The technician must choose their own password at first sign-in.
 */
export async function createTechnician(
  companyId: string,
  input: { fullName: string; phone: string; email: string; password: string },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const app = initializeApp(firebaseConfig, `provisioning-${Date.now()}`);
  const other = getAuth(app);
  if (import.meta.env.VITE_EMULATOR) connectAuthEmulator(other, 'http://127.0.0.1:9099', { disableWarnings: true });
  try {
    const created = (await createUserWithEmailAndPassword(other, email, input.password)).user;
    const uid = created.uid;
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();
      batch.set(doc(db, 'users', uid), {
        id: uid,
        role: 'technician',
        companyId,
        email,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        isActive: true,
        mustChangePassword: true,
        createdAt: now,
      });
      batch.set(doc(db, 'technicians', uid), {
        id: uid,
        uid,
        companyId,
        email,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await batch.commit();
    } catch (e) {
      // Do not leave a login without a profile behind.
      await created.delete().catch(() => undefined);
      throw e;
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    throw new TechnicianError(
      code === 'auth/email-already-in-use' ? 'email-in-use' : code === 'auth/weak-password' ? 'weak-password' : code === 'auth/invalid-email' ? 'invalid-email' : 'failed',
    );
  } finally {
    await signOutOf(other).catch(() => undefined);
    await deleteApp(app).catch(() => undefined);
  }
}

export async function updateTechnician(t: Technician, changes: { fullName: string; phone: string }): Promise<void> {
  await updateDoc(doc(db, 'technicians', t.id), {
    id: t.id,
    uid: t.uid || t.id,
    companyId: t.companyId,
    fullName: changes.fullName.trim(),
    phone: changes.phone.trim(),
    email: t.email,
    isActive: t.isActive,
    isAvailable: t.isAvailable,
    updatedAt: serverTimestamp(),
  });
}

export async function setTechnicianActive(t: Technician, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'technicians', t.id), {
    id: t.id,
    uid: t.uid || t.id,
    companyId: t.companyId,
    fullName: t.fullName,
    phone: t.phone,
    email: t.email,
    isActive: active,
    isAvailable: t.isAvailable,
    updatedAt: serverTimestamp(),
  });
}

export const sendTechnicianPasswordLink = (email: string) => sendPasswordResetEmail(auth, email);

// ── Reviews ────────────────────────────────────────────────────────────────

export function useReviews(companyId: string): Review[] | null {
  const [list, setList] = useState<Review[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'reviews'), where('companyId', '==', companyId)),
        (s) => setList(s.docs.map((d) => mapReview(d.id, d.data())).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))),
        () => setList([]),
      ),
    [companyId],
  );
  return list;
}

/** Saves the company's reply; the customer is told about the first one (order reviews only). */
export async function replyToReview(review: Review, reply: string): Promise<boolean> {
  const text = reply.trim();
  const first = !review.reply;
  await updateDoc(doc(db, 'reviews', review.id), { reply: text, replyAt: serverTimestamp() });
  if (first && review.source === 'order') {
    // A review does not name its customer (everyone reads it); the order does.
    const customerId = await getDoc(doc(db, 'orders', review.id)).then((s) => String(s.data()?.customerId ?? ''), () => '');
    if (!customerId) return false;
    return sendNotice({ type: 'review_reply', recipientType: 'customer', recipientId: customerId, orderId: review.id, productName: review.targetName });
  }
  return true;
}
