import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY } from "../data/site";
import { registerDealer, shareLink, tagFor, viewerFor } from "../data/dealer";
import { useSession } from "../data/session";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";
import PriceBlock from "../components/PriceBlock";

/* Feature boxes mirror the mockup: icon over a two-line label. */
function featureBoxes(p, t) {
  const out = [];
  if (p.burners) out.push({ icon: "flame", label: `${p.burners} ${t("feat_brass_burners")}` });
  if (p.features.includes("Auto Ignition")) out.push({ icon: "bolt", label: t("feat_auto_ignition") });
  if (p.fkey === "glass") out.push({ icon: "glass", label: t("feat_toughened_glass") });
  if (p.fkey === "steel" || p.fkey === "alloy") out.push({ icon: "steel", label: t("feat_ss_body") });
  if (p.features.includes("BLDC Motor")) out.push({ icon: "bolt", label: t("feat_bldc_motor") });
  if (p.features.includes("Spill Proof")) out.push({ icon: "shield", label: t("feat_spill_proof") });
  if (p.features.includes("Flame Failure Device")) out.push({ icon: "shield", label: t("feat_flame_failure") });
  out.push({ icon: "shield", label: t("feat_sunshine_warranty") });
  return out.slice(0, 4);
}

const TAB_ITEMS = [
  { key: "Overview", labelKey: "tab_overview" },
  { key: "Specifications", labelKey: "tab_specs" },
  { key: "Videos", labelKey: "tab_videos" },
];

export default function Product() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession();
  const { products: PRODUCTS, loaded } = useProducts();
  const { t, tCat } = useLanguage();
  const [fetchedProduct, setFetchedProduct] = useState(null);

  useEffect(() => {
    if (id) {
      fetch(`/api/products/${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.product) setFetchedProduct(data.product);
        })
        .catch(() => {});
    }
  }, [id]);

  const p = useMemo(() => {
    return fetchedProduct || PRODUCTS.find((x) => x.id === id) || null;
  }, [fetchedProduct, PRODUCTS, id]);

  const [shot, setShot] = useState(0);
  const [shotError, setShotError] = useState(false);
  const [tab, setTab] = useState(TAB_ITEMS[0].key);
  const [copied, setCopied] = useState(false);

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
  const { sharedBy: localSharedBy, me, customerView: viewerCustomerView } = viewerFor(session, fromId);
  const [remoteSharedBy, setRemoteSharedBy] = useState(null);

  useEffect(() => {
    if (fromId && !localSharedBy && !remoteSharedBy) {
      fetch(`/api/dealer/info?id=${encodeURIComponent(fromId)}`)
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

  // Gallery shots: use product images from Zoho, clean duplicates, or fallback
  const shots = useMemo(() => {
    if (!p) return [];
    if (p.images && p.images.length > 0) {
      const clean = p.images.filter(Boolean);
      return Array.from(new Set(clean));
    }
    const others = PRODUCTS.filter((x) => x.cat === p.cat && x.img && x.img !== p.img)
      .map((x) => x.img)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    return [p.img, ...others].filter(Boolean);
  }, [p, PRODUCTS]);

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

  const tag = tagFor(p);

  const displayTitle = p?.model && p.model.toLowerCase() !== "test" ? p.model : (p?.name || "");

  const specs = [
    [t("spec_model"), displayTitle],
    [t("spec_full_name"), p.name],
    [t("spec_category"), tCat(p.cat, p.catLabel)],
    p.size && [t("spec_size"), p.size],
    [t("spec_finish"), p.finish],
    [t("spec_brand"), p.brand],
    p.features.length && [t("spec_features"), p.features.join(", ")],
    [t("spec_code"), `${p.code}-${p.id.slice(-6)}`],
  ].filter(Boolean);

  const overview = `The Sunshine ${displayTitle} combines ${p.finish.toLowerCase()} construction with ${
    p.features.length ? p.features.join(" and ").toLowerCase() : "everyday reliability"
  }, making it a dependable choice for the modern Indian kitchen.`;

  const share = () => {
    const url = shareLink(p, me);
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
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">{t("nav_home")}</Link>
          <Icon name="chev" size={13} />
          <Link to={`/products?cat=${p.cat}`}>{tCat(p.cat, p.catLabel)}</Link>
          <Icon name="chev" size={13} />
          <span>{displayTitle}</span>
        </nav>

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
            >
              {shots.length && !shotError ? (
                <img
                  key={shots[shot]}
                  src={shots[shot]?.startsWith("http") ? shots[shot] : `/img/${shots[shot]}`}
                  alt={`${p.name}, view ${shot + 1} of ${shots.length}`}
                  onError={() => setShotError(true)}
                  draggable={false}
                />
              ) : (
                <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={90} style={{ color: "var(--tx-3)" }} />
              )}
              {tag && <span className={`badge badge-${tag.kind === "blue" ? "blue" : ""} prod-tag`}>{tag.label}</span>}

              {shots.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery-nav gallery-nav-prev"
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
                    className="gallery-nav gallery-nav-next"
                    aria-label="Next image"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextShot();
                    }}
                  >
                    <Icon name="chev" size={18} />
                  </button>

                  <div className="gallery-counter">
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
            <h1 className="d2">{displayTitle}</h1>
            <p className="muted" style={{ marginTop: 6, fontWeight: 600 }}>
              {[p.size, p.features[0], p.catLabel].filter(Boolean).join(" · ")}
            </p>

            <div className="feats">
              {featureBoxes(p, t).map((f) => (
                <div className="feat" key={f.label}>
                  <Icon name={f.icon} size={20} />
                  <span style={{ whiteSpace: "pre-line" }}>{f.label}</span>
                </div>
              ))}
            </div>

            <PriceBlock p={p} customerView={customerView} dealer={me} sharedBy={sharedBy} />

            {!customerView && (
              <>
                <div className="actions">
                  <button className="btn btn-ghost" onClick={share}>
                    <Icon name="share" /> {copied ? t("link_copied") : t("share_with_customer")}
                  </button>
                  <Link className="btn btn-ghost" to="/schemes">
                    <Icon name="tag" /> {t("current_scheme")}
                  </Link>
                </div>
              </>
            )}

            {sharedBy && me && (
              <div className="viewnote">
                <Icon name="eyeoff" size={16} />
                <span>
                  This is the customer view of a link from <b>{sharedBy.name}</b>.
                </span>
                {sharedBy.id === me.id && (
                  <button className="link" onClick={backToDealerView}>
                    Back to dealer view
                  </button>
                )}
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
                  <p className="muted" style={{ fontSize: "0.93rem" }}>
                    {overview}
                  </p>
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
                  <p className="muted" style={{ fontSize: "0.93rem" }}>
                    {t("no_videos_uploaded", { model: p.model })}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* related sits below the whole detail block, so it never jumps above the
            info column when the grid collapses to one column on a phone */}
        {related.length > 0 && (
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
    </section>
  );
}
