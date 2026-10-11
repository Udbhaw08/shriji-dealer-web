import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

/* Firebase Client SDK setup for Phone SMS Authentication & Google Sign-In */
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
 * Initialize invisible reCAPTCHA verifier for phone SMS OTP.
 */
export function setupRecaptcha(containerId = "recaptcha-container") {
  let el = null;
  if (typeof document !== "undefined") {
    el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement("div");
      el.id = containerId;
      document.body.appendChild(el);
    }
  }
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear(); } catch { /* ignore */ }
    window.recaptchaVerifier = null;
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, el || containerId, {
    size: "invisible",
    callback: () => {},
    "expired-callback": () => {},
  });
  return window.recaptchaVerifier;
}

/**
 * Send real SMS OTP to Indian/international phone number via Google Firebase (10,000 free/month).
 */
export async function sendFirebasePhoneOtp(rawPhone, containerId = "recaptcha-container") {
  let clean = String(rawPhone || "").trim().replace(/[^\d+]/g, "");
  if (!clean.startsWith("+")) {
    if (clean.length === 10) clean = `+91${clean}`;
    else clean = `+${clean}`;
  }
  const verifier = setupRecaptcha(containerId);
  const confirmationResult = await signInWithPhoneNumber(auth, clean, verifier);
  window.confirmationResult = confirmationResult;
  return confirmationResult;
}

/**
 * Verify 6-digit code received on mobile phone via SMS.
 */
export async function verifyFirebasePhoneOtp(code, confirmationResult = window.confirmationResult) {
  if (!confirmationResult) throw new Error("No active OTP request found. Please request OTP again.");
  const userCredential = await confirmationResult.confirm(code);
  const idToken = await userCredential.user.getIdToken();
  return { user: userCredential.user, idToken };
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
