import { useMemo } from "react";
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

  const currentDealer = session.dealerId ? dealerById(session.dealerId) : null;

  const favoritedProducts = useMemo(() => {
    if (!favorites.length) return [];
    // Maintain the order in which user saved them (favorites array order)
    return favorites
      .map((id) => PRODUCTS.find((p) => String(p.id) === String(id)))
      .filter(Boolean);
  }, [favorites, PRODUCTS]);

  const handleWhatsAppEnquiry = () => {
    if (!favoritedProducts.length) return;

    const dealerName = currentDealer?.name ? `Dealer: ${currentDealer.name} (${currentDealer.phone || ""})\n` : "";
    const lines = favoritedProducts.map((p, i) => {
      const { mrp, dealer } = priceFor(p);
      const priceStr = dealer > 0 ? `Rate: ${inr(dealer)}` : mrp > 0 ? `MRP: ${inr(mrp)}` : "Price on Request";
      return `${i + 1}. Sunshine ${p.model || p.name} (${p.catLabel || p.cat}) - ${priceStr}`;
    });

    const text = `Hello Shriji Domestic, I would like to enquire about my saved products:\n\n${dealerName}${lines.join(
      "\n"
    )}\n\nPlease share availability and delivery schedule.`;

    const url = `https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <section className="catalog-hero">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">{t("nav_home") || "Home"}</Link>
            <Icon name="chev" size={13} />
            <Link to="/products">{t("nav_products") || "Products"}</Link>
            <Icon name="chev" size={13} />
            <span>{t("nav_favorites") || "Favorites"}</span>
          </nav>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "var(--s4)" }}>
            <div>
              <h1 className="d2" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#d64545" }}>♥</span> {t("favorites_title") || "Saved Favorites"}
              </h1>
              <p className="sub" style={{ marginTop: "var(--s2)" }}>
                {t("favorites_sub") ||
                  "Your shortlisted Sunshine appliances for quick ordering, price tracking, and dealer enquiries."}
              </p>
            </div>
            {favoritedProducts.length > 0 && (
              <div className="row" style={{ gap: "var(--s3)", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-wa"
                  onClick={handleWhatsAppEnquiry}
                  aria-label="Enquire for all saved products on WhatsApp"
                >
                  <Icon name="wa" size={18} />
                  <span>{t("favorites_share") || "WhatsApp Order Enquiry"}</span>
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
                  aria-label="Clear all favorites"
                >
                  <Icon name="trash" size={16} />
                  <span>{t("favorites_clear") || "Clear All"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          {!loaded && PRODUCTS.length === 0 ? (
            <div className="empty" style={{ padding: "var(--s8) var(--s4)" }}>
              <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
                <Icon name="bolt" size={24} style={{ animation: "spin 1s linear infinite" }} />
              </span>
              <h3 className="h3">{t("connecting_zoho")}</h3>
              <p className="muted">Loading catalog items…</p>
            </div>
          ) : favoritedProducts.length === 0 ? (
            <div className="empty" style={{ maxWidth: "560px", margin: "var(--s6) auto", textAlign: "center" }}>
              <span
                className="tile tile-lg"
                style={{
                  margin: "0 auto var(--s4)",
                  background: "#fff1f1",
                  color: "#d64545",
                  width: "68px",
                  height: "68px",
                  borderRadius: "20px",
                }}
              >
                <Icon name="heart" size={32} />
              </span>
              <h2 className="h3">{t("favorites_empty_title") || "No favorites saved yet"}</h2>
              <p className="muted" style={{ marginTop: "var(--s2)", fontSize: "0.95rem" }}>
                {t("favorites_empty_sub") ||
                  "Tap the heart icon on any product in the catalog to save it here for fast comparisons and bulk order enquiries."}
              </p>
              <div style={{ marginTop: "var(--s6)" }}>
                <Link to="/products" className="btn btn-navy">
                  <Icon name="grid" size={16} />
                  <span>{t("hero_cta_browse") || "Browse Products Catalogue"}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="sec-head" style={{ marginBottom: "var(--s5)" }}>
                <h2>
                  {t("favorites_title") || "Shortlisted Items"}{" "}
                  <span className="muted" style={{ fontWeight: 500 }}>
                    ({favoritedProducts.length})
                  </span>
                </h2>
                <Link to="/products" className="link">
                  {t("hero_cta_browse") || "Browse full catalog"} <Icon name="arrowsm" size={15} />
                </Link>
              </div>

              <div className="prods">
                {favoritedProducts.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
