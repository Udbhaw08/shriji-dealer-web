import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { useFavorites } from "../data/favoritesStore";
import { useLanguage } from "../data/i18n";
import { useSession } from "../data/session";
import { Icon } from "../ui";
import { COMPANY } from "../data/site";
import { priceFor, inr, dealerById } from "../data/dealer";
import ProductCard from "../components/ProductCard";

export default function Favorites() {
  const { products: PRODUCTS, loaded } = useProducts();
  const { favorites, clearFavorites } = useFavorites();
  const { t } = useLanguage();
  const session = useSession();
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const currentDealer = session.dealerId ? dealerById(session.dealerId) : null;

  // Resolve favorited products in the order they were saved
  const favoritedProducts = useMemo(() => {
    if (!favorites.length) return [];
    return favorites
      .map((id) => PRODUCTS.find((p) => String(p.id) === String(id)))
      .filter(Boolean);
  }, [favorites, PRODUCTS]);

  // Recommended popular items when shortlist is empty
  const recommendedProducts = useMemo(() => {
    if (!PRODUCTS.length) return [];
    // Prioritize popular items with images
    const withImg = PRODUCTS.filter((p) => p.img && !favorites.includes(String(p.id)));
    // Pick 4 diverse products across categories
    const picks = [];
    const seenCats = new Set();
    for (const p of withImg) {
      const cat = p.cat || "general";
      if (!seenCats.has(cat)) {
        seenCats.add(cat);
        picks.push(p);
      }
      if (picks.length >= 4) break;
    }
    // Fill up to 4 if needed
    if (picks.length < 4) {
      for (const p of withImg) {
        if (!picks.some((item) => item.id === p.id)) {
          picks.push(p);
        }
        if (picks.length >= 4) break;
      }
    }
    return picks;
  }, [PRODUCTS, favorites]);

  // Total estimated value
  const totalSummary = useMemo(() => {
    if (!favoritedProducts.length) return { totalRate: 0, totalMrp: 0, hasDealerRates: false };
    let totalRate = 0;
    let totalMrp = 0;
    let hasDealerRates = false;

    for (const p of favoritedProducts) {
      const { mrp, dealer } = priceFor(p);
      if (dealer > 0) {
        totalRate += dealer;
        hasDealerRates = true;
      } else if (mrp > 0) {
        totalRate += mrp;
      }
      if (mrp > 0) totalMrp += mrp;
    }

    return { totalRate, totalMrp, hasDealerRates };
  }, [favoritedProducts]);

  const handleWhatsAppEnquiry = () => {
    if (!favoritedProducts.length) return;

    const dealerName = currentDealer?.name ? `Dealer: ${currentDealer.name} (${currentDealer.phone || ""})\n` : "";
    const lines = favoritedProducts.map((p, i) => {
      const { mrp, dealer } = priceFor(p);
      const priceStr = dealer > 0 ? `Rate: ${inr(dealer)}` : mrp > 0 ? `MRP: ${inr(mrp)}` : "Price on Request";
      return `${i + 1}. Sunshine ${p.model || p.name} (${p.catLabel || p.cat || "Appliance"}) - ${priceStr}`;
    });

    const text = `Hello Shriji Domestic, I would like to enquire about my saved products shortlist (${favoritedProducts.length} items):\n\n${dealerName}${lines.join(
      "\n"
    )}\n\nPlease share current inventory availability and wholesale delivery schedule.`;

    const url = `https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareShortlist = async () => {
    if (!favorites.length) return;
    const shareUrl = `${window.location.origin}/products?saved=true`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2400);
    } catch {
      /* clipboard blocked */
    }
  };

  const CATEGORIES_LIST = [
    {
      title: "Gas Stoves",
      sub: "LPG & PNG Cooktops",
      icon: "stove",
      to: "/products?cat=gas_stoves,toughened_glass_cooktops,stainless_steel_cooktops",
    },
    {
      title: "Glass Hobs",
      sub: "Built-in & Hybrid Hobs",
      icon: "hob",
      to: "/products?cat=built_in_hobs",
    },
    {
      title: "Kitchen Chimneys",
      sub: "BLDC & Auto-Clean",
      icon: "chimney",
      to: "/products?cat=chimneys",
    },
    {
      title: "Small Appliances",
      sub: "Kettles, Mixers & Juicers",
      icon: "blender",
      to: "/products?cat=small_appliances",
    },
  ];

  return (
    <div className="fav-page">
      {/* Redesigned Hero & Breadcrumbs Section */}
      <section className="fav-hero">
        <div className="wrap">
          <div className="fav-hero-inner">
            {/* Top Clean Breadcrumb Navigation */}
            <nav className="fav-crumbs" aria-label="Breadcrumb">
              <Link to="/">{t("nav_home") || "Home"}</Link>
              <Icon name="chev" size={12} />
              <Link to="/products">{t("nav_products") || "Products"}</Link>
              <Icon name="chev" size={12} />
              <span className="fav-crumbs-current">Favorites</span>
            </nav>

            {/* Header Main Bar */}
            <div className="fav-hero-main">
              <div className="fav-title-group">
                <div className="fav-heart-icon-badge" aria-hidden="true">
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: 28 }}>
                    favorite
                  </span>
                </div>
                <div>
                  <h1 className="fav-title" style={{ margin: 0 }}>Favorites</h1>
                </div>
              </div>

              {/* Action Buttons (When Items Exist) */}
              {favoritedProducts.length > 0 && (
                <div className="fav-hero-actions">
                  <button
                    type="button"
                    className="btn btn-wa"
                    onClick={handleWhatsAppEnquiry}
                    aria-label="Enquire for all saved products on WhatsApp"
                    style={{ minHeight: 44, padding: "0 18px", borderRadius: 12, fontWeight: 700 }}
                  >
                    <Icon name="wa" size={18} />
                    <span>WhatsApp Order ({favoritedProducts.length})</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleShareShortlist}
                    title="Share shortlist link"
                    style={{ minHeight: 44, padding: "0 14px", borderRadius: 12 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>share</span>
                    <span>{copiedShareLink ? "Copied Link!" : "Share"}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear all your saved favorites?")) {
                        clearFavorites();
                      }
                    }}
                    title="Clear all favorites"
                    style={{ minHeight: 44, padding: "0 14px", borderRadius: 12, color: "#ba1a1a" }}
                  >
                    <Icon name="trash" size={16} />
                    <span>Clear All</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="sec">
        <div className="wrap">
          {!loaded && PRODUCTS.length === 0 ? (
            <div className="empty" style={{ padding: "var(--s8) var(--s4)", textAlign: "center" }}>
              <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
                <Icon name="bolt" size={24} style={{ animation: "spin 1s linear infinite" }} />
              </span>
              <h3 className="h3">{t("connecting_zoho") || "Connecting to Zoho Catalog"}</h3>
              <p className="muted">Loading appliances and wholesale pricebooks…</p>
            </div>
          ) : favoritedProducts.length === 0 ? (
            /* ============================================================
               EMPTY STATE: Premium Hero Card + Categories + Recommendations
               ============================================================ */
            <div>
              {/* Centered Hero Empty Card */}
              <div className="fav-empty-card">
                <div className="fav-empty-glow">
                  <div className="fav-empty-inner-badge">
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: 30 }}>
                      favorite
                    </span>
                  </div>
                </div>

                <h2 className="fav-empty-title">
                  {t("favorites_empty_title") || "Your Shortlist is Empty"}
                </h2>

                <p className="fav-empty-desc">
                  {t("favorites_empty_sub") ||
                    "Bookmark your top Sunshine appliances while browsing the catalog for quick wholesale pricing comparisons, instant client sharing, and 1-tap WhatsApp bulk orders."}
                </p>

                <div className="fav-empty-ctas">
                  <Link
                    to="/products"
                    className="btn btn-navy"
                    style={{
                      minHeight: 46,
                      padding: "0 22px",
                      borderRadius: 12,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>storefront</span>
                    <span>Explore Products Catalog</span>
                  </Link>

                  <Link
                    to="/schemes"
                    className="btn btn-ghost"
                    style={{
                      minHeight: 46,
                      padding: "0 18px",
                      borderRadius: 12,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>loyalty</span>
                    <span>View Active Schemes</span>
                  </Link>
                </div>
              </div>

              {/* Quick Categories Navigation Strip */}
              <div className="fav-categories-section">
                <div className="fav-section-head">
                  <div>
                    <h3 className="fav-section-title">Explore Sunshine Appliances Range</h3>
                    <p className="fav-section-sub">Quickly jump to any category to discover and shortlist models:</p>
                  </div>
                  <Link to="/products" className="link" style={{ fontSize: 13, fontWeight: 600 }}>
                    View full catalogue <Icon name="arrowsm" size={14} />
                  </Link>
                </div>

                <div className="fav-categories-grid">
                  {CATEGORIES_LIST.map((cat) => (
                    <Link key={cat.title} to={cat.to} className="fav-category-tile">
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div className="fav-category-icon-wrap">
                          <Icon name={cat.icon} size={22} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
                            {cat.title}
                          </span>
                          <span style={{ display: "block", fontSize: 12, color: "var(--tx-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {cat.sub}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--tx-3)" }}>
                        chevron_right
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recommended Popular Models Preview */}
              {recommendedProducts.length > 0 && (
                <div className="fav-recommended-section">
                  <div className="fav-section-head">
                    <div>
                      <h3 className="fav-section-title">Popular Fast-Moving Models</h3>
                      <p className="fav-section-sub">Tap the heart icon on any model to instantly add it to your shortlist:</p>
                    </div>
                  </div>

                  <div className="prods">
                    {recommendedProducts.map((p) => (
                      <ProductCard key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ============================================================
               POPULATED STATE: Shortlist Summary Bar + Products Grid
               ============================================================ */
            <div>
              {/* Shortlist Summary Bar */}
              <div className="fav-summary-bar">
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="fav-summary-pill">
                    <span className="material-symbols-outlined fill-1" style={{ fontSize: 16 }}>
                      check_circle
                    </span>
                    {favoritedProducts.length} Appliance{favoritedProducts.length > 1 ? "s" : ""} Shortlisted
                  </span>
                  {totalSummary.totalRate > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
                      Est. Total:{" "}
                      <span style={{ color: "#16834a" }}>{inr(totalSummary.totalRate)}</span>
                      {totalSummary.hasDealerRates && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--tx-2)", marginLeft: 6 }}>
                          (Wholesale Rate)
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-wa btn-sm"
                    onClick={handleWhatsAppEnquiry}
                    style={{ fontWeight: 700, borderRadius: 10 }}
                  >
                    <Icon name="wa" size={16} />
                    <span>WhatsApp Order Quote</span>
                  </button>

                  <Link to="/products" className="btn btn-ghost btn-sm" style={{ borderRadius: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                    <span>Add More</span>
                  </Link>
                </div>
              </div>

              {/* Products Cards Grid */}
              <div className="prods">
                {favoritedProducts.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Share Toast Notification */}
      {copiedShareLink && (
        <div className="fav-share-toast">
          <span className="material-symbols-outlined fill-1" style={{ fontSize: 18, color: "#86efac" }}>
            check_circle
          </span>
          <span>Shortlist link copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}
