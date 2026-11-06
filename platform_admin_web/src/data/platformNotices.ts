import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '../firebase';

/*
 * What people tell the Platform Admins (notifications/{id} with recipientType
 * 'platform_admin'): a new report, written by its sender, and a 1 or 2 star
 * rating, written by its customer. firestore.rules checks each one is true;
 * every admin reads the same list and any of them marks one read.
 */

export type PlatformNoticeType = 'new_report' | 'low_review';

export interface PlatformNotice {
  id: string;
  type: PlatformNoticeType;
  reportId: string;
  reviewId: string;
  /** The report's subject, or the rated item's name. */
  name: string;
  isRead: boolean;
  createdAt: Date | null;
}

/** How many are read and shown: the newest ones. */
export const PLATFORM_NOTICES_SHOWN = 30;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function mapPlatformNotice(id: string, d: DocumentData): PlatformNotice | null {
  const type = d.type === 'new_report' || d.type === 'low_review' ? d.type : null;
  if (!type) return null;
  const at = d.createdAt as { toDate?: () => Date } | undefined;
  return {
    id,
    type,
    reportId: str(d.reportId),
    reviewId: str(d.reviewId),
    name: str(d.productName),
    isRead: d.isRead === true,
    createdAt: typeof at?.toDate === 'function' ? at.toDate() : null,
  };
}

/** Where one leads in the panel. */
export const platformNoticeTarget = (n: PlatformNotice): string => (n.type === 'new_report' ? '/reports' : '/reviews?attention=low');

const newestFirst = (list: PlatformNotice[]) =>
  [...list].sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity));

/**
 * The newest notices to the Platform Admins, live; null until the first
 * answer. It reads only the newest [PLATFORM_NOTICES_SHOWN] (firestore.indexes.json
 * has the index); while that index is not ready it reads them all and keeps the newest.
 */
export function usePlatformNotices(enabled = true): PlatformNotice[] | null {
  const [list, setList] = useState<PlatformNotice[] | null>(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const base = [where('recipientType', '==', 'platform_admin'), where('recipientId', '==', 'platform')] as const;
    const read = (docs: { id: string; data: () => DocumentData }[]) =>
      newestFirst(docs.map((d) => mapPlatformNotice(d.id, d.data())).filter((n): n is PlatformNotice => n !== null)).slice(0, PLATFORM_NOTICES_SHOWN);
    let stop = onSnapshot(
      query(collection(db, 'notifications'), ...base, orderBy('createdAt', 'desc'), limit(PLATFORM_NOTICES_SHOWN)),
      (snap) => setList(read(snap.docs)),
      () => {
        stop = onSnapshot(
          query(collection(db, 'notifications'), ...base),
          (snap) => setList(read(snap.docs)),
          () => setList([]),
        );
      },
    );
    return () => stop();
  }, [enabled]);
  return list;
}

export const markPlatformNoticeRead = (id: string): Promise<void> => updateDoc(doc(db, 'notifications', id), { isRead: true });

export async function markPlatformNoticesRead(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) batch.update(doc(db, 'notifications', id), { isRead: true });
    await batch.commit();
  }
}
