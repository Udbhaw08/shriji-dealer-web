import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { useFavorites } from "../data/favoritesStore";
import { priceFor } from "../data/dealer";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import ProductCard from "../components/ProductCard";
import ProductSearchBar from "../components/ProductSearchBar";
import { buildSearchDictionary, autocorrectQuery, scoreProduct } from "../data/searchHelper";
import { getProductSize, getProductMotorType } from "../data/filtersHelper";

const PAGE = 24;

const SORT_FNS = {
  popularity: null,
  name: (a, b) => (a.model || a.name).localeCompare(b.model || b.name),
  low: (a, b) => priceFor(a).dealer - priceFor(b).dealer,
  high: (a, b) => priceFor(b).dealer - priceFor(a).dealer,
};

/* One filter group with multi-selection support */
function Group({ title, options, selected = [], onToggle, onClear, className = "" }) {
  if (!options.length) return null;
  return (
    <div className={`fgroup ${className}`.trim()}>
      <div className="fgroup-title-row">
        <h3>
          <span>{title}</span>
          {selected.length > 0 && <span className="fgroup-badge-count">{selected.length}</span>}
        </h3>
        {selected.length > 0 && (
          <button
            type="button"
            className="fgroup-clear-btn"
            onClick={onClear}
            aria-label={`Clear ${title} filters`}
          >
            Clear
          </button>
        )}
      </div>
      <ul>
        {options.map(([key, label, n]) => {
          const isChecked = selected.includes(key);
          return (
            <li key={key}>
              <label className={isChecked ? "f-checked" : ""}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(key)}
                />
                <span>{label}</span>
                <small>{n}</small>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Products() {
  const { products: PRODUCTS, categories: CATEGORIES, loaded } = useProducts();
  const { isFavorite, count: favCount } = useFavorites();
  const { t, tCat } = useLanguage();
  const [params, setParams] = useSearchParams();

  // Parse multi-select filters from URL search params
  const parseListParam = (key) => {
    const raw = params.get(key);
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "all" && s !== "all_products");
  };

  const selectedCats = parseListParam("cat");
  const selectedBrands = parseListParam("brand");
  const selectedSizes = parseListParam("size");
  const selectedMotors = parseListParam("motor");
  const selectedBurners = parseListParam("burners");
  const selectedIgnitions = parseListParam("ignition");
  const selectedFinishes = parseListParam("finish");
  const onlyFavorites = params.get("saved") === "true";
  const urlQ = params.get("q") || "";

  const [q, setQ] = useState(urlQ);
  const [verbatimQ, setVerbatimQ] = useState("");
  const [sort, setSort] = useState("popularity");
  const [shown, setShown] = useState(PAGE);
  const [openFilters, setOpenFilters] = useState(false);

  // Sync state if urlQ changes externally
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  const reset = () => setShown(PAGE);

  const toggleInList = (list, item) => {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  };

  const updateFilters = ({
    cats = selectedCats,
    brands = selectedBrands,
    sizes = selectedSizes,
    motors = selectedMotors,
    burners = selectedBurners,
    ignitions = selectedIgnitions,
    finishes = selectedFinishes,
    saved = onlyFavorites,
    query = q,
  }) => {
    const next = new URLSearchParams();
    if (cats.length > 0) next.set("cat", cats.join(","));
    if (brands.length > 0) next.set("brand", brands.join(","));
    if (sizes.length > 0) next.set("size", sizes.join(","));
    if (motors.length > 0) next.set("motor", motors.join(","));
    if (burners.length > 0) next.set("burners", burners.join(","));
    if (ignitions.length > 0) next.set("ignition", ignitions.join(","));
    if (finishes.length > 0) next.set("finish", finishes.join(","));
    if (saved) next.set("saved", "true");
    if (query && query.trim()) next.set("q", query.trim());

    setParams(next, { replace: true });
    reset();
  };

  const counts = useMemo(() => {
    const c = {};
    for (const p of PRODUCTS) {
      c[p.cat] = (c[p.cat] || 0) + 1;
      if (p.isTrial || p.collections?.includes("trial")) {
        c["trial"] = (c["trial"] || 0) + 1;
      }
    }
    return c;
  }, [PRODUCTS]);

  // Facet tallies
  const facets = useMemo(() => {
    const inCat =
      selectedCats.length > 0
        ? PRODUCTS.filter((p) =>
            selectedCats.some(
              (c) =>
                c === p.cat ||
                (c === "trial" && (p.isTrial || p.collections?.includes("trial") || p.cat === "trial"))
            )
          )
        : PRODUCTS;

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
      size: tally((p) => getProductSize(p))
        .sort((a, b) => {
          const numA = parseInt(a[0], 10) || 0;
          const numB = parseInt(b[0], 10) || 0;
          return numA - numB;
        })
        .map(([v, n]) => [v, v, n]),
      motor: tally((p) => getProductMotorType(p)).map(([v, n]) => [v, v, n]),
      ignition: tally((p) => (p.features?.includes("Auto Ignition") ? "auto" : "manual")).map(
        ([v, n]) => [v, v === "auto" ? "Auto Ignition" : "Manual", n]
      ),
      burners: tally((p) => p.burners)
        .sort((a, b) => a[0] - b[0])
        .map(([v, n]) => [String(v), `${v} Burner`, n]),
      finish: tally((p) => p.finish).map(([v, n]) => [v, v, n]),
    };
  }, [selectedCats, PRODUCTS]);

  // Autocorrect dictionary & check
  const searchDict = useMemo(() => {
    return buildSearchDictionary(PRODUCTS, CATEGORIES);
  }, [PRODUCTS, CATEGORIES]);

  const autocorrect = useMemo(() => {
    if (!q || q.trim().length < 3 || verbatimQ === q.trim()) return null;
    const res = autocorrectQuery(q.trim(), searchDict);
    return res.hasCorrection ? res.corrected : null;
  }, [q, searchDict, verbatimQ]);

  // Filter calculation
  const { results, isUsingAutocorrect } = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const matchesFilter = (p, term) => {
      if (onlyFavorites && !isFavorite(p.id)) return false;
      if (selectedCats.length > 0) {
        const matchesCat = selectedCats.some(
          (c) =>
            c === p.cat ||
            (c === "trial" && (p.isTrial || p.collections?.includes("trial") || p.cat === "trial"))
        );
        if (!matchesCat) return false;
      }
      if (selectedFinishes.length > 0 && !selectedFinishes.includes(p.finish)) return false;
      if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand)) return false;
      if (selectedSizes.length > 0) {
        const pSize = getProductSize(p);
        if (!pSize || !selectedSizes.includes(pSize)) return false;
      }
      if (selectedMotors.length > 0) {
        const pMotor = getProductMotorType(p);
        if (!pMotor || !selectedMotors.includes(pMotor)) return false;
      }
      if (selectedBurners.length > 0 && !selectedBurners.includes(String(p.burners))) return false;
      if (selectedIgnitions.length > 0) {
        const pIgn = p.features?.includes("Auto Ignition") ? "auto" : "manual";
        if (!selectedIgnitions.includes(pIgn)) return false;
      }
      if (term) {
        return scoreProduct(p, term) > 0;
      }
      return true;
    };

    let direct = PRODUCTS.filter((p) => matchesFilter(p, needle));
    let usedCorrection = false;

    // If 0 direct matches found and autocorrect is available, use autocorrect
    if (direct.length === 0 && autocorrect && needle !== verbatimQ) {
      const correctedMatches = PRODUCTS.filter((p) => matchesFilter(p, autocorrect));
      if (correctedMatches.length > 0) {
        direct = correctedMatches;
        usedCorrection = true;
      }
    }

    const fn = SORT_FNS[sort];
    const sorted = fn ? [...direct].sort(fn) : direct;
    return { results: sorted, isUsingAutocorrect: usedCorrection };
  }, [
    onlyFavorites,
    selectedCats,
    selectedFinishes,
    selectedBrands,
    selectedSizes,
    selectedMotors,
    selectedBurners,
    selectedIgnitions,
    q,
    sort,
    autocorrect,
    verbatimQ,
    PRODUCTS,
    isFavorite,
  ]);

  const dirty = Boolean(
    selectedCats.length ||
      selectedFinishes.length ||
      selectedBrands.length ||
      selectedSizes.length ||
      selectedMotors.length ||
      selectedBurners.length ||
      selectedIgnitions.length ||
      onlyFavorites ||
      q.trim()
  );

  const activeFilterCount =
    selectedCats.length +
    selectedBrands.length +
    selectedSizes.length +
    selectedMotors.length +
    selectedBurners.length +
    selectedIgnitions.length +
    selectedFinishes.length +
    (onlyFavorites ? 1 : 0) +
    (q.trim() ? 1 : 0);

  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: true });
    setQ("");
    setVerbatimQ("");
    reset();
  };

  // Mobile browser & hardware back button handling for filter drawer
  useEffect(() => {
    if (!openFilters) return;

    // Push dummy history entry so back button/gesture dismisses sheet
    const stateKey = "filter_sheet_active";
    window.history.pushState({ [stateKey]: true }, "");

    const onPop = () => {
      setOpenFilters(false);
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [openFilters]);

  const closeFilters = () => {
    if (window.history.state && window.history.state.filter_sheet_active) {
      window.history.back();
    } else {
      setOpenFilters(false);
    }
  };

  const sortOptions = [
    { key: "popularity", label: t("sort_featured") || "Featured" },
    { key: "name", label: t("sort_name") || "Name A–Z" },
    { key: "low", label: t("sort_price_asc") || "Price: Low to High" },
    { key: "high", label: t("sort_price_desc") || "Price: High to Low" },
  ];

  return (
    <>
      {/* Catalogue Header */}
      <section className="catalog-header-section">
        <div className="wrap">
          <div className="catalog-title-row">
            <h1 className="catalog-main-title">{t("catalog_title") || "Catalogue"}</h1>
          </div>
        </div>
      </section>

      {/* Sticky Search & Filter Bar */}
      <div className="products-sticky-bar">
        <div className="wrap">
          <div className="products-sticky-search-row">
            <ProductSearchBar
              value={q}
              onChange={(val) => {
                setQ(val);
                setVerbatimQ("");
                updateFilters({ query: val });
              }}
              onSubmit={(val) => {
                setQ(val);
                setVerbatimQ("");
                updateFilters({ query: val });
              }}
              placeholder={t("search_app_placeholder") || "Search products, models, SKU..."}
            />

            <button
              type="button"
              className="icon-btn filter-btn"
              aria-expanded={openFilters}
              aria-controls="filters"
              aria-label={t("filter_btn")}
              onClick={() => setOpenFilters((v) => !v)}
              style={
                openFilters || activeFilterCount > 0
                  ? { background: "var(--blue-100)", borderColor: "var(--blue-300)" }
                  : undefined
              }
              title={`Filters (${activeFilterCount})`}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                <Icon name="filter" size={18} />
                {activeFilterCount > 0 && (
                  <span className="fgroup-badge-count" style={{ position: "absolute", top: "-8px", right: "-8px" }}>
                    {activeFilterCount}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Category Chips with Multi-Select & Favorites Toggle */}
      <div className="toolbar toolbar-chips-only">
        <div className="wrap">
          <div className="catchips" role="group" aria-label="Filter by category">
            {/* All Products Chip (Selected = Dark Navy in Frame 1) */}
            <button
              type="button"
              className={`catchip catchip-all ${selectedCats.length === 0 && !onlyFavorites ? "catchip-stitch-selected" : ""}`}
              aria-pressed={selectedCats.length === 0 && !onlyFavorites}
              onClick={() => updateFilters({ cats: [], saved: false })}
            >
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "8px",
                  background: selectedCats.length === 0 && !onlyFavorites ? "rgba(255,255,255,0.18)" : "var(--blue-50)",
                  display: "grid",
                  placeItems: "center",
                  color: selectedCats.length === 0 && !onlyFavorites ? "#ffffff" : "var(--blue-ink)",
                }}
              >
                <Icon name="grid" size={22} />
              </div>
              <span>
                {t("filter_all") || "All"}
                <br />
                <small style={{ fontWeight: 600, opacity: 0.85 }}>{PRODUCTS.length}</small>
              </span>
            </button>

            {/* Saved Favorites Chip */}
            <button
              type="button"
              className={`catchip catchip-fav ${onlyFavorites ? "catchip-stitch-selected" : ""}`}
              aria-pressed={onlyFavorites}
              onClick={() => updateFilters({ saved: !onlyFavorites })}
              title="Show saved favorites only"
            >
              <div
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "8px",
                  background: onlyFavorites ? "rgba(255,255,255,0.18)" : "#fff1f1",
                  display: "grid",
                  placeItems: "center",
                  color: onlyFavorites ? "#ffffff" : "#d64545",
                }}
              >
                <Icon name="heart" size={22} style={onlyFavorites ? { fill: "#ffffff" } : undefined} />
              </div>
              <span>
                {t("filter_saved_only") || "Saved"}
                <br />
                <small style={{ fontWeight: 600, opacity: 0.9 }}>{favCount}</small>
              </span>
            </button>

            {/* Individual Categories (Can select multiple!) */}
            {CATEGORIES.map((c) => {
              const isSelected = selectedCats.includes(c.key);
              return (
                <button
                  key={c.key}
                  className={`catchip ${isSelected ? "catchip-stitch-selected" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => updateFilters({ cats: toggleInList(selectedCats, c.key) })}
                  title={isSelected ? `Remove ${c.label}` : `Add ${c.label}`}
                >
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
                    <small style={{ fontWeight: 500, opacity: isSelected ? 0.9 : 0.7 }}>{counts[c.key] || 0}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Frame 3: Filters & Attributes Bottom Sheet Modal */}
      {openFilters && (
        <>
          <div
            className="filters-backdrop"
            onClick={closeFilters}
            aria-hidden="true"
          />
          <div
            className="filters-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters & Attributes"
          >
            <div className="sheet-drag-handle" />

            <div className="sheet-header">
              <div className="sheet-header-left">
                <button
                  type="button"
                  className="sheet-back-btn"
                  onClick={closeFilters}
                  aria-label={t("back") || "Back"}
                >
                  <Icon name="chevleft" size={16} />
                  <span>{t("back") || "Back"}</span>
                </button>
                <div className="sheet-title-group">
                  <h2 className="sheet-title">{t("filter_btn") || "Filters"}</h2>
                  {activeFilterCount > 0 && (
                    <span className="sheet-active-pill">{activeFilterCount} Active</span>
                  )}
                </div>
              </div>
              <div className="sheet-header-actions">
                {dirty && (
                  <button type="button" className="sheet-reset-btn" onClick={clearAll}>
                    {t("clear_filters") || "Reset All"}
                  </button>
                )}
                <button
                  type="button"
                  className="sheet-close-btn"
                  onClick={closeFilters}
                  aria-label="Close filters"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>

            <div className="sheet-body">
              {/* 1. Sort By */}
              <div className="sheet-section">
                <div className="sheet-sec-header">
                  <div className="sheet-sec-title-wrap">
                    <h3 className="sheet-sec-title">{t("sort_label") || "Sort By"}</h3>
                  </div>
                </div>
                <div className="sheet-chips-row">
                  {sortOptions.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={`sheet-chip ${sort === s.key ? "active" : ""}`}
                      onClick={() => {
                        setSort(s.key);
                        reset();
                      }}
                    >
                      <span>{sort === s.key ? `✓ ${s.label}` : s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Categories Multi-Select */}
              <div className="sheet-section">
                <div className="sheet-sec-header">
                  <div className="sheet-sec-title-wrap">
                    <h3 className="sheet-sec-title">{t("spec_category") || "Category"}</h3>
                    {selectedCats.length > 0 && (
                      <span className="sheet-sec-badge">{selectedCats.length}</span>
                    )}
                  </div>
                  {selectedCats.length > 0 && (
                    <button
                      type="button"
                      className="sheet-sec-clear-btn"
                      onClick={() => updateFilters({ cats: [] })}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="sheet-cats-grid">
                  {CATEGORIES.map((c) => {
                    const isSelected = selectedCats.includes(c.key);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={`sheet-cat-card ${isSelected ? "active" : ""}`}
                        onClick={() => updateFilters({ cats: toggleInList(selectedCats, c.key) })}
                      >
                        <span className="sheet-cat-name">
                          {isSelected && <span className="sheet-check-mark">✓</span>}
                          {tCat(c.key, c.label)}
                        </span>
                        <span className="sheet-cat-count">{counts[c.key] || 0}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Brand Multi-Select */}
              {facets.brand.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-sec-header">
                    <div className="sheet-sec-title-wrap">
                      <h3 className="sheet-sec-title">{t("spec_brand") || "Brand"}</h3>
                      {selectedBrands.length > 0 && (
                        <span className="sheet-sec-badge">{selectedBrands.length}</span>
                      )}
                    </div>
                    {selectedBrands.length > 0 && (
                      <button
                        type="button"
                        className="sheet-sec-clear-btn"
                        onClick={() => updateFilters({ brands: [] })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="sheet-chips-row">
                    {facets.brand.map(([key, label, n]) => {
                      const isSelected = selectedBrands.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sheet-chip ${isSelected ? "active" : ""}`}
                          onClick={() => updateFilters({ brands: toggleInList(selectedBrands, key) })}
                        >
                          <span>{isSelected ? `✓ ${label}` : label}</span>
                          <span className="sheet-chip-count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Multi-Select */}
              {facets.size.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-sec-header">
                    <div className="sheet-sec-title-wrap">
                      <h3 className="sheet-sec-title">{t("filter_size") || "Size"}</h3>
                      {selectedSizes.length > 0 && (
                        <span className="sheet-sec-badge">{selectedSizes.length}</span>
                      )}
                    </div>
                    {selectedSizes.length > 0 && (
                      <button
                        type="button"
                        className="sheet-sec-clear-btn"
                        onClick={() => updateFilters({ sizes: [] })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="sheet-chips-row">
                    {facets.size.map(([key, label, n]) => {
                      const isSelected = selectedSizes.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sheet-chip ${isSelected ? "active" : ""}`}
                          onClick={() => updateFilters({ sizes: toggleInList(selectedSizes, key) })}
                        >
                          <span>{isSelected ? `✓ ${label}` : label}</span>
                          <span className="sheet-chip-count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Motor Type Multi-Select */}
              {facets.motor.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-sec-header">
                    <div className="sheet-sec-title-wrap">
                      <h3 className="sheet-sec-title">{t("filter_motor") || "Motor Type"}</h3>
                      {selectedMotors.length > 0 && (
                        <span className="sheet-sec-badge">{selectedMotors.length}</span>
                      )}
                    </div>
                    {selectedMotors.length > 0 && (
                      <button
                        type="button"
                        className="sheet-sec-clear-btn"
                        onClick={() => updateFilters({ motors: [] })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="sheet-chips-row">
                    {facets.motor.map(([key, label, n]) => {
                      const isSelected = selectedMotors.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sheet-chip ${isSelected ? "active" : ""}`}
                          onClick={() => updateFilters({ motors: toggleInList(selectedMotors, key) })}
                        >
                          <span>{isSelected ? `✓ ${label}` : label}</span>
                          <span className="sheet-chip-count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Burner Configuration */}
              {facets.burners.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-sec-header">
                    <div className="sheet-sec-title-wrap">
                      <h3 className="sheet-sec-title">{t("filter_burners") || "Burners"}</h3>
                      {selectedBurners.length > 0 && (
                        <span className="sheet-sec-badge">{selectedBurners.length}</span>
                      )}
                    </div>
                    {selectedBurners.length > 0 && (
                      <button
                        type="button"
                        className="sheet-sec-clear-btn"
                        onClick={() => updateFilters({ burners: [] })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="sheet-chips-row">
                    {facets.burners.map(([key, label, n]) => {
                      const isSelected = selectedBurners.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sheet-chip ${isSelected ? "active" : ""}`}
                          onClick={() => updateFilters({ burners: toggleInList(selectedBurners, key) })}
                        >
                          <span>{isSelected ? `✓ ${label}` : label}</span>
                          <span className="sheet-chip-count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Finish & Color Multi-Select */}
              {facets.finish.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-sec-header">
                    <div className="sheet-sec-title-wrap">
                      <h3 className="sheet-sec-title">{t("filter_finish") || "Finish / Color"}</h3>
                      {selectedFinishes.length > 0 && (
                        <span className="sheet-sec-badge">{selectedFinishes.length}</span>
                      )}
                    </div>
                    {selectedFinishes.length > 0 && (
                      <button
                        type="button"
                        className="sheet-sec-clear-btn"
                        onClick={() => updateFilters({ finishes: [] })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="sheet-chips-row">
                    {facets.finish.map(([key, label, n]) => {
                      const isSelected = selectedFinishes.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sheet-chip ${isSelected ? "active" : ""}`}
                          onClick={() => updateFilters({ finishes: toggleInList(selectedFinishes, key) })}
                        >
                          <span>{isSelected ? `✓ ${label}` : label}</span>
                          <span className="sheet-chip-count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Features / Ignition Multi-Select */}
              {facets.ignition.length > 0 && (
                <div className="sheet-section">
                  <div className="sheet-sec-header">
                    <div className="sheet-sec-title-wrap">
                      <h3 className="sheet-sec-title">{t("filter_features") || "Features"}</h3>
                      {selectedIgnitions.length > 0 && (
                        <span className="sheet-sec-badge">{selectedIgnitions.length}</span>
                      )}
                    </div>
                    {selectedIgnitions.length > 0 && (
                      <button
                        type="button"
                        className="sheet-sec-clear-btn"
                        onClick={() => updateFilters({ ignitions: [] })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="sheet-chips-row">
                    {facets.ignition.map(([key, label, n]) => {
                      const isSelected = selectedIgnitions.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`sheet-chip ${isSelected ? "active" : ""}`}
                          onClick={() => updateFilters({ ignitions: toggleInList(selectedIgnitions, key) })}
                        >
                          <span>{isSelected ? `✓ ${label}` : label}</span>
                          <span className="sheet-chip-count">{n}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Sheet Footer */}
            <div className="sheet-footer">
              <button
                type="button"
                className="sheet-clear-btn"
                onClick={clearAll}
                disabled={!dirty}
                style={!dirty ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                {t("clear_filters") || "Clear All"} {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
              </button>
              <button
                type="button"
                className="sheet-apply-btn"
                onClick={closeFilters}
              >
                <span>
                  {t("view_all") || "Show"} {results.length} {results.length === 1 ? "Product" : "Products"}
                </span>
                <span className="sheet-apply-arrow">➔</span>
              </button>
            </div>
          </div>
        </>
      )}

      <section className="sec">
        <div className="wrap listing">
          <aside className="filters" id="filters" data-open={openFilters || undefined}>
            <div className="fhead">
              <h2>
                {t("filter_btn")}{" "}
                {activeFilterCount > 0 && <span className="fgroup-badge-count">{activeFilterCount}</span>}
              </h2>
              {dirty && (
                <button className="link" onClick={clearAll}>
                  {t("clear_filters")}
                </button>
              )}
            </div>

            <Group
              title={t("spec_category") || "Category"}
              options={CATEGORIES.map((c) => [c.key, tCat(c.key, c.label), counts[c.key] || 0])}
              selected={selectedCats}
              onToggle={(k) => updateFilters({ cats: toggleInList(selectedCats, k) })}
              onClear={() => updateFilters({ cats: [] })}
            />

            <Group
              title={t("spec_brand") || "Brand"}
              options={facets.brand}
              selected={selectedBrands}
              onToggle={(k) => updateFilters({ brands: toggleInList(selectedBrands, k) })}
              onClear={() => updateFilters({ brands: [] })}
            />

            <Group
              title={t("filter_size") || "Size"}
              options={facets.size}
              selected={selectedSizes}
              onToggle={(k) => updateFilters({ sizes: toggleInList(selectedSizes, k) })}
              onClear={() => updateFilters({ sizes: [] })}
            />

            <Group
              title={t("filter_motor") || "Motor Type"}
              options={facets.motor}
              selected={selectedMotors}
              onToggle={(k) => updateFilters({ motors: toggleInList(selectedMotors, k) })}
              onClear={() => updateFilters({ motors: [] })}
            />

            <Group
              title={t("filter_burners") || "Burners"}
              options={facets.burners}
              selected={selectedBurners}
              onToggle={(k) => updateFilters({ burners: toggleInList(selectedBurners, k) })}
              onClear={() => updateFilters({ burners: [] })}
            />

            <Group
              title={t("filter_features") || "Features"}
              options={facets.ignition}
              selected={selectedIgnitions}
              onToggle={(k) => updateFilters({ ignitions: toggleInList(selectedIgnitions, k) })}
              onClear={() => updateFilters({ ignitions: [] })}
            />

            <Group
              title={t("filter_finish") || "Finish"}
              options={facets.finish}
              selected={selectedFinishes}
              onToggle={(k) => updateFilters({ finishes: toggleInList(selectedFinishes, k) })}
              onClear={() => updateFilters({ finishes: [] })}
            />

            <button className="btn btn-navy btn-block done-btn" onClick={() => setOpenFilters(false)}>
              {t("view_all")} ({results.length})
            </button>
          </aside>

          <div>
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link to="/">{t("nav_home")}</Link>
              <Icon name="chev" size={13} />
              <span>{t("nav_products")}</span>
              {selectedCats.length === 1 && (
                <>
                  <Icon name="chev" size={13} />
                  <span>
                    {selectedCats[0] === "trial"
                      ? (t("sec_fast_title") || "Trial")
                      : tCat(
                          selectedCats[0],
                          CATEGORIES.find((c) => c.key === selectedCats[0])?.label
                        )}
                  </span>
                </>
              )}
            </nav>

            {/* Active Multi-Select Filter Pills Bar */}
            {dirty && (
              <div className="active-filters-bar" aria-label="Active filters">
                {selectedCats.map((catKey) => {
                  const catObj = CATEGORIES.find((c) => c.key === catKey);
                  return (
                    <span key={catKey} className="active-filter-pill">
                      <span>{catKey === "trial" ? (t("sec_fast_title") || "Trial") : (catObj ? tCat(catObj.key, catObj.label) : catKey)}</span>
                      <button
                        type="button"
                        onClick={() => updateFilters({ cats: selectedCats.filter((c) => c !== catKey) })}
                        aria-label={`Remove category ${catKey}`}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  );
                })}

                {selectedBrands.map((b) => (
                  <span key={b} className="active-filter-pill">
                    <span>{b}</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ brands: selectedBrands.filter((x) => x !== b) })}
                      aria-label={`Remove brand ${b}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}

                {selectedSizes.map((s) => (
                  <span key={s} className="active-filter-pill">
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ sizes: selectedSizes.filter((x) => x !== s) })}
                      aria-label={`Remove size ${s}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}

                {selectedMotors.map((m) => (
                  <span key={m} className="active-filter-pill">
                    <span>{m} Motor</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ motors: selectedMotors.filter((x) => x !== m) })}
                      aria-label={`Remove motor ${m}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}

                {selectedBurners.map((b) => (
                  <span key={b} className="active-filter-pill">
                    <span>{b} Burner</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ burners: selectedBurners.filter((x) => x !== b) })}
                      aria-label={`Remove ${b} burner filter`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}

                {selectedIgnitions.map((ig) => (
                  <span key={ig} className="active-filter-pill">
                    <span>{ig === "auto" ? "Auto Ignition" : "Manual"}</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ ignitions: selectedIgnitions.filter((x) => x !== ig) })}
                      aria-label={`Remove ${ig} filter`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}

                {selectedFinishes.map((f) => (
                  <span key={f} className="active-filter-pill">
                    <span>{f}</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ finishes: selectedFinishes.filter((x) => x !== f) })}
                      aria-label={`Remove finish ${f}`}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}

                {onlyFavorites && (
                  <span className="active-filter-pill" style={{ background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" }}>
                    <span>♥ Saved Favorites</span>
                    <button
                      type="button"
                      onClick={() => updateFilters({ saved: false })}
                      aria-label="Remove saved filter"
                      style={{ color: "#b91c1c" }}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                )}

                {q.trim() && (
                  <span className="active-filter-pill">
                    <span>“{q.trim()}”</span>
                    <button
                      type="button"
                      onClick={() => {
                        setQ("");
                        setVerbatimQ("");
                        updateFilters({ query: "" });
                      }}
                      aria-label="Clear search query"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                )}

                <button type="button" className="clear-all-pill" onClick={clearAll}>
                  {t("clear_filters") || "Clear all"}
                </button>
              </div>
            )}

            {/* Autocorrect Notice Banner */}
            {isUsingAutocorrect && autocorrect && (
              <div className="catalog-autocorrect-notice" role="status">
                <div>
                  <span>{t("showing_results_for") || "Showing results for"} <b>“{autocorrect}”</b></span>
                  <span className="muted" style={{ marginLeft: "8px", fontSize: "0.82rem" }}>
                    (No exact matches for “{q.trim()}”)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVerbatimQ(q.trim());
                  }}
                >
                  {t("search_instead_for") || "Search instead for"} “{q.trim()}”
                </button>
              </div>
            )}

            <div className="sec-head">
              <h2>
                {selectedCats.length === 1
                  ? (selectedCats[0] === "trial"
                      ? (t("sec_fast_title") || "Trial")
                      : tCat(
                          selectedCats[0],
                          CATEGORIES.find((c) => c.key === selectedCats[0])?.label
                        ))
                  : selectedCats.length > 1
                  ? `${selectedCats.length} Categories`
                  : onlyFavorites
                  ? t("favorites_title") || "Saved Favorites"
                  : t("cat_all")}{" "}
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
                <p className="muted">{t("no_products_sub")}</p>
                <button className="btn btn-navy" style={{ marginTop: "var(--s5)" }} onClick={clearAll}>
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
