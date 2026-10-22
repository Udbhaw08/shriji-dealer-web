import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY, QUICK_ACCESS } from "../data/site";
import { apiFetch } from "../data/api";
import { Icon, EnquiryButtons } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";
import HeroSlider from "../components/HeroSlider";
import { useSession } from "../data/session";
import { isPortalGated } from "../data/portalGate";


function useAutoScroll(trackRef, { interval = 4000, step = 260 } = {}) {
  const isPausedRef = useRef(false);
  const resumeTimerRef = useRef(null);

  const scrollNext = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (el.scrollLeft >= maxScroll - 16) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: step, behavior: "smooth" });
    }
  }, [trackRef, step]);

  const scrollPrev = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    if (el.scrollLeft <= 16) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
    } else {
      el.scrollBy({ left: -step, behavior: "smooth" });
    }
  }, [trackRef, step]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPausedRef.current) {
        scrollNext();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [scrollNext, interval]);

  const onMouseEnter = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const onMouseLeave = useCallback(() => {
    isPausedRef.current = false;
  }, []);

  const onTouchStart = useCallback(() => {
    isPausedRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isPausedRef.current = false;
    }, 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  return {
    scrollPrev,
    scrollNext,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
  };
}

export default function Home() {
  const { products: PRODUCTS, categories: CATEGORIES } = useProducts();
  const { t, tCat } = useLanguage();
  const catTrackRef = useRef(null);
  const prodTrackRef = useRef(null);
  const catScroll = useAutoScroll(catTrackRef, { interval: 4000, step: 240 });
  const prodScroll = useAutoScroll(prodTrackRef, { interval: 4200, step: 260 });

  const counts = useMemo(() => {
    const c = {};
    for (const p of PRODUCTS) c[p.cat] = (c[p.cat] || 0) + 1;
    return c;
  }, [PRODUCTS]);

  const featured = useMemo(
    () =>
      CATEGORIES.map((c) => PRODUCTS.filter((p) => p.cat === c.key && p.img).slice(0, 2))
        .flat()
        .slice(0, 14),
    [PRODUCTS, CATEGORIES],
  );

  const [liveSchemes, setLiveSchemes] = useState(() => {
    try {
      const raw = sessionStorage.getItem("shriji_supabase_schemes_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.active) && parsed.active.length > 0) {
          const hasLegacy = parsed.active.some(
            (s) => s.id === "annual-business-scheme-2026-27" || s.id === "diwali-scheme-2026"
          );
          if (!hasLegacy) return parsed.active;
        }
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    let active = true;
    apiFetch("/api/schemes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.schemes?.active) {
          setLiveSchemes(data.schemes.active);
          try {
            sessionStorage.setItem("shriji_supabase_schemes_v2", JSON.stringify(data.schemes));
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const [schemeIdx, setSchemeIdx] = useState(0);
  const scheme = liveSchemes[schemeIdx] || liveSchemes[0] || null;
  const session = useSession();
  const isGated = isPortalGated(session);

  return (
    <>
      {/* ---------- Hero Showcase Slider ---------- */}
      <HeroSlider isGated={isGated} t={t} />

      {/* ---------- Brand Tagline ---------- */}
      <section className="sec home-trust-sec">
        <div className="wrap">
          <div className="home-tagline-block">
            <h2 className="home-tagline-title">
              {t("home_tagline") || "Delivering the heart of every kitchen"}
            </h2>
            <div className="home-tagline-accent" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* When logged in as verified dealer: Show Browse by Category & Featured Products */}
      {!isGated && (
        <>
          {/* ---------- Browse by Category ---------- */}
          <section className="sec">
            <div className="wrap">
              <div className="sec-head">
                <h2>{t("sec_categories_title")}</h2>
                <div className="sec-head-controls sec-head-categories">
                  <div className="carousel-arrow-group" role="group" aria-label="Category scroll controls">
                    <button
                      type="button"
                      className="carousel-arrow-btn"
                      onClick={catScroll.scrollPrev}
                      aria-label="Scroll categories left"
                      title="Previous"
                    >
                      <Icon name="chevleft" size={17} />
                    </button>
                    <button
                      type="button"
                      className="carousel-arrow-btn"
                      onClick={catScroll.scrollNext}
                      aria-label="Scroll categories right"
                      title="Next"
                    >
                      <Icon name="chev" size={17} />
                    </button>
                  </div>
                  <Link className="link" to="/products">
                    {t("view_all")} <Icon name="arrowsm" size={15} />
                  </Link>
                </div>
              </div>
              <div className="carousel-wrap cat-carousel-wrap">
                <button
                  type="button"
                  className="carousel-track-btn prev"
                  onClick={catScroll.scrollPrev}
                  aria-label="Scroll categories left"
                  title="Previous"
                >
                  <Icon name="chevleft" size={20} />
                </button>
                <div
                  className="carousel-track cat-track"
                  ref={catTrackRef}
                  onMouseEnter={catScroll.onMouseEnter}
                  onMouseLeave={catScroll.onMouseLeave}
                  onTouchStart={catScroll.onTouchStart}
                  onTouchEnd={catScroll.onTouchEnd}
                >
                  {CATEGORIES.filter((c) => c.key !== "all_products" && c.key !== "all").map((c) => (
                    <Link className="cat" key={c.key} to={`/products?cat=${c.key}`}>
                      <span className="cat-img">
                        <img
                          src={c.img}
                          alt={tCat(c.key, c.label)}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = "/img/cat-small_appliances.webp";
                          }}
                        />
                      </span>
                      <span className="cat-foot">
                        <b>{tCat(c.key, c.label)}</b>
                      </span>
                    </Link>
                  ))}
                </div>
                <button
                  type="button"
                  className="carousel-track-btn next"
                  onClick={catScroll.scrollNext}
                  aria-label="Scroll categories right"
                  title="Next"
                >
                  <Icon name="chev" size={20} />
                </button>
              </div>
            </div>
          </section>

          {/* ---------- Featured ---------- */}
          <section className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div className="sec-head">
                <h2>{t("sec_fast_title")}</h2>
                <div className="sec-head-controls">
                  <div className="carousel-arrow-group" role="group" aria-label="Product scroll controls">
                    <button
                      type="button"
                      className="carousel-arrow-btn"
                      onClick={prodScroll.scrollPrev}
                      aria-label="Scroll products left"
                      title="Previous"
                    >
                      <Icon name="chevleft" size={17} />
                    </button>
                    <button
                      type="button"
                      className="carousel-arrow-btn"
                      onClick={prodScroll.scrollNext}
                      aria-label="Scroll products right"
                      title="Next"
                    >
                      <Icon name="chev" size={17} />
                    </button>
                  </div>
                  <Link className="link" to="/products">
                    {t("view_all")} <Icon name="arrowsm" size={15} />
                  </Link>
                </div>
              </div>
              <div className="carousel-wrap">
                <button
                  type="button"
                  className="carousel-track-btn prev"
                  onClick={prodScroll.scrollPrev}
                  aria-label="Scroll products left"
                  title="Previous"
                >
                  <Icon name="chevleft" size={20} />
                </button>
                <div
                  className="carousel-track"
                  ref={prodTrackRef}
                  onMouseEnter={prodScroll.onMouseEnter}
                  onMouseLeave={prodScroll.onMouseLeave}
                  onTouchStart={prodScroll.onTouchStart}
                  onTouchEnd={prodScroll.onTouchEnd}
                >
                  {featured.map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                  <div className="carousel-more-card">
                    <Link to="/products" className="carousel-more-btn">
                      <span className="carousel-more-circle">
                        <Icon name="arrowsm" size={22} />
                      </span>
                      <b>{t("view_all")}</b>
                      <span>{PRODUCTS.length} Models</span>
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  className="carousel-track-btn next"
                  onClick={prodScroll.scrollNext}
                  aria-label="Scroll products right"
                  title="Next"
                >
                  <Icon name="chev" size={20} />
                </button>
              </div>
            </div>
          </section>

          {/* ---------- Quick access + live scheme (Dealers) ---------- */}
          <section className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "var(--s5)" }}>
                <div className="list">
                  <p className="list-head">{t("quick_products")}</p>
                  {QUICK_ACCESS.map((q) => {
                    const isSupport = q.to === "/support";
                    const toPath = isSupport ? "/support" : q.to;
                    const subText = isSupport ? (t("under_maintenance_badge") || "Under Maintenance") : q.sub;
                    return (
                      <Link className="list-row" key={q.title} to={toPath}>
                        <span className="tile tile-sm">
                          <Icon name={q.icon} size={18} />
                        </span>
                        <span className="txt">
                          <b>{q.title}</b>
                          <span>{subText}</span>
                        </span>
                        <Icon name="chev" size={16} className="chev" />
                      </Link>
                    );
                  })}
                </div>

                {scheme && (
                  <div className="scheme" style={{ position: "relative" }}>
                    <div className="scheme-txt">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span className="badge">{t("scheme_live_now")}</span>
                        {liveSchemes.length > 1 && (
                          <div style={{ display: "inline-flex", gap: 4 }}>
                            {liveSchemes.map((s, idx) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setSchemeIdx(idx)}
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: "50%",
                                  border: "none",
                                  background: schemeIdx === idx ? "var(--navy)" : "rgba(14,36,56,0.15)",
                                  color: schemeIdx === idx ? "#fff" : "var(--navy)",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "grid",
                                  placeItems: "center",
                                }}
                                aria-label={`Show ${s.title}`}
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <h3 style={{ marginTop: "var(--s3)" }}>{scheme.title}</h3>
                      <p className="when">{scheme.when || scheme.subtitle}</p>
                      <p>{scheme.blurb}</p>
                      <div style={{ display: "flex", gap: "var(--s3)", marginTop: "var(--s4)", alignItems: "center" }}>
                        <Link className="btn btn-navy btn-sm" to="/schemes">
                          {t("sec_schemes_title")}
                        </Link>
                        {(scheme.pdfUrl || scheme.flyer) && (
                          <a
                            className="btn btn-ghost btn-sm"
                            href={scheme.pdfUrl || scheme.flyer}
                            download={scheme.pdfName || "scheme.pdf"}
                          >
                            <Icon name="download" size={15} /> PDF
                          </a>
                        )}
                      </div>
                    </div>
                    <Link className="fab" to="/schemes" aria-label="Open schemes">
                      <Icon name="arrowsm" size={17} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* For Non-Login Users (Guests / Customers): Show Dedicated Support & Dealer Portal Cards */}
      {isGated && (
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "var(--s5)" }}>
              {/* Customer & Service Support Card */}
              <div className="card pad" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 99, background: "rgba(14,36,56,0.08)", fontSize: "0.78rem", fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <Icon name="support" size={14} /> {t("nav_support") || "Customer Support"}
                  </div>
                  <h3 style={{ marginTop: "var(--s3)", fontSize: "1.35rem" }}>
                    {t("support_title") || "Service & Customer Support"}
                  </h3>
                  <p className="muted" style={{ marginTop: "var(--s2)", fontSize: "0.92rem", lineHeight: 1.55 }}>
                    Need assistance with your Sunshine domestic appliances, warranty registration, or authorised repair service? Our dedicated customer care desk is ready to help.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "var(--s3)", marginTop: "var(--s5)", flexWrap: "wrap" }}>
                  <Link className="btn btn-navy btn-sm" to="/support">
                    <Icon name="support" size={15} /> {t("nav_support") || "Help & Support"}
                  </Link>
                  <a
                    className="btn btn-wa btn-sm"
                    href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hello Sunshine Support, I need assistance with my appliance.")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="wa" size={15} /> WhatsApp Support
                  </a>
                </div>
              </div>

              {/* Authorised Dealer Network Card */}
              <div className="card pad" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #0e2438 0%, #173752 100%)", color: "#fff" }}>
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 99, background: "rgba(255,255,255,0.15)", fontSize: "0.78rem", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <Icon name="lock" size={14} /> Dealer Network
                  </div>
                  <h3 style={{ marginTop: "var(--s3)", fontSize: "1.35rem", color: "#fff" }}>
                    Authorised Dealer Portal
                  </h3>
                  <p style={{ marginTop: "var(--s2)", fontSize: "0.92rem", lineHeight: 1.55, color: "rgba(255,255,255,0.85)" }}>
                    Wholesale catalog, live trade schemes, and dealer pricebooks are restricted to verified Sunshine partners. Sign in to your account or submit a dealership enquiry.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "var(--s3)", marginTop: "var(--s5)", flexWrap: "wrap" }}>
                  <Link className="btn btn-amber btn-sm" to="/login">
                    Verified Dealer Login <Icon name="arrow" size={15} />
                  </Link>
                  <Link className="btn btn-ghost btn-sm" to="/login?tab=apply" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
                    Apply for Dealership
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Trust / About Sunshine B2B (Matches Stitch Frame 1) ---------- */}
      <section className="sec home-trust-banner-sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="home-stitch-trust-card">
            <h3 className="home-stitch-trust-title">
              Stocking Sunshine, or thinking about it?
            </h3>
            <p className="home-stitch-trust-desc">
              Since 1999, Shriji Domestic has been a leading distributor of domestic kitchen appliances, delivering trusted service and authentic products across regions.
            </p>
            <div className="home-stitch-trust-actions">
              <a
                className="home-stitch-btn-ghost"
                href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hello Shriji Domestic, I would like details on stocking the Sunshine range.")}`}
                target="_blank"
                rel="noreferrer"
              >
                <span>💬</span> Enquire Now
              </a>
              <a
                className="home-stitch-btn-primary"
                href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}
              >
                <span>📞</span> Call
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
