import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

// Public identifiers of the existing "sudan-it-marketplace" project (the same
// values the Flutter app and the other panels ship). They identify the
// project, they are not secrets: access is enforced by Firestore security rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyAfI2D3QwE6ULN6Vq6aiMJIet9z4pHIaAY',
  authDomain: 'sudan-it-marketplace.firebaseapp.com',
  projectId: 'sudan-it-marketplace',
  storageBucket: 'sudan-it-marketplace.firebasestorage.app',
  messagingSenderId: '442723121540',
  appId: '1:442723121540:web:afaed35b4677c5d0aa05d1',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/*
 * Technicians work in the street on a weak network: Firestore keeps the last
 * copy on the device (shared by every open tab), so the jobs show offline, and
 * a status change made offline is kept and sent by itself when the network is back.
 * A browser that refuses storage (a private window) simply works online only.
 */
function openFirestore(): Firestore {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    return initializeFirestore(app, {});
  }
}

export const db = openFirestore();

// Local testing only: `.env.local` (gitignored) with VITE_EMULATOR=1 points the
// portal at the Firebase emulators instead of the real project.
if (import.meta.env.VITE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
