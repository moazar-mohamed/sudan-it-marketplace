import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// Firebase Performance Monitoring: page load, paint and request timings of real
// visitors go to the project's Firebase console. Loaded after the page so it never
// slows the first view; only in the deployed build, never against the emulators.
if (import.meta.env.PROD && !import.meta.env.VITE_EMULATOR && typeof window !== 'undefined') {
  void import('firebase/performance')
    .then(({ getPerformance }) => getPerformance(app))
    .catch(() => undefined);
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Local testing only: `.env.local` (gitignored) with VITE_EMULATOR=1 points the
// panel at the Firebase emulators instead of the real project.
if (import.meta.env.VITE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
