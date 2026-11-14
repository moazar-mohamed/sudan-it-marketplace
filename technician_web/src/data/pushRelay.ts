import { auth } from '../firebase';

/*
 * The push relay (push_relay/): the apps ask it to send the phone push for a
 * notification or job chat message they just wrote. The relay checks the
 * caller's sign-in, that the item is theirs, fresh and not sent before, and
 * words the push itself. Best effort: the item is already stored either way.
 */
export const PUSH_RELAY_URL: string =
  (import.meta.env.VITE_PUSH_RELAY_URL as string | undefined) ?? 'https://sudan-it-push.moazermohamed528.workers.dev';

async function post(body: Record<string, string>, fetchImpl: typeof fetch): Promise<boolean> {
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

/** Asks the relay to push [notificationId] to the recipient's phones and browsers. Never throws. */
export const pushToPhone = (notificationId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> =>
  post({ notificationId }, fetchImpl);

/** Asks the relay to push a job chat message the technician just sent to the company's admins. Never throws. */
export const pushJobChatMessage = (orderId: string, messageId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> =>
  post({ jobChatId: orderId, messageId }, fetchImpl);
