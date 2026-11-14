import { useEffect, useState } from 'react';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { arrayRemove, doc, getDoc, updateDoc } from 'firebase/firestore';
import { app, db } from '../firebase';

/*
 * Pushes to this browser, when no page of the site is open. The browser's own
 * address for pushes (an FCM token) is kept with the person's phones in
 * users/{uid}.fcmTokens, so the relay sends to both; the worker in
 * public/push-sw.js shows them (the admin panel's own copy, with its pages). Nothing happens until the person presses
 * "turn on": the browser asks for permission only then.
 */

/** The project's own Web Push key (public: Firebase Console > Cloud Messaging > Web Push certificates). */
export const VAPID_KEY = 'BO658X2QrQX4iNfoZwNV3qDLWhr_d-K5t9Mtnvp7_YTZ-FYe_4sl2VxRLwht8oIcYhpBYx-C1fn-9IxH75gnnmQ';

/** How many devices (phones and browsers) a person keeps; the app keeps the same number, the rules allow 10. */
export const MAX_PUSH_TOKENS = 8;

const WORKER = '/push-sw.js';
const SCOPE = '/push/';
const TOKEN_KEY = 'sudan_admin_push_token';

export type PushState =
  /** This browser cannot receive pushes. */
  | 'unsupported'
  /** An iPhone or iPad: pushes come only once the site is added to the Home Screen and opened from there. */
  | 'homeScreen'
  /** The person refused it in the browser; only the browser's site settings can undo that. */
  | 'blocked'
  | 'off'
  | 'on';

/** [existing] with [token] moved (or added) last, keeping the newest [MAX_PUSH_TOKENS]. */
export function nextPushTokens(existing: unknown, token: string): string[] {
  const known = Array.isArray(existing) ? existing.filter((t): t is string => typeof t === 'string' && t !== token) : [];
  return [...known, token].slice(-MAX_PUSH_TOKENS);
}

/** An iPhone or iPad browser outside a Home Screen app: pushes need the site added to the Home Screen first. */
export function needsHomeScreen(nav: Navigator = navigator, standalone = matchMedia('(display-mode: standalone)').matches): boolean {
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return ios && !standalone;
}

const storedToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const storeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Kept for this visit only.
  }
};

async function supported(): Promise<boolean> {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && (await isSupported().catch(() => false));
}

export async function pushState(): Promise<PushState> {
  if (needsHomeScreen()) return 'homeScreen';
  if (!(await supported())) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && storedToken() ? 'on' : 'off';
}

async function currentToken(): Promise<string> {
  const registration = await navigator.serviceWorker.register(WORKER, { scope: SCOPE });
  return getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
}

/** Keeps [token] last in the person's devices (the newest stay). */
async function saveToken(uid: string, token: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  const stored = (await getDoc(ref)).data()?.fcmTokens;
  const next = nextPushTokens(stored, token);
  if (Array.isArray(stored) && stored.length === next.length && stored.every((t, i) => t === next[i])) return;
  await updateDoc(ref, { fcmTokens: next });
}

/** Asks the browser, then registers this browser for [uid]'s pushes. */
export async function turnPushOn(uid: string): Promise<PushState> {
  if (needsHomeScreen()) return 'homeScreen';
  if (!(await supported())) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';
  const token = await currentToken();
  await saveToken(uid, token);
  storeToken(token);
  return 'on';
}

/** Stops pushes to this browser: its address is forgotten here, by FCM and in the person's devices. */
export async function turnPushOff(uid: string | null): Promise<void> {
  const token = storedToken();
  storeToken(null);
  if (!token) return;
  if (uid) await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }).catch(() => undefined);
  await deleteToken(getMessaging(app)).catch(() => undefined);
}

/**
 * On each visit with pushes on, the browser's address is read again (FCM may
 * have renewed it) and moved last among the person's devices, so a browser in
 * use is never the one dropped.
 */
export async function refreshPush(uid: string): Promise<void> {
  if ((await pushState()) !== 'on') return;
  try {
    const token = await currentToken();
    const before = storedToken();
    await saveToken(uid, token);
    if (before && before !== token) {
      await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(before) }).catch(() => undefined);
    }
    storeToken(token);
  } catch {
    // Offline or refused: the stored address is tried again next visit.
  }
}

/** The state of this browser, and a way to change it. */
export function usePushState(): [PushState | null, (next: PushState) => void] {
  const [state, setState] = useState<PushState | null>(null);
  useEffect(() => {
    void pushState().then(setState);
  }, []);
  return [state, setState];
}

/** A pressed push asks the open tab to move to its page: [go] is the router's navigate. */
export function listenForPushOpens(go: (path: string) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const channel = new BroadcastChannel('push-open');
  channel.onmessage = (event: MessageEvent<{ path?: unknown }>) => {
    const path = event.data?.path;
    if (typeof path === 'string' && path.startsWith('/')) go(path);
  };
  return () => channel.close();
}
