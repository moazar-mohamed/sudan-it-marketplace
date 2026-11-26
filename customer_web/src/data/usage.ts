import { doc, increment, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const KEY = 'usage_views';

function today(now = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** The person used the site today, for the platform's figures: once a day, best effort. */
export async function recordActiveDay(uid: string, role: string): Promise<void> {
  const day = today();
  const key = `usage_day_${uid}`;
  try {
    if (localStorage.getItem(key) === day) return;
    try {
      await setDoc(doc(db, 'usage_days', `${day}_${uid}`), {
        day,
        userId: uid,
        role,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      // "permission-denied" means today was already recorded: nothing to retry.
      if ((e as { code?: string }).code !== 'permission-denied') throw e;
    }
    localStorage.setItem(key, day);
  } catch {
    /* never touches what the person is doing */
  }
}

/**
 * One more view of [productId] for the platform's figures: best effort, at most
 * once a day per product from this browser, stored like the app ("day|id,id").
 * The customer's marker for the product moves to now in the same write: the
 * rules count a customer at most once per product in any 24 hours.
 */
export async function recordProductView(productId: string, uid: string): Promise<void> {
  try {
    const day = today();
    const stored = localStorage.getItem(KEY) ?? '';
    const separator = stored.indexOf('|');
    const seen = new Set(
      separator >= 0 && stored.slice(0, separator) === day
        ? stored.slice(separator + 1).split(',').filter(Boolean)
        : [],
    );
    if (seen.has(productId)) return;
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'product_views', `${productId}_${uid}`), {
        productId,
        userId: uid,
        lastAt: serverTimestamp(),
      });
      batch.set(
        doc(db, 'product_stats', productId),
        { views: increment(1), updatedAt: serverTimestamp() },
        { merge: true },
      );
      await batch.commit();
    } catch (e) {
      // "permission-denied" means it was already counted in the last 24 hours.
      if ((e as { code?: string }).code !== 'permission-denied') throw e;
    }
    seen.add(productId);
    localStorage.setItem(KEY, `${day}|${[...seen].join(',')}`);
  } catch {
    /* never touches what the person is doing */
  }
}
