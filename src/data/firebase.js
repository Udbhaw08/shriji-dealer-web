import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

/* Firebase Client SDK setup for Firebase-backed identity and Google Sign-In */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDlTfMTfh89kjKp_LIzBRYyUGyOPogtmDo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "authentication-511306.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "authentication-511306",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "authentication-511306.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "896263697902",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:896263697902:web:bae9b538c6df42a0cacaff",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Z92GRS392K",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);


export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(firebaseApp);
    }
  }).catch(() => {});
}

/**
 * 1-Click Google Sign In with Firebase popup.
 */
export async function signInWithGoogleFirebase() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function signInWithEmailPassword(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}

export async function createEmailPasswordAccount(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return { user: result.user, idToken: await result.user.getIdToken() };
}
