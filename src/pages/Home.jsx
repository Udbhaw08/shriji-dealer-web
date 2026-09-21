import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY, STATS, QUICK_NAV, QUICK_ACCESS, SCHEMES } from "../data/site";
import { Icon, EnquiryButtons } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";

const CAT_ICON = {
  gas_stoves: "stove",
  chimneys: "chimney",
  hobs: "hob",
  hob_tops: "glass",
  small_appliances: "blender",
  gas_geysers: "flame",
  natraj_flour_mill: "bolt",
  spares: "shield",
};

function useAutoScroll(trackRef, { interval = 3000, step = 260 } = {}) {
  const isPausedRef = useRef(false);

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
  }, []);

  const onTouchEnd = useCallback(() => {
    setTimeout(() => {
      isPausedRef.current = false;
    }, 2500);
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
  const catScroll = useAutoScroll(catTrackRef, { interval: 3000, step: 240 });
  const prodScroll = useAutoScroll(prodTrackRef, { interval: 3200, step: 260 });

  const counts = useMemo(() => {
    const c = {};
    for (const p of PRODUCTS) c[p.cat] = (c[p.cat] || 0) + 1;
    return c;
  }, [PRODUCTS]);

  const heroProduct = useMemo(() => PRODUCTS.find((p) => p.cat === "gas_stoves" && p.img) || PRODUCTS[0], [PRODUCTS]);

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
      {/* ---------- Hero banner ---------- */}
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <div className="banner rise">
            <div className="banner-in">
              <div>
                <p className="eyebrow">Sunshine</p>
                <h1 className="d1">
                  {t("hero_title")}
                </h1>
                <p>
                  {t("hero_sub")}
                </p>
                <div className="row" style={{ marginTop: "var(--s5)" }}>
                  <Link className="btn btn-white" to="/products">
                    {t("hero_cta_products")} <Icon name="arrowsm" />
                  </Link>
                  <Link className="btn btn-ghost" to="/schemes" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.28)" }}>
                    {t("hero_cta_schemes")}
                  </Link>
                </div>
              </div>
              <div className="banner-art">
                {heroProduct && (
                  <img
                    src={heroProduct.img?.startsWith("http") ? heroProduct.img : `/img/${heroProduct.img}`}
                    alt={heroProduct.name}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Quick nav ---------- */}
      <section style={{ paddingBottom: "var(--s6)" }}>
        <div className="wrap">
          <div className="quicknav">
            {QUICK_NAV.map((q) => {
              const label = q.label === "Products" ? t("quick_products")
                : q.label === "Schemes" ? t("quick_schemes")
                : q.label === "New Launches" ? t("quick_launches")
                : t("quick_support");
              const sub = q.label === "Products" ? t("quick_products_sub")
                : q.label === "Schemes" ? t("quick_schemes_sub")
                : q.label === "New Launches" ? t("quick_launches_sub")
                : t("quick_support_sub");
              return (
                <Link className="qn" key={q.label} to={q.to}>
                  <span className="tile">
                    <Icon name={q.icon} size={22} />
                  </span>
                  <b>{label}</b>
                  <span>{sub}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="sec" style={{ paddingTop: 0 }}>
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
            <div
              className="carousel-track"
              ref={catTrackRef}
              onMouseEnter={catScroll.onMouseEnter}
              onMouseLeave={catScroll.onMouseLeave}
              onTouchStart={catScroll.onTouchStart}
              onTouchEnd={catScroll.onTouchEnd}
            >
              {CATEGORIES.map((c) => (
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
                    <span className="tile tile-sm">
                      <Icon name={CAT_ICON[c.key] || "stove"} size={18} />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
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
            </div>
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
