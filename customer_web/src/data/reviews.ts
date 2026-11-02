import { doc, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import type { WriteBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyCompany } from './orders';
import type { Order, Review, ServiceRequest } from './types';
import { t } from '../i18n';

// Port of firestore_reviews_repository.dart: there is no server, so each batch
// that changes a review's stars moves the averages too, and the rules check both.

export const COMMENT_MAX = 500;
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const QUALITY = { value: 'quality', label: t('الجودة') };
const SERVICE = { value: 'service', label: t('حسن التعامل') };
const PRICE = { value: 'price', label: t('سعر مناسب') };

/** Products are delivered, services are done on time. */
export const ORDER_TAGS = [QUALITY, { value: 'delivery', label: t('سرعة التوصيل') }, SERVICE, PRICE];
export const REQUEST_TAGS = [QUALITY, { value: 'punctual', label: t('الالتزام بالموعد') }, SERVICE, PRICE];

/** What a review is about: an order's product, or a request's company service. */
export interface ReviewSubject {
  id: string;
  sourceType: 'order' | 'service_request';
  targetType: 'product' | 'service';
  targetId: string;
  targetName: string;
  companyId: string;
  companyName: string;
  tags: { value: string; label: string }[];
}

export const orderReviewSubject = (o: Order): ReviewSubject => ({
  id: o.id,
  sourceType: 'order',
  targetType: 'product',
  targetId: o.productId,
  targetName: o.productName,
  companyId: o.companyId,
  companyName: o.companyName,
  tags: ORDER_TAGS,
});

export const requestReviewSubject = (r: ServiceRequest): ReviewSubject => ({
  id: r.id,
  sourceType: 'service_request',
  targetType: 'service',
  targetId: r.companyServiceId,
  targetName: r.serviceName,
  companyId: r.companyId,
  companyName: r.companyName,
  tags: REQUEST_TAGS,
});

export const STAR_LABELS = ['', t('سيئ'), t('مقبول'), t('جيد'), t('جيد جدًا'), t('ممتاز')];

export interface ReviewDraft {
  stars: number;
  tags: string[];
  comment: string;
}

/** "أحمد محمد علي" → "أحمد م.": reviews never show a full name. */
export function reviewAuthorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const shown = parts.length > 1 ? `${parts[0]} ${[...parts[1]][0]}.` : parts[0];
  return shown.slice(0, 60);
}

/** When its customer can no longer change it. */
export const editableUntil = (review: Review): Date => new Date(review.createdAt.getTime() + EDIT_WINDOW_MS);

export const canEdit = (review: Review, now = new Date()): boolean => !review.hidden && now < editableUntil(review);

function moveRatings(
  batch: WriteBatch,
  review: { id: string; companyId: string; targetKey: string },
  starsBy: number,
  countBy: number,
): void {
  for (const key of [`company_${review.companyId}`, review.targetKey]) {
    batch.set(
      doc(db, 'ratings', key),
      {
        companyId: review.companyId,
        sum: increment(starsBy),
        ...(countBy !== 0 ? { count: increment(countBy) } : {}),
        lastReviewId: review.id,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

/** The customer's rating of what they received; its id is the order's or request's, so it is rated once. */
export async function rateSubject(subject: ReviewSubject, customerId: string, fullName: string, draft: ReviewDraft): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'reviews', subject.id), {
    id: subject.id,
    sourceType: subject.sourceType,
    customerId,
    authorName: reviewAuthorName(fullName),
    companyId: subject.companyId,
    companyName: subject.companyName,
    targetType: subject.targetType,
    targetId: subject.targetId,
    targetName: subject.targetName,
    stars: draft.stars,
    tags: draft.tags,
    comment: draft.comment.trim(),
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  moveRatings(batch, { id: subject.id, companyId: subject.companyId, targetKey: `${subject.targetType}_${subject.targetId}` }, draft.stars, 1);
  await batch.commit();
  if (subject.sourceType === 'order') {
    await notifyCompany({ id: subject.id, companyId: subject.companyId, productName: subject.targetName }, 'new_review').catch(() => undefined);
  }
}

export async function editReview(review: Review, draft: ReviewDraft): Promise<void> {
  const fields = { stars: draft.stars, tags: draft.tags, comment: draft.comment.trim(), updatedAt: serverTimestamp() };
  const delta = draft.stars - review.stars;
  if (delta === 0) {
    await updateDoc(doc(db, 'reviews', review.id), fields);
    return;
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'reviews', review.id), fields);
  moveRatings(batch, { id: review.id, companyId: review.companyId, targetKey: `${review.targetType}_${review.targetId}` }, delta, 0);
  await batch.commit();
}
