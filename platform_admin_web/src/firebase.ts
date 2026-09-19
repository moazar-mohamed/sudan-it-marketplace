import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Public Firebase web app identifiers for the existing "sudan-it-marketplace"
// project (the same values already shipped in the Flutter app's
// firebase_options.dart). These identify the project; they are not secrets.
// Access control is enforced by Firestore security rules, never by this file.
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
export const db = getFirestore(app);
