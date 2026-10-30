import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { registerDealer, shareLink, viewerFor, inr, priceFor, slugifyProduct } from "../data/dealer";
import { useSession } from "../data/session";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";
import PriceBlock from "../components/PriceBlock";
import ProductSearchBar from "../components/ProductSearchBar";
import { useFavorites } from "../data/favoritesStore";
import { isPortalGated } from "../data/portalGate";
import { apiFetch } from "../data/api";
import { getAccessToken } from "../data/auth";
import { parseVideoUrl } from "../utils/video";




const productDetailsMemoryCache = new Map();
const CLIENT_DETAIL_TTL_MS = 30 * 1000; // 30s client TTL for live reflection of Zoho edits

function getCachedProductDetail(key) {
  if (!key) return null;
  const clean = String(key).trim();
  const slugified = slugifyProduct(clean);
  const now = Date.now();
  if (productDetailsMemoryCache.has(clean)) {
    const entry = productDetailsMemoryCache.get(clean);
    if (entry?.product && entry?.time && now - entry.time < CLIENT_DETAIL_TTL_MS) return entry.product;
  }
  if (slugified && productDetailsMemoryCache.has(slugified)) {
    const entry = productDetailsMemoryCache.get(slugified);
    if (entry?.product && entry?.time && now - entry.time < CLIENT_DETAIL_TTL_MS) return entry.product;
  }
  try {
    const raw = sessionStorage.getItem(`shriji.prod_detail.${clean}`) || (slugified ? sessionStorage.getItem(`shriji.prod_detail.${slugified}`) : null);
    if (raw) {
      const data = JSON.parse(raw);
      const prod = data.product || data;
      const cachedTime = data.time || 0;
      if (prod && prod.id && (!cachedTime || now - cachedTime < CLIENT_DETAIL_TTL_MS)) {
        return prod;
      }
    }
  } catch {}
  return null;
}

function setCachedProductDetail(key, product) {
  if (!key || !product) return;
  const clean = String(key).trim();
  const slugified = slugifyProduct(clean);
  const entry = { product, time: Date.now() };
  productDetailsMemoryCache.set(clean, entry);
  if (slugified) productDetailsMemoryCache.set(slugified, entry);
  if (product.id) productDetailsMemoryCache.set(String(product.id), entry);
  if (product.slug) productDetailsMemoryCache.set(product.slug, entry);
  try {
    const payload = JSON.stringify(entry);
    sessionStorage.setItem(`shriji.prod_detail.${clean}`, payload);
    if (product.slug) sessionStorage.setItem(`shriji.prod_detail.${product.slug}`, payload);
  } catch {}
}

export default function Product() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const isGated = isPortalGated(session);
  const { products: PRODUCTS, loaded } = useProducts();
  const { t, tCat } = useLanguage();
  const pid = params.get("pid");
  const lookupKey = pid || id;
  const [fetchedProduct, setFetchedProduct] = useState(() => getCachedProductDetail(lookupKey));
  const [isPriceFetching, setIsPriceFetching] = useState(() => {
    const cached = getCachedProductDetail(lookupKey);
    return !cached || typeof cached.dealerRate !== "number";
  });
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleBack = () => {
    if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(isGated ? "/" : "/products");
    }
  };

  const canSeePrice = Boolean(session?.canSeeDealerPrice && !session?.isIncognito);

  useEffect(() => {
    if (lookupKey) {
      const cached = getCachedProductDetail(lookupKey);
      if (!cached || typeof cached.dealerRate !== "number") {
        setIsPriceFetching(true);
      }
      const targetPb = canSeePrice ? (session?.dealer?.pricebookId || session?.dealer?.price_tier || "") : "";
      const pbParam = targetPb ? `?pricebook_id=${encodeURIComponent(targetPb)}` : "";
      const token = typeof getAccessToken === "function" ? getAccessToken() : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      apiFetch(`/api/products/${encodeURIComponent(lookupKey)}${pbParam}`, { headers })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.product) {
            setCachedProductDetail(lookupKey, data.product);
            setFetchedProduct(data.product);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsPriceFetching(false);
        });
    }
  }, [id, pid, lookupKey, session?.userId, session?.dealer?.pricebookId, session?.dealer?.price_tier, canSeePrice]);

  const p = useMemo(() => {
    const cleanId = id ? decodeURIComponent(id).trim() : "";
    const slugifiedId = slugifyProduct(cleanId);
    const catalogItem = pid
      ? PRODUCTS.find((x) => x.id === pid)
      : PRODUCTS.find(
          (x) =>
            x.id === cleanId ||
            x.slug === cleanId ||
            (slugifiedId && x.slug === slugifiedId)
            || (slugifiedId && slugifyProduct(x.name) === slugifiedId)
            || (slugifiedId && slugifyProduct(x.model) === slugifiedId)
            || (x.name && x.name.toLowerCase() === cleanId.toLowerCase())
            || (x.model && x.model.toLowerCase() === cleanId.toLowerCase())
        );

    let base = fetchedProduct
      ? {
          ...fetchedProduct,
          dealerRate: (typeof fetchedProduct.dealerRate === "number" && fetchedProduct.dealerRate > 0)
            ? fetchedProduct.dealerRate
            : (catalogItem?.dealerRate ?? null),
          mrp: (typeof fetchedProduct.mrp === "number" && fetchedProduct.mrp > 0)
            ? fetchedProduct.mrp
            : (catalogItem?.mrp ?? 0),
        }
      : catalogItem || null;

    if (base && !canSeePrice && base.dealerRate) {
      return { ...base, dealerRate: null };
    }
    return base;
  }, [fetchedProduct, PRODUCTS, id, pid, canSeePrice]);

  const featureTilesToRender = useMemo(() => {
    if (!p) return [];
    const cleanTileIcons = (Array.isArray(p.tileIcons) ? p.tileIcons : []).filter((tile) => {
      if (!tile || !tile.text) return false;
      const lowerText = tile.text.toLowerCase();
      const isGasCat = p.cat === "gas_stoves" || p.cat === "hobs" || p.cat === "hob_tops";
      if (lowerText.includes("ignition") && !isGasCat) return false;
      return true;
    });
    if (cleanTileIcons.length > 0) {
      return cleanTileIcons.slice(0, 4).map((tile, idx) => ({
        key: tile.index || idx,
        image: tile.image || "",
        icon: idx === 0 ? "bolt" : idx === 1 ? "flame" : idx === 2 ? "layers" : "shield",
        sub: (tile.label && !/^tile\s*icon\s*text\s*\d*$/i.test(tile.label) && !/^feature\s*\d*$/i.test(tile.label)) ? tile.label : "",
        val: tile.text,
      }));
    }
    // Purely dynamic: if Zoho Commerce has no tile icons configured, return empty (no mock tiles)
    return [];
  }, [p]);

  useEffect(() => {
    if (p) {
      const title = `${p.name} · Sunshine Appliances`;
      document.title = title;
      const setMeta = (prop, content) => {
        let el = document.querySelector(`meta[property="${prop}"]`);
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute("property", prop);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };
      setMeta("og:title", title);
      setMeta("og:description", `Retail MRP: ${inr(priceFor(p).mrp)} · Sunshine ReSTOR`);
      if (p.img) {
        setMeta("og:image", p.img.startsWith("http") ? p.img : window.location.origin + p.img);
      }
    }
  }, [p]);

  const [shot, setShot] = useState(0);
  const [shotError, setShotError] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const thumbsRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, time: 0 });
  const mouseDragRef = useRef({ startX: 0, isDown: false });

  // Reset shot index & fetched product state when id changes
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setShot(0);
    setShotError(false);
    const cached = getCachedProductDetail(pid || id);
    setFetchedProduct(cached || null);
    setIsPriceFetching(!cached || typeof cached.dealerRate !== "number");
  }

  // A ?from= link is a customer link, full stop. Whoever opens it — including the
  // dealer who sent it — gets the customer view and no way to reach a dealer price.
  const fromId = params.get("from");
  const { sharedBy: localSharedBy, me, customerView: viewerCustomerView } = viewerFor(session, fromId, params);
  const [remoteSharedBy, setRemoteSharedBy] = useState(null);

  useEffect(() => {
    if (fromId && !localSharedBy && !remoteSharedBy) {
      apiFetch(`/api/dealer/info?id=${encodeURIComponent(fromId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.dealer) {
            registerDealer(data.dealer);
            setRemoteSharedBy(data.dealer);
          }
        })
        .catch(() => {});
    }
  }, [fromId, localSharedBy, remoteSharedBy]);

  const sharedBy = localSharedBy || remoteSharedBy;
  const customerView = Boolean(fromId) || viewerCustomerView || Boolean(session?.isIncognito);

  const related = useMemo(
    () => (p ? PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id && x.img).slice(0, 4) : []),
    [p, PRODUCTS],
  );

  // Gallery shots: use product images from Zoho, clean duplicates, or fallback to main product image only
  const shots = useMemo(() => {
    if (!p) return [];
    if (p.images && p.images.length > 0) {
      const clean = p.images.filter(Boolean);
      return Array.from(new Set(clean));
    }
    return [p.img].filter(Boolean);
  }, [p]);

  const prevShot = useCallback(() => {
    if (shots.length <= 1) return;
    setShot((curr) => (curr > 0 ? curr - 1 : shots.length - 1));
    setShotError(false);
  }, [shots.length]);

  const nextShot = useCallback(() => {
    if (shots.length <= 1) return;
    setShot((curr) => (curr < shots.length - 1 ? curr + 1 : 0));
    setShotError(false);
  }, [shots.length]);

  // Keep active thumbnail centered in the scrollable strip
  useEffect(() => {
    if (thumbsRef.current && thumbsRef.current.children[shot]) {
      const activeThumb = thumbsRef.current.children[shot];
      if (typeof activeThumb.scrollIntoView === "function") {
        activeThumb.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [shot]);

  // Touch swipe handlers (for phone / mobile)
  const handleTouchStart = (e) => {
    if (shots.length <= 1) return;
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e) => {
    if (shots.length <= 1 || !touchRef.current.time) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;
    const dt = Date.now() - touchRef.current.time;
    touchRef.current.time = 0;

    // Trigger only if horizontal swipe dominates over vertical movement
    if (Math.abs(dx) > Math.abs(dy) * 1.1) {
      if (Math.abs(dx) > 35 || (dt < 280 && Math.abs(dx) > 20)) {
        if (dx < 0) {
          nextShot();
        } else {
          prevShot();
        }
      }
    }
  };

  // Mouse drag handlers (for desktop web)
  const handleMouseDown = (e) => {
    if (shots.length <= 1 || e.button !== 0) return;
    mouseDragRef.current = { startX: e.clientX, isDown: true };
  };

  const handleMouseUp = (e) => {
    if (!mouseDragRef.current.isDown || shots.length <= 1) return;
    mouseDragRef.current.isDown = false;
    const dx = e.clientX - mouseDragRef.current.startX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) {
        nextShot();
      } else {
        prevShot();
      }
    }
  };

  const handleMouseLeave = () => {
    mouseDragRef.current.isDown = false;
  };

  const handleKeyDown = (e) => {
    if (shots.length <= 1) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevShot();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextShot();
    }
  };

  // ---- Image Lightbox (fullscreen zoom like Amazon/Myntra) ----
  const openLightbox = (idx) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const lightboxPrev = () => {
    setLightboxIdx((i) => (i > 0 ? i - 1 : shots.length - 1));
  };
  const lightboxNext = () => {
    setLightboxIdx((i) => (i < shots.length - 1 ? i + 1 : 0));
  };

  // Escape key closes lightbox & body scroll lock
  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, shots.length]);

  if (!p) {
    if (!loaded) {
      return (
        <section className="sec" style={{ paddingTop: "var(--s8)" }}>
          <div className="wrap empty" style={{ minHeight: "320px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
              <Icon name="bolt" size={24} style={{ animation: "spin 1s linear infinite" }} />
            </span>
            <h2 className="h3">Loading product from Zoho…</h2>
            <p className="muted">Fetching real-time product details and live dealer pricing.</p>
          </div>
        </section>
      );
    }
    return (
      <section className="sec">
        <div className="wrap empty">
          <h1 className="h3">This page is not available</h1>
          <p className="muted">The link may be out of date. Open the catalogue and search by model name.</p>
          <Link className="btn btn-navy" style={{ marginTop: "var(--s5)" }} to="/products">
            Browse products
          </Link>
        </div>
      </section>
    );
  }

  const productTags = (Array.isArray(p?.tags) && p.tags.length > 0
    ? p.tags
    : (p?.tag ? [p.tag] : []))
    .map((t) => (typeof t === "string" ? t : (t?.tag_name || t?.name || "")).trim())
    .filter(Boolean);
  const tag = productTags[0] || null;

  const displayTitle = p?.name || p?.model || "";

  // 1. Zoho Specifications from Zoho API
  const zohoSpecs = (p.specifications || [])
    .filter((s) => s && (s.name || s.value))
    .map((s) => [
      s.group && s.group !== "General" ? `${s.group} - ${s.name}` : s.name,
      s.value,
    ]);

  // 2. Extra custom fields from Zoho
  const extraCfSpecs = (p.extraFields || []).map((f) => [f.label, f.value]);

  // 3. Known product attributes that actually have non-empty values from Zoho Commerce
  const attrSpecs = [
    displayTitle && [t("spec_model") || "Model", displayTitle],
    p.zohoTitle && p.zohoTitle !== displayTitle && [t("spec_full_name") || "Full Name", p.zohoTitle],
    p.sku && ["SKU", p.sku],
    (p.catLabel || p.cat) && [t("spec_category") || "Category", p.catLabel || tCat(p.cat)],
    p.brand && [t("spec_brand") || "Brand", p.brand],
    p.hsnCode && ["HSN Code", p.hsnCode],
    (p.fulfillment?.formattedDimensions || p.packageDetails?.formattedDimensions) && [
      "Dimensions (L × W × H)",
      p.fulfillment?.formattedDimensions || p.packageDetails?.formattedDimensions,
    ],
    (p.fulfillment?.formattedWeight || p.packageDetails?.formattedWeight) && [
      "Weight",
      p.fulfillment?.formattedWeight || p.packageDetails?.formattedWeight,
    ],
    p.customFields?.warranty && ["Warranty", p.customFields.warranty],
  ].filter(Boolean);

  const allSpecsList = [...zohoSpecs, ...extraCfSpecs, ...attrSpecs].filter(
    ([k, v]) => Boolean(k) && Boolean(v) && String(v).trim().toLowerCase() !== "test" && String(v).trim().toLowerCase() !== "null"
  );

  const seenSpecNames = new Set();
  const specs = [];
  for (const [k, v] of allSpecsList) {
    const normK = k.toLowerCase().trim();
    if (!seenSpecNames.has(normK)) {
      seenSpecNames.add(normK);
      specs.push([k, v]);
    }
  }

  // Specifications tab shows all unified attributes and Zoho specs
  const hasSpecs = specs.length > 0;

  // Clean overview: only use real text from Zoho Commerce (no synthetic defaults)
  const cleanOverviewText = (p.customFields?.overview || p.overview || "").trim();
  const rawDescText = (p.description || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
  const cleanDesc = rawDescText ? p.description : "";
  const overview = cleanOverviewText || cleanDesc || "";
  const hasKeyFeatures = Boolean(p.customFields?.keyFeatures?.trim());
  const hasWarranty = Boolean(p.customFields?.warranty?.trim());
  const hasOverview = Boolean(overview || hasKeyFeatures || hasWarranty);
  const hasVideos = Array.isArray(p.videos) && p.videos.length > 0;

  const availableTabs = [
    hasOverview && { key: "Overview", labelKey: "tab_overview" },
    hasSpecs && { key: "Specifications", labelKey: "tab_specs" },
    hasVideos && { key: "Videos", labelKey: "tab_videos" },
  ].filter(Boolean);

  const activeTabKey = availableTabs.some((tItem) => tItem.key === tab)
    ? tab
    : (availableTabs[0]?.key || "");

  const activeDealer = me || sharedBy;
  const dealerName = activeDealer?.name || activeDealer?.shop || "Authorised Partner";
  const dealerLoc = [activeDealer?.city, activeDealer?.state].filter(Boolean).join(", ");
  const dealerPhone = activeDealer?.phone || activeDealer?.phoneRaw || session?.phone || "";
  const dealerAttribution = `Available with Sunshine Partner (${dealerName})${dealerLoc ? ` (${dealerLoc})` : ""}${dealerPhone ? ` • Contact: ${dealerPhone}` : ""}`;

  const share = () => {
    const url = shareLink(p, activeDealer);
    const data = {
      title: p.name,
      text: `Hello! Take a look at Sunshine ${displayTitle} (${p.name}):\nRetail MRP: ${inr(priceFor(p).mrp)}\n\n${dealerAttribution}`,
      url,
    };
    if (navigator.share) {
      navigator.share(data).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const backToDealerView = () => {
    const next = new URLSearchParams(params);
    next.delete("from");
    setParams(next, { replace: true });
  };



  return (
    <section className="sec product-detail-sec">
      <div className="wrap">
        <div className="app-mobile-top-bar">
          <button
            type="button"
            onClick={handleBack}
            className="app-mobile-back"
            aria-label={t("back") || "Back"}
          >
            <Icon name="chevleft" size={18} />
            <span>{t("back") || "Back"}</span>
          </button>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => toggleFavorite(p.id)}
              className="app-mobile-icon-btn"
              aria-label={isFavorite(p.id) ? "Remove from Favorites" : "Save to Favorites"}
              style={isFavorite(p.id) ? { color: "#dc4545", borderColor: "#fecaca", background: "#fef2f2" } : undefined}
              title={isFavorite(p.id) ? "Saved in Favorites" : "Save to Favorites"}
            >
              <Icon name="heart" size={17} style={isFavorite(p.id) ? { fill: "#dc4545" } : undefined} />
            </button>
            <button
              type="button"
              onClick={share}
              className="app-mobile-icon-btn"
              aria-label="Share product"
              title="Share product link"
            >
              <Icon name="share" size={17} />
            </button>
          </div>
        </div>

        <div className="product-top-bar desktop-only">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">{t("nav_home")}</Link>
            {!isGated && (
              <>
                <Icon name="chev" size={13} />
                <Link to={`/products?cat=${p.cat}`}>{tCat(p.cat, p.catLabel)}</Link>
              </>
            )}
            <Icon name="chev" size={13} />
            <span>{displayTitle}</span>
          </nav>

          {!isGated && (
            <div className="product-top-actions">
              <ProductSearchBar
                autoNavigate={true}
                placeholder={t("search_placeholder") || "Search products or models…"}
                style={{ width: "280px" }}
              />

              <button
                type="button"
                className="product-top-share"
                onClick={share}
                title="Share product link"
              >
                <Icon name="share" size={15} />
                <span>{copied ? t("link_copied") : t("share") || "Share"}</span>
              </button>
            </div>
          )}
        </div>

        <div className="detail">
          {/* ---- gallery ---- */}
          <div className="gallery">
            <div
              className={`gallery-main ${shots.length > 1 ? "gallery-interactive" : ""}`}
              tabIndex={shots.length > 1 ? 0 : undefined}
              role={shots.length > 1 ? "region" : undefined}
              aria-label={shots.length > 1 ? "Product image gallery. Use arrow keys or swipe to change images" : undefined}
              onKeyDown={handleKeyDown}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{ position: "relative" }}
            >
              {shots.length && !shotError ? (
                <img
                  key={shots[shot]}
                  src={shots[shot]?.startsWith("http") ? shots[shot] : `/img/${shots[shot]}`}
                  alt={`${p.name}, view ${shot + 1} of ${shots.length}`}
                  onError={() => setShotError(true)}
                  draggable={false}
                  onClick={() => openLightbox(shot)}
                  style={{ cursor: "zoom-in", pointerEvents: "auto" }}
                />
              ) : (
                <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={90} style={{ color: "var(--tx-3)" }} />
              )}
              {tag && <span className="badge badge-blue prod-tag">{tag}</span>}

              {shots.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery-nav-arrow-btn prev"
                    aria-label="Previous image"
                    onClick={(e) => {
                      e.stopPropagation();
                      prevShot();
                    }}
                  >
                    <Icon name="chevleft" size={18} />
                  </button>

                  <button
                    type="button"
                    className="gallery-nav-arrow-btn next"
                    aria-label="Next image"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextShot();
                    }}
                  >
                    <Icon name="chev" size={18} />
                  </button>

                  <div className="gallery-counter-badge">
                    {shot + 1} / {shots.length}
                  </div>
                </>
              )}
            </div>

            {shots.length > 1 && (
              <>
                <div className="dots">
                  {shots.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className="dot"
                      aria-current={i === shot}
                      aria-label={`View image ${i + 1}`}
                      onClick={() => {
                        setShot(i);
                        setShotError(false);
                      }}
                    />
                  ))}
                </div>
                <div className="thumbs" ref={thumbsRef}>
                  {shots.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      className="thumb"
                      aria-pressed={i === shot}
                      aria-label={`Select image ${i + 1}`}
                      onClick={() => {
                        setShot(i);
                        setShotError(false);
                      }}
                    >
                      <img
                        src={s?.startsWith("http") ? s : `/img/${s}`}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ---- info ---- */}
          <div>
            {/* Category Pill and Multiple Tags */}
            <div className="detail-meta-row" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <span className="detail-cat-pill">
                {tCat(p.cat, p.catLabel) || "Small Appliances"}
              </span>
              {productTags.map((tagText, idx) => (
                <span
                  key={idx}
                  className="badge badge-blue detail-tag-pill"
                  style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.04em", padding: "4px 8px", borderRadius: "4px", fontWeight: 700 }}
                >
                  {tagText}
                </span>
              ))}
            </div>

            <h1 className="d2" style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {displayTitle}
            </h1>

            {/* Feature Tiles: Dynamic from Zoho Commerce Tile Icons (1..8) or product attributes */}
            {featureTilesToRender.length > 0 && (
              <div className="detail-feature-tiles-grid">
                {featureTilesToRender.map((tile, idx) => (
                  <div key={tile.key || idx} className="detail-feature-tile-card">
                    <div className="detail-feature-tile-icon-wrap">
                      {tile.image ? (
                        <img
                          src={tile.image}
                          alt={tile.val || `Feature ${idx + 1}`}
                          style={{ width: 22, height: 22, objectFit: "contain", display: "block" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Icon name={tile.icon || "bolt"} size={20} />
                      )}
                    </div>
                    {tile.sub ? <span className="detail-feature-tile-sub">{tile.sub}</span> : null}
                    <span className="detail-feature-tile-val">{tile.val}</span>
                  </div>
                ))}
              </div>
            )}

            <PriceBlock
              key={p?.id || lookupKey}
              p={p}
              customerView={customerView}
              dealer={me}
              sharedBy={sharedBy}
              canSeeDealerPrice={Boolean(session?.canSeeDealerPrice)}
              loadingPrice={isPriceFetching}
            />

            {!customerView && (
              <div className="actions" style={{ display: "grid", gap: "var(--s3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <a
                  className="btn btn-wa"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hello! Take a look at Sunshine ${displayTitle} (${p.name}):\nRetail MRP: ${inr(priceFor(p).mrp)}\n\n${shareLink(p, activeDealer)}\n\n${dealerAttribution}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="wa" /> Share on WhatsApp
                </a>
                <button
                  type="button"
                  className={`btn ${isFavorite(p.id) ? "btn-navy" : "btn-ghost"}`}
                  onClick={() => toggleFavorite(p.id)}
                  style={isFavorite(p.id) ? { background: "#d64545", borderColor: "#d64545", color: "#fff" } : undefined}
                >
                  <Icon name="heart" size={17} style={isFavorite(p.id) ? { fill: "#fff" } : undefined} />
                  <span>{isFavorite(p.id) ? (t("filter_saved_only") || "Saved to Favorites") : "Save to Favorites"}</span>
                </button>
                {/* Hidden for now — will use this feature later */}
                {/* <Link className="btn btn-ghost" to="/schemes">
                  <Icon name="tag" /> {t("current_scheme")}
                </Link> */}
              </div>
            )}

            {sharedBy && me && sharedBy.id === me.id && (
              <div className="viewnote">
                <Icon name="share" size={16} />
                <span>
                  Shared link for <b>{sharedBy.name}</b>
                </span>
                <button className="link" onClick={backToDealerView}>
                  Back to dealer view
                </button>
              </div>
            )}

            {customerView && !sharedBy && !me && session.role === "guest" && (
              <p className="note" style={{ marginTop: "var(--s3)" }}>
                {t("price_retailer_prompt")}{" "}
                <Link className="link" to="/login">
                  {t("price_signin_link")}
                </Link>
                .
              </p>
            )}

            {availableTabs.length > 1 && (
              <div className="utabs" role="tablist">
                {availableTabs.map((tItem) => (
                  <button
                    key={tItem.key}
                    className="utab"
                    role="tab"
                    aria-selected={activeTabKey === tItem.key}
                    onClick={() => setTab(tItem.key)}
                  >
                    {t(tItem.labelKey)}
                  </button>
                ))}
              </div>
            )}

            {availableTabs.length > 0 && (
              <div className="overview" role="tabpanel">
                {activeTabKey === "Overview" && hasOverview && (
                  <>
                    {overview && (
                      <div style={{ marginBottom: "var(--s4)" }}>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: "var(--s2)" }}>{t("tab_overview") || "Overview"}</h3>
                        {/<[a-z][\s\S]*>/i.test(overview) ? (
                          <div
                            className="muted overview-html"
                            style={{ fontSize: "0.93rem", lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: overview }}
                          />
                        ) : (
                          <p className="muted" style={{ fontSize: "0.93rem", whiteSpace: "pre-line", lineHeight: 1.6 }}>
                            {overview}
                          </p>
                        )}
                      </div>
                    )}
                    {p.customFields?.keyFeatures && (
                      <div style={{ marginTop: overview ? "var(--s4)" : 0 }}>
                        <h4 style={{ fontSize: "1rem", marginBottom: "var(--s2)", fontWeight: 600 }}>Key Features</h4>
                        <p className="muted" style={{ fontSize: "0.93rem", whiteSpace: "pre-line" }}>
                          {p.customFields.keyFeatures}
                        </p>
                      </div>
                    )}
                    {p.customFields?.warranty && (
                      <div style={{ marginTop: (overview || p.customFields?.keyFeatures) ? "var(--s4)" : 0 }}>
                        <h4 style={{ fontSize: "1rem", marginBottom: "var(--s2)", fontWeight: 600 }}>Warranty</h4>
                        <p className="muted" style={{ fontSize: "0.93rem" }}>
                          {p.customFields.warranty}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {activeTabKey === "Specifications" && hasSpecs && (
                  <>
                    <h3>{t("tab_specs")}</h3>
                    <table className="spec">
                      <tbody>
                        {specs.map(([k, v]) => (
                          <tr key={k}>
                            <th scope="row">{k}</th>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="note" style={{ marginTop: "var(--s4)" }}>
                      {t("spec_live_note")}
                    </p>
                  </>
                )}

                {activeTabKey === "Videos" && hasVideos && (
                  <>
                    <h3>{t("tab_videos")}</h3>
                    <div style={{ display: "grid", gap: "var(--s4)", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: "var(--s3)" }}>
                      {p.videos.map((vid, idx) => {
                        const parsed = parseVideoUrl(vid);
                        const embedUrl = parsed?.embedUrl || (parsed?.type === "youtube" ? `https://www.youtube-nocookie.com/embed/${parsed.id}` : vid);
                        const isDirect = parsed?.type === "direct";

                        return (
                          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", background: "#000" }}>
                              {isDirect ? (
                                <video
                                  src={parsed.src}
                                  controls
                                  playsInline
                                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }}
                                />
                              ) : (
                                <iframe
                                  src={embedUrl}
                                  title={`${displayTitle} Video ${idx + 1}`}
                                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              )}
                            </div>
                            {parsed?.watchUrl && (
                              <a
                                href={parsed.watchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link"
                                style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                Watch on {parsed.provider || "Video"} <Icon name="arrowsm" size={12} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Only verified dealers can browse related products; customers on a shared link only see the shared item */}
        {!isGated && related.length > 0 && (
          <div style={{ marginTop: "var(--s7)" }}>
            <div className="sec-head">
              <h2>{t("more_in_category", { category: tCat(p.cat, p.catLabel) })}</h2>
              <Link className="link" to={`/products?cat=${p.cat}`}>
                {t("view_all")} <Icon name="arrowsm" size={15} />
              </Link>
            </div>
            <div className="prods">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Image Lightbox Modal (Amazon/Myntra style) ---- */}
      {lightboxOpen && shots.length > 0 && (
        <div
          className="image-lightbox-backdrop"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen product image"
        >
          <button
            type="button"
            className="image-lightbox-close"
            onClick={closeLightbox}
            aria-label="Close image viewer"
          >
            <Icon name="close" size={20} />
          </button>

          <div className="image-lightbox-img-container" onClick={(e) => e.stopPropagation()}>
            {shots.length > 1 && (
              <button
                type="button"
                className="image-lightbox-nav image-lightbox-nav-prev"
                onClick={lightboxPrev}
                aria-label="Previous image"
              >
                <Icon name="chevleft" size={20} />
              </button>
            )}

            <img
              key={shots[lightboxIdx]}
              src={shots[lightboxIdx]?.startsWith("http") ? shots[lightboxIdx] : `/img/${shots[lightboxIdx]}`}
              alt={`${p.name}, fullscreen view ${lightboxIdx + 1} of ${shots.length}`}
              draggable={false}
            />

            {shots.length > 1 && (
              <button
                type="button"
                className="image-lightbox-nav image-lightbox-nav-next"
                onClick={lightboxNext}
                aria-label="Next image"
              >
                <Icon name="chev" size={20} />
              </button>
            )}
          </div>

          <div className="image-lightbox-footer" onClick={(e) => e.stopPropagation()}>
            <span className="image-lightbox-counter">
              {lightboxIdx + 1} / {shots.length}
            </span>
            <a
              className="image-lightbox-download"
              href={shots[lightboxIdx]?.startsWith("http") ? shots[lightboxIdx] : `/img/${shots[lightboxIdx]}`}
              download={`${p.name || "product"}-image-${lightboxIdx + 1}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="download" size={14} /> Download
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
