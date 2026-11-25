import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, signOut } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from 'firebase/firestore';

// Public identifiers of the existing "sudan-it-marketplace" project (the same
// values the Flutter app and the admin panel ship). They identify the project,
// they are not secrets: access is enforced by Firestore security rules.
// On sictm.net the Google sign-in window opens on sictm.net itself (Hosting serves
// /__/auth/ there), not on the project's firebaseapp.com address. Anywhere else
// (the web.app link, a local test) keeps the project's own sign-in address.
const SITE_DOMAINS = ['sictm.net', 'www.sictm.net'];
const authDomain =
  typeof window !== 'undefined' && SITE_DOMAINS.includes(window.location.hostname)
    ? 'sictm.net'
    : 'sudan-it-marketplace.firebaseapp.com';

const firebaseConfig = {
  apiKey: 'AIzaSyAfI2D3QwE6ULN6Vq6aiMJIet9z4pHIaAY',
  authDomain,
  projectId: 'sudan-it-marketplace',
  storageBucket: 'sudan-it-marketplace.firebasestorage.app',
  messagingSenderId: '442723121540',
  appId: '1:442723121540:web:afaed35b4677c5d0aa05d1',
};

export const app = initializeApp(firebaseConfig);

// Firebase App Check: tells Firebase that a request really comes from one of our
// sites, not from a script that copied the public identifiers above. The same
// reCAPTCHA Enterprise key serves all four sites (one Firebase web app). An empty
// key keeps it off. Firebase only refuses requests without a valid token once
// enforcement is switched on in the console; until then it only counts them.
export const APP_CHECK_SITE_KEY = '6LcLHzIuAAAAAJGYMd2ijEwwff5CTba6XjrlQHaP';
if (APP_CHECK_SITE_KEY && import.meta.env.PROD && !import.meta.env.VITE_EMULATOR && typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
export const auth = getAuth(app);

// What was read stays in this browser, so a return visit shows at once and then
// updates. Where the browser refuses, the SDK keeps it in memory instead.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/** Signs out and clears what this browser saved, so the next person on a shared computer finds nothing. */
export async function signOutHere(): Promise<void> {
  // This browser stops getting the person's pushes (best effort).
  const uid = auth.currentUser?.uid ?? null;
  await import('./data/webPush').then((m) => m.turnPushOff(uid)).catch(() => undefined);
  await signOut(auth);
  await terminate(db);
  await clearIndexedDbPersistence(db).catch(() => undefined);
  window.location.assign('/');
}

// Local testing only: `.env.local` (gitignored) with VITE_EMULATOR=1 points the
// site at the Firebase emulators instead of the real project.
if (import.meta.env.VITE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
