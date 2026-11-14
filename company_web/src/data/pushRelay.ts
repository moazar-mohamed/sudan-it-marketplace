import { auth } from '../firebase';

/*
 * The push relay (push_relay/): the apps ask it to send the phone push for a
 * notification they just wrote, and so does this panel. The relay checks the
 * caller's sign-in, that the notification is theirs, fresh and not sent before,
 * and words the push itself. It is best effort: the notification is already
 * stored for the app to show, so a push that cannot be sent (relay offline, a
 * kind it does not know yet) changes nothing.
 */
export const PUSH_RELAY_URL: string =
  (import.meta.env.VITE_PUSH_RELAY_URL as string | undefined) ?? 'https://sudan-it-push.moazermohamed528.workers.dev';

/** Asks the relay to push a chat message this person just sent (to the customer's phones and browsers). Never throws. */
export async function pushChatMessage(chatId: string, messageId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;
    const response = await fetchImpl(`${PUSH_RELAY_URL}/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, messageId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Asks the relay to push [notificationId] to the recipient's phones and browsers. Never throws. */
export async function pushToPhone(notificationId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;
    const response = await fetchImpl(`${PUSH_RELAY_URL}/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
