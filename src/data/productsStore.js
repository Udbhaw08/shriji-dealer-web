import { useSyncExternalStore } from "react";
import { CATEGORIES as INITIAL_CATEGORIES } from "./products";
import { apiFetch, apiUrl } from "./api";

const CACHE_KEY_PREFIX = "shriji.zoho.products.v3";

function getCacheKey(pbId) {
  return pbId ? `${CACHE_KEY_PREFIX}:${pbId}` : `${CACHE_KEY_PREFIX}:default`;
}

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

let activePricebookId = null;

function loadCached(pbId = activePricebookId) {
  try {
    const raw = localStorage.getItem(getCacheKey(pbId));
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.products) && data.products.length > 0) {
        return {
          products: data.products,
          categories: sanitizeCategories(data.categories),
          loaded: true,
          syncing: false,
          pricebookId: pbId,
        };
      }
    }
  } catch {}
  return {
    products: [],
    categories: INITIAL_CATEGORIES,
    loaded: false,
    syncing: true,
    pricebookId: pbId,
  };
}

let storeState = loadCached();
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

let fetchPromise = null;

export function fetchLiveProducts(force = false, pricebookId = null) {
  const targetPb = pricebookId !== null ? pricebookId : activePricebookId;
  if (fetchPromise && !force && targetPb === storeState.pricebookId) return fetchPromise;

  storeState = { ...storeState, syncing: true };
  emit();

  const params = new URLSearchParams();
  if (force) params.set("refresh", "true");
  if (targetPb) params.set("pricebook_id", targetPb);
  const q = params.toString();
  const url = q ? `/api/products?${q}` : "/api/products";

  fetchPromise = apiFetch(url)
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
          pricebookId: targetPb,
        };
        try {
          localStorage.setItem(
            getCacheKey(targetPb),
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

/**
 * Called by session store whenever authentication or dealer state converges.
 * Ensures the product store instantly adapts to the dealer's assigned Zoho Commerce Pricebook.
 */
export function syncPricebookWithSession(session) {
  const canSeePrice = session?.canSeeDealerPrice !== false;
  const pbId = (session && session.role === "dealer" && session.status === "approved" && canSeePrice)
    ? (session.dealer?.pricebookId || session.dealer?.price_tier || null)
    : null;
  if (pbId !== activePricebookId) {
    activePricebookId = pbId;
    const cached = loadCached(pbId);
    if (cached.loaded) {
      storeState = cached;
      emit();
    }
    fetchLiveProducts(true, pbId);
  }
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
    refresh: () => fetchLiveProducts(true, activePricebookId),
  };
}

export function useProduct(productId) {
  const { products } = useProducts();
  return products.find((p) => p.id === productId) || null;
}
