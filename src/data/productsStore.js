import { useSyncExternalStore } from "react";
import { CATEGORIES as INITIAL_CATEGORIES } from "./products.js";
import { apiFetch, apiUrl } from "./api.js";
import { getAccessToken } from "./auth.js";

const CACHE_KEY_PREFIX = "shriji.zoho.products.v7";

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

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache

let activePricebookId = null;

function loadCached(pbId = activePricebookId) {
  try {
    const raw = localStorage.getItem(getCacheKey(pbId));
    if (raw) {
      const data = JSON.parse(raw);
      const isStale = !data.time || (Date.now() - data.time > CACHE_TTL_MS);
      const hasAnyTags = Array.isArray(data.products) && data.products.some((p) => p.tags && p.tags.length > 0);
      const hasAnyTrial = Array.isArray(data.products) && data.products.some((p) => p.isTrial || p.isBestseller || p.collections?.includes("bestseller"));
      if (Array.isArray(data.products) && data.products.length > 0) {
        return {
          products: data.products,
          categories: sanitizeCategories(data.categories),
          loaded: true,
          syncing: isStale || !hasAnyTags || !hasAnyTrial,
          pricebookId: pbId,
          needsRefresh: isStale || !hasAnyTags || !hasAnyTrial,
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
    needsRefresh: true,
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
  const headers = {};
  const token = typeof getAccessToken === "function" ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  fetchPromise = apiFetch(url, { headers })
    .then((res) => res.json())
    .then((data) => {
      fetchPromise = null;
      if (data.ok && Array.isArray(data.products) && data.products.length > 0) {
        const liveCategories = data.categories?.length
          ? sanitizeCategories(data.categories)
          : storeState.categories;

        // Ensure restricted pricing is never cached for unauthenticated users
        const safeCachedProducts = data.products.map((p) => {
          const item = { ...p };
          delete item.purchaseRate;
          if (!targetPb) delete item.dealerRate;
          return item;
        });

        storeState = {
          products: safeCachedProducts,
          categories: liveCategories,
          loaded: true,
          syncing: false,
          pricebookId: targetPb,
        };
        try {
          localStorage.setItem(
            getCacheKey(targetPb),
            JSON.stringify({
              products: safeCachedProducts,
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
  const isIncognito = Boolean(session?.isIncognito);
  const canSeePrice = Boolean(session?.canSeeDealerPrice && !isIncognito);
  const isApproved = session?.status === "approved" || session?.status === "active";
  const pbId = (!isIncognito && session && (session.role === "dealer" || session.role === "staff" || session.role === "dealer_staff" || session.role === "admin") && isApproved && canSeePrice)
    ? (session.dealer?.pricebookId || session.dealer?.price_tier || "3334672000000547177")
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
  fetchLiveProducts(Boolean(storeState.needsRefresh));
}

export async function syncTagsLive() {
  try {
    const res = await apiFetch("/api/products/sync-tags");
    const data = await res.json();
    if (data.ok) {
      await fetchLiveProducts(true, activePricebookId);
      return data;
    }
  } catch (err) {
    console.warn("Failed to sync tags:", err);
  }
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
