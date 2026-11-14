import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { mapChat, toDate } from './mappers';
import type { Chat } from './types';
import { t } from '../i18n';

// ── Notifications ──────────────────────────────────────────────────────────

export interface Notice {
  id: string;
  type: string;
  orderId: string;
  serviceRequestId: string;
  productId: string;
  productName: string;
  isRead: boolean;
  createdAt: Date | null;
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');

/** How many notifications are read and shown: the newest ones (each read spends the free quota). */
export const NOTICES_SHOWN = 50;

const toNotice = (d: { id: string; data: () => DocumentData }): Notice => ({
  id: d.id,
  type: s(d.data().type),
  orderId: s(d.data().orderId),
  serviceRequestId: s(d.data().serviceRequestId),
  productId: s(d.data().productId),
  productName: s(d.data().productName),
  isRead: d.data().isRead === true,
  createdAt: toDate(d.data().createdAt),
});

const newestFirst = (list: Notice[]) =>
  [...list].sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity));

/**
 * The company's newest notifications, newest first, live. Null while they
 * load. It reads only the newest [NOTICES_SHOWN] (firestore.indexes.json has
 * the index); while that index is not ready on the server it reads them all,
 * as before, and keeps the newest.
 */
export function useNotices(companyId: string): Notice[] | null {
  const [list, setList] = useState<Notice[] | null>(null);
  useEffect(() => {
    const base = [where('recipientType', '==', 'company_admin'), where('recipientId', '==', companyId)] as const;
    let stop = onSnapshot(
      query(collection(db, 'notifications'), ...base, orderBy('createdAt', 'desc'), limit(NOTICES_SHOWN)),
      (snap) => setList(newestFirst(snap.docs.map(toNotice))),
      () => {
        stop = onSnapshot(
          query(collection(db, 'notifications'), ...base),
          (snap) => setList(newestFirst(snap.docs.map(toNotice)).slice(0, NOTICES_SHOWN)),
          () => setList([]),
        );
      },
    );
    return () => stop();
  }, [companyId]);
  return list;
}

export interface NoticeView {
  title: string;
  body: string;
  /** Where it opens in the panel. */
  to: string;
}

/** The wording of a notification (they carry none: only a type and a name). */
export function describeNotice(n: Notice): NoticeView {
  const name = n.productName;
  const order = n.orderId ? `/orders/${n.orderId}` : '/orders';
  switch (n.type) {
    case 'new_order': return { title: t('طلب جديد'), body: t('وصلك طلب جديد على «{0}». راجع الإيصال.', name), to: order };
    case 'new_review': return { title: t('تقييم جديد'), body: t('قيّم عميل «{0}».', name), to: '/reviews' };
    case 'new_service_request': return { title: t('طلب خدمة جديد'), body: t('طلب عميل الخدمة «{0}».', name), to: '/services' };
    case 'service_request_cancelled': return { title: t('أُلغي طلب خدمة'), body: t('ألغى عميل طلبه للخدمة «{0}».', name), to: '/services' };
    case 'job_completed': return { title: t('اكتملت مهمة تركيب'), body: t('أنهى الفني تركيب «{0}».', name), to: order };
    case 'order_cancelled_by_admin_company': return { title: t('ألغت المنصة طلبًا'), body: t('ألغت المنصة الطلب الخاص بـ«{0}».', name), to: order };
    case 'product_hidden': return { title: t('أُخفي منتج'), body: t('أُخفي «{0}» عن العملاء. افتحه لمعرفة السبب.', name), to: n.productId ? `/products/${n.productId}` : '/products' };
    case 'product_shown': return { title: t('عاد المنتج ظاهرًا'), body: t('«{0}» ظاهر للعملاء من جديد.', name), to: n.productId ? `/products/${n.productId}` : '/products' };
    case 'account_converted_to_company': return { title: t('أصبح حسابك حساب شركة'), body: t('شركة «{0}» جاهزة.', name), to: '/' };
    case 'report_in_progress': return { title: t('بلاغك قيد المعالجة'), body: t('بدأنا العمل على «{0}».', name), to: '/' };
    case 'report_closed': return { title: t('أُغلق بلاغك'), body: t('أُغلق بلاغك «{0}». اقرأ ردّنا من «بلاغاتي» في التطبيق.', name), to: '/' };
    default: return { title: t('إشعار'), body: t('يوجد تحديث على أحد طلباتك.'), to: n.orderId ? order : '/' };
  }
}

export async function markNoticeRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
}

export async function markAllNoticesRead(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) batch.update(doc(db, 'notifications', id), { isRead: true });
    await batch.commit();
  }
}

// ── Conversations ──────────────────────────────────────────────────────────

/** Every conversation of the company that has a message, newest first, live. Null while they load. */
export function useChats(companyId: string): Chat[] | null {
  const [list, setList] = useState<Chat[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'chats'), where('companyId', '==', companyId)),
        (snap) =>
          setList(
            snap.docs
              .map((d) => mapChat(d.id, d.data()))
              .filter((c) => c.lastMessageAt !== null)
              .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0)),
          ),
        () => setList([]),
      ),
    [companyId],
  );
  return list;
}

/** The customer wrote last and the company has not opened the conversation since. */
export const isUnreadChat = (c: Chat): boolean =>
  c.lastMessageSenderRole === 'customer' &&
  c.lastMessageAt !== null &&
  (c.companyLastReadAt === null || c.lastMessageAt.getTime() > c.companyLastReadAt.getTime());

/** What the conversation is about, for its row. */
export const chatSubject = (c: Chat): string => c.serviceName || c.productName || t('محادثة');

export async function markChatRead(chatId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId), { companyLastReadAt: serverTimestamp() });
  } catch {
    // Reading is a convenience: a refused write changes nothing the customer sees.
  }
}
