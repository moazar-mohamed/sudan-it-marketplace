import { collection, doc, getDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserProfile } from './types';
import { t } from '../i18n';

// Port of lib/features/reports: the sender writes a report and reads only their own.

export const REPORT_REASONS = [
  { value: 'order_problem', label: t('مشكلة في طلب') },
  { value: 'payment', label: t('مشكلة في الدفع') },
  { value: 'company_conduct', label: t('سلوك شركة') },
  { value: 'product_issue', label: t('مشكلة في منتج') },
  { value: 'app_problem', label: t('مشكلة في التطبيق') },
  { value: 'other', label: t('أخرى') },
] as const;

export const reportReasonLabel = (reason: string): string =>
  REPORT_REASONS.find((r) => r.value === reason)?.label ?? t('أخرى');

export const REPORT_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: t('تم الاستلام'), tone: 'warn' },
  in_progress: { label: t('قيد المعالجة'), tone: 'info' },
  closed: { label: t('مغلق'), tone: 'ok' },
};

export const SUBJECT_MAX = 120;
export const DETAILS_MAX = 2000;
export const ORDER_REF_MAX = 40;

const REPORTS_PER_DAY = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReportDraft {
  reason: string;
  subject: string;
  details: string;
  orderRef: string;
}

export class ReportLimitReached extends Error {}

/**
 * The next quota step: the slot the report writes and the one after it. The
 * oldest of the last five reports must be at least 24 hours old.
 */
export function planReportQuota(next: number, oldest: Date | null, now = new Date()): { slot: string; next: number } {
  if (oldest !== null && now.getTime() - oldest.getTime() < WINDOW_MS) throw new ReportLimitReached();
  return { slot: `t${next}`, next: (next + 1) % REPORTS_PER_DAY };
}

/**
 * The quota keeps the times of the person's last five reports. The same step is
 * written with the report, and the rules check it, so the limit cannot be skipped.
 */
export async function submitReport(profile: UserProfile, draft: ReportDraft): Promise<void> {
  const reportRef = doc(collection(db, 'reports'));
  const quotaRef = doc(db, 'report_quota', profile.id);
  const quota = await getDoc(quotaRef);
  const stored = quota.data();
  const current = typeof stored?.next === 'number' ? stored.next : 0;
  const stamp = stored?.[`t${current}`];
  const step = planReportQuota(current, stamp instanceof Timestamp ? stamp.toDate() : null);
  const orderRef = draft.orderRef.trim();

  const batch = writeBatch(db);
  batch.set(reportRef, {
    id: reportRef.id,
    reporterId: profile.id,
    reporterRole: profile.role,
    reporterName: profile.fullName,
    reporterEmail: profile.email,
    reason: draft.reason,
    subject: draft.subject.trim(),
    details: draft.details.trim(),
    ...(orderRef ? { orderRef } : {}),
    status: 'new',
    resolution: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (quota.exists()) {
    batch.update(quotaRef, { [step.slot]: serverTimestamp(), next: step.next, lastReportId: reportRef.id });
  } else {
    batch.set(quotaRef, { t0: serverTimestamp(), next: 1, lastReportId: reportRef.id });
  }
  await batch.commit();
}
