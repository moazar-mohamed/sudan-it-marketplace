import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type NotificationType =
  | 'payment_confirmed'
  | 'out_for_delivery'
  | 'order_completed'
  | 'review_reply'
  | 'technician_assigned'
  | 'job_ready'
  | 'job_cancelled'
  | 'service_request_accepted'
  | 'service_request_rejected'
  | 'service_request_in_progress'
  | 'service_request_completed';

interface Notice {
  type: NotificationType;
  recipientType: 'customer' | 'technician';
  recipientId: string;
  productName: string;
  /** An order's id, or, for a service request notice, the request's id. */
  orderId?: string;
  serviceRequestId?: string;
}

/**
 * Writes one notification (no text of its own: the apps build the words from
 * the type and the name). The id is fixed per subject and type, so sending the
 * same notice twice is refused as an edit, which is fine and ignored.
 * Returns false when it could not be sent; the action it follows is never undone.
 */
export async function sendNotice(notice: Notice): Promise<boolean> {
  const subject = notice.serviceRequestId ?? notice.orderId ?? '';
  const id =
    notice.recipientType === 'technician'
      ? `${subject}_${notice.type}_${notice.recipientId}`
      : `${subject}_${notice.type}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      recipientType: notice.recipientType,
      recipientId: notice.recipientId,
      ...(notice.serviceRequestId ? { serviceRequestId: notice.serviceRequestId } : { orderId: notice.orderId }),
      type: notice.type,
      productName: notice.productName,
      isRead: false,
      createdAt: serverTimestamp(),
      senderId: auth.currentUser?.uid ?? '',
    });
    return true;
  } catch {
    // Refused (also when the same notice already exists): the action it follows stands.
    return false;
  }
}
