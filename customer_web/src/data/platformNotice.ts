import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { pushNotification } from './pushRelay';

/** The highest rating that tells the Platform Admins (firestore.rules checks the same number). */
export const LOW_REVIEW_MAX_STARS = 2;

type PlatformNotice =
  | { type: 'new_report'; reportId: string }
  | { type: 'low_review'; reviewId: string };

/** The notice the Platform Admins get about a report or review [senderId] just wrote. */
export function platformNoticeOf(notice: PlatformNotice, senderId: string, name: string) {
  const subjectId = notice.type === 'new_report' ? notice.reportId : notice.reviewId;
  const id = `${subjectId}_${notice.type}`;
  return {
    id,
    data: {
      id,
      recipientType: 'platform_admin',
      recipientId: 'platform',
      ...(notice.type === 'new_report' ? { reportId: notice.reportId } : { reviewId: notice.reviewId }),
      type: notice.type,
      productName: name,
      isRead: false,
      createdAt: serverTimestamp(),
      senderId,
    },
  };
}

/**
 * Tells every Platform Admin about a new report or a low rating, in their panel
 * and as a push. Its only text is the report's subject or the rated item's
 * name (the rules check it), its id is fixed so it is sent once, and it is
 * best effort: a refusal never undoes the report or the rating.
 */
export async function notifyPlatformAdmins(notice: PlatformNotice, senderId: string, name: string): Promise<void> {
  const { id, data } = platformNoticeOf(notice, senderId, name);
  try {
    await setDoc(doc(db, 'notifications', id), data);
  } catch {
    return;
  }
  void pushNotification(id);
}
