import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY, STATS, QUICK_ACCESS, SCHEMES } from "../data/site";
import { Icon, EnquiryButtons } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";


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

  const scheme = SCHEMES.active[0];

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="hero-pill">
                <span className="hero-dot" />
                <span>{t("hero_badge")}</span>
              </span>

              <h1 className="hero-title">
                {t("hero_h1_1")}
                <br />
                <span className="hero-grad">{t("hero_h1_2")}</span>
                <br />
                {t("hero_h1_3")}
              </h1>

              <p className="hero-lead">{t("hero_lead")}</p>

              <div className="hero-btns">
                <Link className="btn btn-primary" to="/products">
                  {t("hero_cta_browse")} <Icon name="arrow" size={17} />
                </Link>
                <Link className="btn btn-ghost" to="/schemes">
                  {t("hero_cta_schemes")}
                </Link>
              </div>
            </div>

            <div className="hero-card">
              <div className="hero-card-head">
                <span className="hero-card-tag">{t("hero_card_tag")}</span>
                <p className="hero-card-title">{COMPANY.tagline}</p>
                <p className="hero-card-sub">{COMPANY.address}</p>
              </div>
              <div className="hero-stats">
                {STATS.map((s) => (
                  <div className="hero-stat" key={s.label}>
                    <b>{s.value || s.val}</b>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Browse by Category ---------- */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>{t("sec_categories_title")}</h2>
            <div className="sec-head-controls">
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
          <div className="carousel-wrap">
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
              className="carousel-track"
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
                    <span>
                      <b>{tCat(c.key, c.label)}</b>
                      <span>{t("models_count", { count: counts[c.key] || 0 })}</span>
                    </span>
                  </span>
                </Link>
              ))}
              <div className="carousel-more-card">
                <Link to="/products" className="carousel-more-btn">
                  <span className="carousel-more-circle">
                    <Icon name="arrowsm" size={22} />
                  </span>
                  <b>{t("view_all")}</b>
                  <span>{CATEGORIES.length} Categories</span>
                </Link>
              </div>
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

      {/* ---------- Quick access + live scheme ---------- */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "var(--s5)" }}>
            <div className="list">
              <p className="list-head">{t("quick_products")}</p>
              {QUICK_ACCESS.map((q) => (
                <Link className="list-row" key={q.title} to={q.to}>
                  <span className="tile tile-sm">
                    <Icon name={q.icon} size={18} />
                  </span>
                  <span className="txt">
                    <b>{q.title}</b>
                    <span>{q.sub}</span>
                  </span>
                  <Icon name="chev" size={16} className="chev" />
                </Link>
              ))}
            </div>

            <div className="scheme">
              <div className="scheme-txt">
                <span className="badge">{t("scheme_live_now")}</span>
                <h3 style={{ marginTop: "var(--s3)" }}>{scheme.title}</h3>
                <p className="when">{scheme.when}</p>
                <p>{scheme.blurb}</p>
                <Link className="btn btn-navy btn-sm" to="/schemes" style={{ marginTop: "var(--s4)" }}>
                  {t("sec_schemes_title")}
                </Link>
              </div>
              <Link className="fab" to="/schemes" aria-label="Open schemes">
                <Icon name="arrowsm" size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Trust ---------- */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap stack" style={{ gap: "var(--s5)" }}>
          <div className="stats">
            {STATS.map((s, idx) => {
              const labelKey = idx === 0 ? "stats_years"
                : idx === 1 ? "stats_retailers"
                : idx === 2 ? "stats_customers"
                : "stats_installs";
              return (
                <div key={s.label}>
                  <b>{s.value}</b>
                  <span>{t(labelKey)}</span>
                </div>
              );
            })}
          </div>

          <div className="card pad" style={{ display: "grid", gap: "var(--s4)" }}>
            <h2 className="d2" style={{ maxWidth: "20ch" }}>
              Stocking Sunshine, or thinking about it?
            </h2>
            <p className="sub">{COMPANY.about}</p>
            <EnquiryButtons />
          </div>
        </div>
      </section>
    </>
  );
}
