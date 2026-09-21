import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { priceFor } from "../data/dealer";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";

const PAGE = 24;

/* One filter group, rendered the same on phone and desktop. */
function Group({ title, options, value, onPick, className = "" }) {
  if (!options.length) return null;
  return (
    <div className={`fgroup ${className}`.trim()}>
      <h3>{title}</h3>
      <ul>
        {options.map(([key, label, n]) => (
          <li key={key}>
            <label>
              <input type="checkbox" checked={value === key} onChange={() => onPick(value === key ? "" : key)} />
              <span>{label}</span>
              <small>{n}</small>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Products() {
  const { products: PRODUCTS, categories: CATEGORIES, loaded } = useProducts();
  const { t, tCat } = useLanguage();
  const [params, setParams] = useSearchParams();
  const cat = params.get("cat") || "";
  const [q, setQ] = useState("");
  const [finish, setFinish] = useState("");
  const [brand, setBrand] = useState("");
  const [burners, setBurners] = useState("");
  const [ignition, setIgnition] = useState("");
  const [sort, setSort] = useState("popularity");
  const [shown, setShown] = useState(PAGE);
  const [openFilters, setOpenFilters] = useState(false);

  const reset = () => setShown(PAGE);

  const counts = useMemo(() => {
    const c = {};
    for (const p of PRODUCTS) c[p.cat] = (c[p.cat] || 0) + 1;
    return c;
  }, [PRODUCTS]);

  // Facet counts are built from the products in the current category only.
  const facets = useMemo(() => {
    const inCat = cat ? PRODUCTS.filter((p) => p.cat === cat) : PRODUCTS;
    const tally = (pick) => {
      const m = new Map();
      for (const p of inCat) {
        const v = pick(p);
        if (v) m.set(v, (m.get(v) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      brand: tally((p) => p.brand).map(([v, n]) => [v, v, n]),
      ignition: tally((p) => (p.features.includes("Auto Ignition") ? "auto" : "manual")).map(([v, n]) => [
        v,
        v === "auto" ? "Auto Ignition" : "Manual",
        n,
      ]),
      burners: tally((p) => p.burners)
        .sort((a, b) => a[0] - b[0])
        .map(([v, n]) => [String(v), `${v} Burner`, n]),
      finish: tally((p) => p.finish).map(([v, n]) => [v, v, n]),
    };
  }, [cat, PRODUCTS]);

  const pickCat = (key) => {
    const next = new URLSearchParams(params);
    if (key && next.get("cat") !== key) next.set("cat", key);
    else next.delete("cat");
    setParams(next, { replace: true });
    setBurners("");
    setFinish("");
    reset();
  };

  const SORT_FNS = {
    popularity: null,
    name: (a, b) => a.model.localeCompare(b.model),
    low: (a, b) => priceFor(a).dealer - priceFor(b).dealer,
    high: (a, b) => priceFor(b).dealer - priceFor(a).dealer,
  };

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = PRODUCTS.filter((p) => {
      if (cat && p.cat !== cat) return false;
      if (finish && p.finish !== finish) return false;
      if (brand && p.brand !== brand) return false;
      if (burners && String(p.burners) !== burners) return false;
      if (ignition && (p.features.includes("Auto Ignition") ? "auto" : "manual") !== ignition) return false;
      if (needle && !p.name.toLowerCase().includes(needle) && !p.model.toLowerCase().includes(needle)) return false;
      return true;
    });
    const fn = SORT_FNS[sort];
    return fn ? [...out].sort(fn) : out;
  }, [cat, finish, brand, burners, ignition, q, sort, PRODUCTS]);

  const dirty = Boolean(cat || finish || brand || burners || ignition || q.trim());

  const clear = () => {
    setParams(new URLSearchParams(), { replace: true });
    setQ("");
    setFinish("");
    setBrand("");
    setBurners("");
    setIgnition("");
    reset();
  };

  const active = CATEGORIES.find((c) => c.key === cat);

  const sortOptions = [
    { key: "popularity", label: t("sort_featured") },
    { key: "name", label: t("sort_name") },
    { key: "low", label: t("sort_price_asc") },
    { key: "high", label: t("sort_price_desc") },
  ];

  return (
    <>
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <h1 className="d2">{t("catalog_title")}</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {PRODUCTS.length > 0 ? t("live_models_across", { products: PRODUCTS.length, cats: CATEGORIES.length }) : t("connecting_zoho")}
          </p>
        </div>
      </section>

      <div className="toolbar" style={{ marginTop: "var(--s5)" }}>
        <div className="wrap stack">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="search">
              <Icon name="search" size={17} style={{ color: "var(--tx-3)" }} />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  reset();
                }}
                placeholder={t("search_placeholder")}
                aria-label={t("search_placeholder")}
              />
            </label>
            <button
              className="icon-btn filter-btn"
              aria-expanded={openFilters}
              aria-controls="filters"
              aria-label={t("filter_btn")}
              onClick={() => setOpenFilters((v) => !v)}
              style={openFilters ? { background: "var(--blue-100)", borderColor: "var(--blue-300)" } : undefined}
            >
              <Icon name="filter" size={18} />
            </button>
          </div>

          <div className="catchips" role="group" aria-label="Filter by category">
            {CATEGORIES.map((c) => (
              <button key={c.key} className="catchip" aria-pressed={cat === c.key} onClick={() => pickCat(c.key)}>
                <img
                  src={c.img}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = "/img/cat-small_appliances.webp";
                  }}
                />
                <span>
                  {tCat(c.key, c.label)}
                  <br />
                  <small style={{ fontWeight: 500, opacity: 0.7 }}>{counts[c.key] || 0}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="sec">
        <div className="wrap listing">
          <aside className="filters" id="filters" data-open={openFilters || undefined}>
            <div className="fhead">
              <h2>{t("filter_btn")}</h2>
              {dirty && (
                <button className="link" onClick={clear}>
                  {t("clear_filters")}
                </button>
              )}
            </div>
            <Group
              title={t("spec_category")}
              options={CATEGORIES.map((c) => [c.key, tCat(c.key, c.label), counts[c.key]])}
              value={cat}
              onPick={pickCat}
            />
            <Group
              title={t("spec_brand")}
              options={facets.brand}
              value={brand}
              onPick={(v) => {
                setBrand(v);
                reset();
              }}
            />
            <Group
              title={t("filter_burners")}
              options={facets.burners}
              value={burners}
              onPick={(v) => {
                setBurners(v);
                reset();
              }}
            />
            <Group
              title={t("filter_features")}
              options={facets.ignition}
              value={ignition}
              onPick={(v) => {
                setIgnition(v);
                reset();
              }}
            />
            <Group
              title={t("filter_finish")}
              options={facets.finish}
              value={finish}
              onPick={(v) => {
                setFinish(v);
                reset();
              }}
            />
            <button className="btn btn-navy btn-block done-btn" onClick={() => setOpenFilters(false)}>
              {t("view_all")} ({results.length})
            </button>
          </aside>

          <div>
            {active && (
              <div className="strip" style={{ marginBottom: "var(--s5)" }}>
                <div className="strip-txt">
                  <p className="eyebrow">Sunshine</p>
                  <h3>{tCat(active.key, active.label)}</h3>
                  <p>Performance you can rely on.</p>
                </div>
                <span className="strip-art">
                  <img src={active.img} alt="" />
                </span>
              </div>
            )}

            <nav className="crumbs" aria-label="Breadcrumb">
              <Link to="/">{t("nav_home")}</Link>
              <Icon name="chev" size={13} />
              {active ? <Link to="/products">{t("nav_products")}</Link> : <span>{t("nav_products")}</span>}
              {active && (
                <>
                  <Icon name="chev" size={13} />
                  <span>{tCat(active.key, active.label)}</span>
                </>
              )}
            </nav>

            <div className="sec-head">
              <h2>
                {active ? tCat(active.key, active.label) : t("cat_all")}{" "}
                <span className="muted" style={{ fontWeight: 500 }}>
                  ({results.length})
                </span>
              </h2>
              <label className="sortby">
                {t("sort_label")}
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    reset();
                  }}
                >
                  {sortOptions.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!loaded && PRODUCTS.length === 0 ? (
              <div className="empty" style={{ padding: "var(--s8) var(--s4)" }}>
                <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
                  <Icon name="bolt" size={24} style={{ animation: "spin 1s linear infinite" }} />
                </span>
                <h3 className="h3">{t("connecting_zoho")}</h3>
                <p className="muted">Syncing the latest products and prices directly from your Zoho Commerce store.</p>
              </div>
            ) : results.length === 0 ? (
              <div className="empty">
                <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
                  <Icon name="search" size={24} />
                </span>
                <h3 className="h3">{t("no_products_found")}</h3>
                <p className="muted">
                  {t("no_products_sub")}
                </p>
                <button className="btn btn-navy" style={{ marginTop: "var(--s5)" }} onClick={clear}>
                  {t("clear_filters")}
                </button>
              </div>
            ) : (
              <>
                <div className="prods">
                  {results.slice(0, shown).map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                </div>

                {shown < results.length && (
                  <div className="row" style={{ justifyContent: "center", marginTop: "var(--s6)" }}>
                    <button className="btn btn-ghost" onClick={() => setShown((s) => s + PAGE)}>
                      Load {Math.min(PAGE, results.length - shown)} more
                    </button>
                    <span className="note">
                      Showing {shown} of {results.length}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
