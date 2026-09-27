import { useSyncExternalStore } from "react";

const STORAGE_KEY = "shriji.favorites.v1";

function loadFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

let favoritesState = loadFromStorage();
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

function persist(next) {
  favoritesState = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to persist favorites to localStorage:", e);
    }
  }
  notify();
}

// Synchronize if changes happen in another browser tab
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      try {
        favoritesState = e.newValue ? JSON.parse(e.newValue) : [];
      } catch {
        favoritesState = [];
      }
      notify();
    }
  });
}

export function getFavorites() {
  return favoritesState;
}

export function isFavorite(id) {
  if (!id) return false;
  return favoritesState.includes(String(id));
}

export function addFavorite(id) {
  if (!id) return;
  const sid = String(id);
  if (!favoritesState.includes(sid)) {
    persist([sid, ...favoritesState]);
  }
}

export function removeFavorite(id) {
  if (!id) return;
  const sid = String(id);
  if (favoritesState.includes(sid)) {
    persist(favoritesState.filter((item) => item !== sid));
  }
}

export function toggleFavorite(id) {
  if (!id) return false;
  const sid = String(id);
  if (favoritesState.includes(sid)) {
    removeFavorite(sid);
    return false;
  } else {
    addFavorite(sid);
    return true;
  }
}

export function clearFavorites() {
  persist([]);
}

export function useFavorites() {
  const favorites = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => favoritesState,
    () => []
  );

  return {
    favorites,
    count: favorites.length,
    isFavorite: (id) => (id ? favorites.includes(String(id)) : false),
    toggleFavorite,
    addFavorite,
    removeFavorite,
    clearFavorites,
  };
}
