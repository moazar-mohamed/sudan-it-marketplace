import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { t } from '../i18n';
import type { UserProfile } from './types';

/**
 * A company's request to join the platform (company_applications/{uid}), sent
 * from the person's own customer account. Platform Admin reviews it: approving
 * turns this same account into the company's admin (same e-mail and password),
 * rejecting gives a reason, and the request can then be corrected and sent again.
 */
export interface CompanyApplication {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  cityId: string;
  registrationNumber: string;
  about: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionNote: string;
  createdAt: Date | null;
}

export interface ApplicationDraft {
  companyName: string;
  contactName: string;
  /** International form, `+249912345678`. */
  phone: string;
  cityId: string;
  registrationNumber: string;
  about: string;
}

export const COMPANY_NAME_MAX = 120;
export const CONTACT_NAME_MAX = 120;
export const REGISTRATION_MAX = 60;
export const ABOUT_MAX = 500;

export const APPLICATION_STATUS: Record<CompanyApplication['status'], { label: string; tone: string }> = {
  pending: { label: t('قيد المراجعة'), tone: 'warn' },
  approved: { label: t('مقبول'), tone: 'ok' },
  rejected: { label: t('مرفوض'), tone: 'off' },
};

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function mapApplication(id: string, d: Record<string, unknown>): CompanyApplication {
  const status = d.status === 'approved' || d.status === 'rejected' ? d.status : 'pending';
  return {
    id,
    companyName: text(d.companyName),
    contactName: text(d.contactName),
    phone: text(d.phone),
    cityId: text(d.cityId),
    registrationNumber: text(d.registrationNumber),
    about: text(d.about),
    status,
    decisionNote: text(d.decisionNote),
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null,
  };
}

/** What is wrong with the form, or null when it can be sent. */
export function applicationProblem(draft: ApplicationDraft): string | null {
  if (draft.companyName.trim().length < 2) return t('اكتب اسم الشركة.');
  if (draft.contactName.trim() === '') return t('اكتب اسم المسؤول.');
  if (draft.phone === '') return t('اكتب رقم هاتف صحيحًا.');
  if (draft.cityId === '') return t('اختر مدينة الشركة.');
  if (draft.registrationNumber.trim() === '') return t('اكتب رقم السجل التجاري.');
  return null;
}

/** The person's request, live: undefined while loading, null when they have none. */
export function useMyApplication(uid: string): { application: CompanyApplication | null | undefined; failed: boolean } {
  const [application, setApplication] = useState<CompanyApplication | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'company_applications', uid),
        (snap) => setApplication(snap.exists() ? mapApplication(snap.id, snap.data()) : null),
        () => setFailed(true),
      ),
    [uid],
  );
  return { application, failed };
}

/** Sends the request (or sends it again after a rejection), in the person's own name. */
export async function submitApplication(profile: UserProfile, draft: ApplicationDraft): Promise<void> {
  await setDoc(doc(db, 'company_applications', profile.id), {
    id: profile.id,
    applicantId: profile.id,
    // The rules compare it with the signed-in account's own e-mail.
    applicantEmail: auth.currentUser?.email ?? profile.email,
    companyName: draft.companyName.trim().slice(0, COMPANY_NAME_MAX),
    contactName: draft.contactName.trim().slice(0, CONTACT_NAME_MAX),
    phone: draft.phone,
    cityId: draft.cityId,
    registrationNumber: draft.registrationNumber.trim().slice(0, REGISTRATION_MAX),
    about: draft.about.trim().slice(0, ABOUT_MAX),
    status: 'pending',
    decisionNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
