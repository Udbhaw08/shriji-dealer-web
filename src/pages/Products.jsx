import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { priceFor } from "../data/dealer";
import { Icon } from "../ui";
import ProductCard from "../components/ProductCard";

const PAGE = 24;

const SORTS = {
  popularity: { label: "Popularity", fn: null },
  name: { label: "Name (A–Z)", fn: (a, b) => a.model.localeCompare(b.model) },
  low: { label: "Price: Low to High", fn: (a, b) => priceFor(a).dealer - priceFor(b).dealer },
  high: { label: "Price: High to Low", fn: (a, b) => priceFor(b).dealer - priceFor(a).dealer },
};

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
  const { products: PRODUCTS, categories: CATEGORIES, loaded, syncing, refresh } = useProducts();
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
    const fn = SORTS[sort].fn;
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

  return (
    <>
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h1 className="d2">Products</h1>
              <p className="sub" style={{ marginTop: "var(--s2)" }}>
                {PRODUCTS.length > 0 ? `${PRODUCTS.length} live models across ${CATEGORIES.length} categories.` : "Connecting to Zoho…"}
                {loaded && (
                  <span style={{ marginLeft: "8px", fontSize: "0.8rem", color: "var(--blue-600, #2563eb)", fontWeight: 600 }}>
                    ● Live Zoho Sync
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => refresh()}
              disabled={syncing}
              className="btn btn-ghost"
              style={{ padding: "6px 14px", fontSize: "0.85rem", gap: "6px", display: "inline-flex", alignItems: "center" }}
              title="Fetch fresh items directly from Zoho Commerce"
            >
              <Icon name="bolt" size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
              {syncing ? "Syncing Zoho…" : "Sync with Zoho"}
            </button>
          </div>
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
                placeholder="Search products, model, category…"
                aria-label="Search products"
              />
            </label>
            <button
              className="icon-btn filter-btn"
              aria-expanded={openFilters}
              aria-controls="filters"
              aria-label="Filters"
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
                  {c.label}
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
              <h2>Filters</h2>
              {dirty && (
                <button className="link" onClick={clear}>
                  Clear All
                </button>
              )}
            </div>
            <Group
              title="Category"
              options={CATEGORIES.map((c) => [c.key, c.label, counts[c.key]])}
              value={cat}
              onPick={pickCat}
              className="cat-group"
            />
            <Group
              title="Brand"
              options={facets.brand}
              value={brand}
              onPick={(v) => {
                setBrand(v);
                reset();
              }}
            />
            <Group
              title="Burner Type"
              options={facets.burners}
              value={burners}
              onPick={(v) => {
                setBurners(v);
                reset();
              }}
            />
            <Group
              title="Ignition Type"
              options={facets.ignition}
              value={ignition}
              onPick={(v) => {
                setIgnition(v);
                reset();
              }}
            />
            <Group
              title="Finish"
              options={facets.finish}
              value={finish}
              onPick={(v) => {
                setFinish(v);
                reset();
              }}
            />
            <button className="btn btn-navy btn-block done-btn" onClick={() => setOpenFilters(false)}>
              Show {results.length} products
            </button>
          </aside>

          <div>
            {active && (
              <div className="strip" style={{ marginBottom: "var(--s5)" }}>
                <div className="strip-txt">
                  <p className="eyebrow">Sunshine</p>
                  <h3>{active.label}</h3>
                  <p>Performance you can rely on.</p>
                </div>
                <span className="strip-art">
                  <img src={active.img} alt="" />
                </span>
              </div>
            )}

            <nav className="crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link>
              <Icon name="chev" size={13} />
              {active ? <Link to="/products">Products</Link> : <span>Products</span>}
              {active && (
                <>
                  <Icon name="chev" size={13} />
                  <span>{active.label}</span>
                </>
              )}
            </nav>

            <div className="sec-head">
              <h2>
                {active ? active.label : "All Products"}{" "}
                <span className="muted" style={{ fontWeight: 500 }}>
                  ({results.length})
                </span>
              </h2>
              <label className="sortby">
                Sort By
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    reset();
                  }}
                >
                  {Object.entries(SORTS).map(([k, s]) => (
                    <option key={k} value={k}>
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
                <h3 className="h3">Fetching live catalog from Zoho…</h3>
                <p className="muted">Syncing the latest products and prices directly from your Zoho Commerce store.</p>
              </div>
            ) : results.length === 0 ? (
              <div className="empty">
                <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
                  <Icon name="search" size={24} />
                </span>
                <h3 className="h3">No model matches that</h3>
                <p className="muted">
                  Try the model name on its own — <b>Carnival</b>, <b>Thunder</b>, <b>Casavo</b> — or clear the filters.
                </p>
                <button className="btn btn-navy" style={{ marginTop: "var(--s5)" }} onClick={clear}>
                  Clear filters
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
