import { doc, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import type { WriteBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyCompany } from './orders';
import type { Order, Review } from './types';

// Port of firestore_reviews_repository.dart: there is no server, so each batch
// that changes a review's stars moves the averages too, and the rules check both.

export const COMMENT_MAX = 500;
const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const ORDER_TAGS = [
  { value: 'quality', label: 'الجودة' },
  { value: 'delivery', label: 'سرعة التوصيل' },
  { value: 'service', label: 'حسن التعامل' },
  { value: 'price', label: 'سعر مناسب' },
] as const;

export const STAR_LABELS = ['', 'سيئ', 'مقبول', 'جيد', 'جيد جدًا', 'ممتاز'];

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

/** The customer's rating of their completed order; its id is the order's, so it is rated once. */
export async function rateOrder(order: Order, customerId: string, fullName: string, draft: ReviewDraft): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'reviews', order.id), {
    id: order.id,
    sourceType: 'order',
    customerId,
    authorName: reviewAuthorName(fullName),
    companyId: order.companyId,
    companyName: order.companyName,
    targetType: 'product',
    targetId: order.productId,
    targetName: order.productName,
    stars: draft.stars,
    tags: draft.tags,
    comment: draft.comment.trim(),
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  moveRatings(batch, { id: order.id, companyId: order.companyId, targetKey: `product_${order.productId}` }, draft.stars, 1);
  await batch.commit();
  await notifyCompany(order, 'new_review').catch(() => undefined);
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
