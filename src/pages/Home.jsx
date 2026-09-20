import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY, STATS, QUICK_NAV, QUICK_ACCESS, SCHEMES } from "../data/site";
import { Icon, EnquiryButtons } from "../ui";
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

export default function Home() {
  const { products: PRODUCTS, categories: CATEGORIES } = useProducts();

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
        .slice(0, 8),
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
                  Engineered for a
                  <br />
                  Better Tomorrow
                </h1>
                <p>
                  The complete Sunshine kitchen range — {PRODUCTS.length > 0 ? `${PRODUCTS.length} live models` : "400+ models"} across gas stoves, hobs, hob tops,
                  chimneys and small appliances, distributed by Shriji since {COMPANY.founded}.
                </p>
                <div className="row" style={{ marginTop: "var(--s5)" }}>
                  <Link className="btn btn-white" to="/products">
                    Explore Products <Icon name="arrowsm" />
                  </Link>
                  <Link className="btn btn-ghost" to="/schemes" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.28)" }}>
                    View Schemes
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
            {QUICK_NAV.map((q) => (
              <Link className="qn" key={q.label} to={q.to}>
                <span className="tile">
                  <Icon name={q.icon} size={22} />
                </span>
                <b>{q.label}</b>
                <span>{q.sub}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2>Shop by Category</h2>
            <Link className="link" to="/products">
              View All <Icon name="arrowsm" size={15} />
            </Link>
          </div>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <Link className="cat" key={c.key} to={`/products?cat=${c.key}`}>
                <span className="cat-img">
                  <img
                    src={c.img}
                    alt={c.label}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/img/cat-small_appliances.webp";
                    }}
                  />
                </span>
                <span className="cat-foot">
                  <span>
                    <b>{c.label}</b>
                    <span>{counts[c.key] || 0} models</span>
                  </span>
                  <span className="tile tile-sm">
                    <Icon name={CAT_ICON[c.key] || "stove"} size={18} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Featured ---------- */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2>Featured Products</h2>
            <Link className="link" to="/products">
              View All <Icon name="arrowsm" size={15} />
            </Link>
          </div>
          <div className="prods">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Quick access + live scheme ---------- */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "var(--s5)" }}>
            <div className="list">
              <p className="list-head">Quick Access</p>
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
                <span className="badge">Active scheme</span>
                <h3 style={{ marginTop: "var(--s3)" }}>{scheme.title}</h3>
                <p className="when">{scheme.when}</p>
                <p>{scheme.blurb}</p>
                <Link className="btn btn-navy btn-sm" to="/schemes" style={{ marginTop: "var(--s4)" }}>
                  See all schemes
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
            {STATS.map((s) => (
              <div key={s.label}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
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
