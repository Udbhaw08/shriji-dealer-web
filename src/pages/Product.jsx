import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY } from "../data/site";
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


const TAB_ITEMS = [
  { key: "Overview", labelKey: "tab_overview" },
  { key: "Specifications", labelKey: "tab_specs" },
  { key: "Videos", labelKey: "tab_videos" },
];

export default function Product() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const isGated = isPortalGated(session);
  const { products: PRODUCTS, loaded } = useProducts();
  const { t, tCat } = useLanguage();
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleBack = () => {
    if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate(isGated ? "/" : "/products");
    }
  };

  const pid = params.get("pid");

  const canSeePrice = session?.canSeeDealerPrice !== false;

  useEffect(() => {
    const lookupKey = pid || id;
    if (lookupKey) {
      const targetPb = canSeePrice ? (session?.dealer?.pricebookId || session?.dealer?.price_tier || "") : "";
      const pbParam = targetPb ? `?pricebook_id=${encodeURIComponent(targetPb)}` : "";
      apiFetch(`/api/products/${encodeURIComponent(lookupKey)}${pbParam}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.product) setFetchedProduct(data.product);
        })
        .catch(() => {});
    }
  }, [id, pid, session?.dealer?.pricebookId, session?.dealer?.price_tier, canSeePrice]);

  const p = useMemo(() => {
    let base = fetchedProduct;
    if (!base && pid) {
      base = PRODUCTS.find((x) => x.id === pid);
    }
    if (!base) {
      base = PRODUCTS.find(
        (x) =>
          x.id === id ||
          x.slug === id ||
          slugifyProduct(x.name) === id ||
          slugifyProduct(x.model) === id
      ) || null;
    }
    if (base && !canSeePrice && base.dealerRate) {
      return { ...base, dealerRate: null };
    }
    return base;
  }, [fetchedProduct, PRODUCTS, id, pid, canSeePrice]);

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
  const [tab, setTab] = useState(TAB_ITEMS[0].key);
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
    setFetchedProduct(null);
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
  const customerView = Boolean(fromId) || viewerCustomerView;

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

  const rawTag = Array.isArray(p?.tags) && p.tags.length > 0 ? p.tags[0] : (p?.tag || null);
  const tag = typeof rawTag === "string" ? rawTag : (rawTag?.tag_name || rawTag?.name || null);

  const displayTitle = p?.name || p?.model || "";

  const baseSpecs = [
    [t("spec_model"), displayTitle],
    p.zohoTitle && p.zohoTitle !== displayTitle && [t("spec_full_name"), p.zohoTitle],
    [t("spec_category"), tCat(p.cat, p.catLabel)],
    p.size && [t("spec_size"), p.size],
    p.finish && [t("spec_finish"), p.finish],
    p.brand && [t("spec_brand"), p.brand],
    p.features?.length && [t("spec_features"), p.features.join(", ")],
    p.customFields?.warranty && ["Warranty", p.customFields.warranty],
    p.code && [t("spec_code"), `${p.code}-${p.id.slice(-6)}`],
  ].filter(Boolean);

  const zohoSpecs = (p.specifications || []).map((s) => [
    s.group && s.group !== "General" ? `${s.group} - ${s.name}` : s.name,
    s.value,
  ]);

  const specs = [...baseSpecs, ...zohoSpecs];

  const overview =
    p.customFields?.overview ||
    p.description ||
    `The Sunshine ${displayTitle} combines ${p.finish?.toLowerCase() || "quality"} construction with ${
      p.features?.length ? p.features.join(" and ").toLowerCase() : "everyday reliability"
    }, making it a dependable choice for the modern Indian kitchen.`;

  const share = () => {
    const url = shareLink(p, me || sharedBy);
    const data = {
      title: p.name,
      text: `${displayTitle} — ${p.catLabel} from ${COMPANY.brand}.`,
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
            {/* Metadata Row matching Frame 2 */}
            <div className="detail-meta-row">
              <span className="detail-cat-pill">
                {tCat(p.cat, p.catLabel) || "Small Appliances"}
              </span>
              <span className="detail-sku-text">
                SKU: {p.model || p.sku || p.id}
              </span>
              <span className="detail-stock-status">
                <span className="detail-stock-dot" />
                In Wholesale Stock
              </span>
            </div>

            <h1 className="d2" style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {displayTitle}
            </h1>

            {/* 2x2 Feature Tiles: Dynamic from Zoho Commerce Tile Icons (1..8) with fallback */}
            <div className="detail-feature-tiles-grid">
              {Array.isArray(p.tileIcons) && p.tileIcons.length > 0 ? (
                p.tileIcons.slice(0, 4).map((tile, idx) => (
                  <div key={tile.index || idx} className="detail-feature-tile-card">
                    <div className="detail-feature-tile-icon-wrap">
                      {tile.image ? (
                        <img
                          src={tile.image}
                          alt={tile.text || `Feature ${tile.index || idx + 1}`}
                          style={{ width: 22, height: 22, objectFit: "contain", display: "block" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Icon
                          name={idx === 0 ? "bolt" : idx === 1 ? "flame" : idx === 2 ? "layers" : "shield"}
                          size={20}
                        />
                      )}
                    </div>
                    <span className="detail-feature-tile-sub">Feature {tile.index || idx + 1}</span>
                    <span className="detail-feature-tile-val">{tile.text}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="detail-feature-tile-card">
                    <div className="detail-feature-tile-icon-wrap">
                      <Icon name="layers" size={20} />
                    </div>
                    <span className="detail-feature-tile-sub">Body Quality</span>
                    <span className="detail-feature-tile-val">
                      {p.finish || (p.fkey === "glass" ? "Matte Toughened Glass" : p.fkey === "steel" ? "Stainless Steel" : p.features?.find((f) => f.toLowerCase().includes("steel") || f.toLowerCase().includes("glass")) || "Stainless Steel")}
                    </span>
                  </div>

                  <div className="detail-feature-tile-card">
                    <div className="detail-feature-tile-icon-wrap">
                      <Icon name="shield" size={20} />
                    </div>
                    <span className="detail-feature-tile-sub">Coverage</span>
                    <span className="detail-feature-tile-val">
                      {p.warranty || "Sunshine 2-Yr Warranty"}
                    </span>
                  </div>

                  <div className="detail-feature-tile-card">
                    <div className="detail-feature-tile-icon-wrap">
                      <Icon name="bolt" size={20} />
                    </div>
                    <span className="detail-feature-tile-sub">Ignition / Operation</span>
                    <span className="detail-feature-tile-val">
                      {p.features?.find((f) => f.includes("Ignition") || f.includes("Auto") || f.includes("Cut-Off") || f.includes("BLDC")) || (p.cat === "small_appliances" ? "Auto Cut-Off" : "Auto Ignition")}
                    </span>
                  </div>

                  <div className="detail-feature-tile-card">
                    <div className="detail-feature-tile-icon-wrap">
                      <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={20} />
                    </div>
                    <span className="detail-feature-tile-sub">Configuration</span>
                    <span className="detail-feature-tile-val">
                      {p.burners ? `${p.burners} Brass Burners` : p.features?.find((f) => f.includes("Base") || f.includes("Swivel") || f.includes("Speed")) || "360° Swivel Base"}
                    </span>
                  </div>
                </>
              )}
            </div>

            <PriceBlock
              p={p}
              customerView={customerView}
              dealer={me}
              sharedBy={sharedBy}
              canSeeDealerPrice={session?.canSeeDealerPrice !== false}
            />

            {!customerView && (
              <div className="actions" style={{ display: "grid", gap: "var(--s3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <a
                  className="btn btn-wa"
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hello! Take a look at Sunshine ${displayTitle} (${p.name}):\nRetail MRP: ${inr(priceFor(p).mrp)} (Incl. of all taxes)\n\n${shareLink(p, me)}\n\nAvailable with ${me?.name || "Authorised Dealer"}${[me?.city, me?.state].filter(Boolean).length ? ` (${[me?.city, me?.state].filter(Boolean).join(", ")})` : ""}${me?.phone ? ` · Contact: ${me.phone}` : ""}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="wa" /> Share on WhatsApp
                </a>
                <button className="btn btn-ghost" onClick={share}>
                  <Icon name="share" /> {copied ? t("link_copied") : t("share_with_customer")}
                </button>
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

            <div className="utabs" role="tablist">
              {TAB_ITEMS.map((tItem) => (
                <button key={tItem.key} className="utab" role="tab" aria-selected={tab === tItem.key} onClick={() => setTab(tItem.key)}>
                  {t(tItem.labelKey)}
                </button>
              ))}
            </div>

            <div className="overview" role="tabpanel">
              {tab === "Overview" && (
                <>
                  <h3>{t("overview_engineered_title")}</h3>
                  <p className="muted" style={{ fontSize: "0.93rem", whiteSpace: "pre-line" }}>
                    {overview}
                  </p>
                  {p.customFields?.keyFeatures && (
                    <div style={{ marginTop: "var(--s4)" }}>
                      <h4 style={{ fontSize: "1rem", marginBottom: "var(--s2)", fontWeight: 600 }}>Key Features</h4>
                      <p className="muted" style={{ fontSize: "0.93rem", whiteSpace: "pre-line" }}>
                        {p.customFields.keyFeatures}
                      </p>
                    </div>
                  )}
                  {p.customFields?.warranty && (
                    <div style={{ marginTop: "var(--s4)" }}>
                      <h4 style={{ fontSize: "1rem", marginBottom: "var(--s2)", fontWeight: 600 }}>Warranty</h4>
                      <p className="muted" style={{ fontSize: "0.93rem" }}>
                        {p.customFields.warranty}
                      </p>
                    </div>
                  )}
                </>
              )}

              {tab === "Specifications" && (
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

              {tab === "Videos" && (
                <>
                  <h3>{t("tab_videos")}</h3>
                  {p.videos && p.videos.length > 0 ? (
                    <div style={{ display: "grid", gap: "var(--s4)", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: "var(--s3)" }}>
                      {p.videos.map((vid, idx) => (
                        <div key={idx} style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", background: "#000" }}>
                          <iframe
                            src={vid}
                            title={`${displayTitle} Video ${idx + 1}`}
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: "0.93rem" }}>
                      {t("no_videos_uploaded", { model: displayTitle })}
                    </p>
                  )}
                </>
              )}
            </div>
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
