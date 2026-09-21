import { useSyncExternalStore } from "react";
import { TRANSLATIONS } from "./translations";

const STORAGE_KEY = "shriji.lang";
const DEFAULT_LANG = "en";

function getInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "hi" || saved === "en") return saved;
  } catch {
    /* private mode / storage unavailable */
  }
  return DEFAULT_LANG;
}

let currentLang = getInitialLang();
const listeners = new Set();

function emit() {
  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function setLanguage(lang) {
  if (lang !== "en" && lang !== "hi") return;
  if (currentLang === lang) return;
  currentLang = lang;
  emit();
}

export function toggleLanguage() {
  setLanguage(currentLang === "en" ? "hi" : "en");
}

export function getLanguage() {
  return currentLang;
}

export function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let text = dict[key] || TRANSLATIONS.en[key] || key;

  if (params && typeof params === "object") {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}

export function tCat(catKey, fallback = "") {
  if (!catKey) return fallback;
  const k = `cat_${catKey}`;
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return dict[k] || fallback || catKey;
}

export function useLanguage() {
  const lang = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentLang,
    () => DEFAULT_LANG,
  );

  return {
    lang,
    isHindi: lang === "hi",
    setLang: setLanguage,
    toggleLang: toggleLanguage,
    t,
    tCat,
  };
}
