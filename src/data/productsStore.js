import { useSyncExternalStore } from "react";
import { CATEGORIES as INITIAL_CATEGORIES } from "./products";

const CACHE_KEY = "shriji.zoho.products.v2";

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.products) && data.products.length > 0) {
        return {
          products: data.products,
          categories: data.categories || INITIAL_CATEGORIES,
          loaded: true,
          syncing: false,
        };
      }
    }
  } catch {}
  return {
    products: [],
    categories: INITIAL_CATEGORIES,
    loaded: false,
    syncing: true,
  };
}

let storeState = loadCached();
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

let fetchPromise = null;

export function fetchLiveProducts(force = false) {
  if (fetchPromise && !force) return fetchPromise;

  storeState = { ...storeState, syncing: true };
  emit();

  const url = force ? "/api/products?refresh=true" : "/api/products";
  fetchPromise = fetch(url)
    .then((res) => res.json())
    .then((data) => {
      fetchPromise = null;
      if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
        storeState = {
          products: data.products,
          categories: data.categories?.length ? data.categories : storeState.categories,
          loaded: true,
          syncing: false,
        };
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              products: data.products,
              categories: storeState.categories,
              time: Date.now(),
            })
          );
        } catch {}
        emit();
        return storeState;
      }
      storeState = { ...storeState, syncing: false };
      emit();
      return storeState;
    })
    .catch((err) => {
      fetchPromise = null;
      console.warn("Failed to fetch live Zoho products:", err);
      storeState = { ...storeState, syncing: false };
      emit();
      return storeState;
    });

  return fetchPromise;
}

// Automatically fetch latest live Zoho catalog whenever store is loaded
if (typeof window !== "undefined") {
  fetchLiveProducts();
}

export function useProducts() {
  const state = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => storeState,
    () => ({ products: [], categories: INITIAL_CATEGORIES, loaded: false, syncing: false })
  );

  return {
    products: state.products,
    categories: state.categories,
    loaded: state.loaded,
    syncing: state.syncing,
    refresh: () => fetchLiveProducts(true),
  };
}

export function useProduct(productId) {
  const { products } = useProducts();
  return products.find((p) => p.id === productId) || null;
}
