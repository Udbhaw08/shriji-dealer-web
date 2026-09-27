import { useSyncExternalStore } from "react";
import { CATEGORIES as INITIAL_CATEGORIES } from "./products";
import { apiUrl } from "./api";

const CACHE_KEY = "shriji.zoho.products.v2";

const PREFERRED_ORDER = ["hob_tops", "gas_stoves", "hobs", "chimneys", "small_appliances"];

function sanitizeCategories(cats) {
  if (!Array.isArray(cats)) return INITIAL_CATEGORIES;
  const filtered = cats.filter(
    (c) =>
      c &&
      c.key !== "all_products" &&
      c.key !== "all" &&
      c.label?.trim().toLowerCase() !== "all products"
  );
  const list = filtered.length > 0 ? filtered : INITIAL_CATEGORIES;
  return [...list].sort((a, b) => {
    const ai = PREFERRED_ORDER.indexOf(a.key);
    const bi = PREFERRED_ORDER.indexOf(b.key);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });
}

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.products) && data.products.length > 0) {
        return {
          products: data.products,
          categories: sanitizeCategories(data.categories),
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
  fetchPromise = fetch(apiUrl(url))
    .then((res) => res.json())
    .then((data) => {
      fetchPromise = null;
      if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
        const liveCategories = data.categories?.length
          ? sanitizeCategories(data.categories)
          : storeState.categories;
        storeState = {
          products: data.products,
          categories: liveCategories,
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
