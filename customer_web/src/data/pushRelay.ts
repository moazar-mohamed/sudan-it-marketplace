import { auth } from '../firebase';

/*
 * The push relay (push_relay/): the apps ask it to send the push for a
 * notification or chat message they just wrote, and so does this site. The
 * relay checks the caller's sign-in, that the item is theirs, fresh and not
 * sent before, and words the push itself. It is best effort: what was written
 * is already stored for the apps to show, so a push that cannot be sent
 * (relay offline, a kind it does not know yet) changes nothing.
 */
export const PUSH_RELAY_URL: string =
  (import.meta.env.VITE_PUSH_RELAY_URL as string | undefined) ?? 'https://sudan-it-push.moazermohamed528.workers.dev';

async function ask(body: Record<string, string>, fetchImpl: typeof fetch): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;
    const response = await fetchImpl(`${PUSH_RELAY_URL}/push`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Asks the relay to push [notificationId] to its recipients' phones and browsers. Never throws. */
export const pushNotification = (notificationId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> =>
  ask({ notificationId }, fetchImpl);

/** Asks the relay to push a chat message this person just sent. Never throws. */
export const pushChatMessage = (chatId: string, messageId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> =>
  ask({ chatId, messageId }, fetchImpl);
