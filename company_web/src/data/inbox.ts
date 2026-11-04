import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { mapChat, toDate } from './mappers';
import type { Chat } from './types';

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

/** The company's notifications (newest first, the latest 100), live. Null while they load. */
export function useNotices(companyId: string): Notice[] | null {
  const [list, setList] = useState<Notice[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'notifications'), where('recipientType', '==', 'company_admin'), where('recipientId', '==', companyId)),
        (snap) =>
          setList(
            snap.docs
              .map<Notice>((d) => ({
                id: d.id,
                type: s(d.data().type),
                orderId: s(d.data().orderId),
                serviceRequestId: s(d.data().serviceRequestId),
                productId: s(d.data().productId),
                productName: s(d.data().productName),
                isRead: d.data().isRead === true,
                createdAt: toDate(d.data().createdAt),
              }))
              .sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity))
              .slice(0, 100),
          ),
        () => setList([]),
      ),
    [companyId],
  );
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
    case 'new_order': return { title: 'طلب جديد', body: `وصلك طلب جديد على «${name}». راجع الإيصال.`, to: order };
    case 'new_review': return { title: 'تقييم جديد', body: `قيّم عميل «${name}».`, to: '/team' };
    case 'new_service_request': return { title: 'طلب خدمة جديد', body: `طلب عميل الخدمة «${name}».`, to: '/services' };
    case 'service_request_cancelled': return { title: 'أُلغي طلب خدمة', body: `ألغى عميل طلبه للخدمة «${name}».`, to: '/services' };
    case 'job_completed': return { title: 'اكتملت مهمة تركيب', body: `أنهى الفني تركيب «${name}».`, to: order };
    case 'order_cancelled_by_admin_company': return { title: 'ألغت المنصة طلبًا', body: `ألغت المنصة الطلب الخاص بـ«${name}».`, to: order };
    case 'product_hidden': return { title: 'أُخفي منتج', body: `أُخفي «${name}» عن العملاء. افتحه لمعرفة السبب.`, to: n.productId ? `/products/${n.productId}` : '/products' };
    case 'product_shown': return { title: 'عاد المنتج ظاهرًا', body: `«${name}» ظاهر للعملاء من جديد.`, to: n.productId ? `/products/${n.productId}` : '/products' };
    case 'account_converted_to_company': return { title: 'أصبح حسابك حساب شركة', body: `شركة «${name}» جاهزة.`, to: '/' };
    case 'report_in_progress': return { title: 'بلاغك قيد المعالجة', body: `بدأنا العمل على «${name}».`, to: '/' };
    case 'report_closed': return { title: 'أُغلق بلاغك', body: `أُغلق بلاغك «${name}». اقرأ ردّنا من «بلاغاتي» في التطبيق.`, to: '/' };
    default: return { title: 'إشعار', body: 'يوجد تحديث على أحد طلباتك.', to: n.orderId ? order : '/' };
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
export const chatSubject = (c: Chat): string => c.serviceName || c.productName || 'محادثة';

export async function markChatRead(chatId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'chats', chatId), { companyLastReadAt: serverTimestamp() });
  } catch {
    // Reading is a convenience: a refused write changes nothing the customer sees.
  }
}
