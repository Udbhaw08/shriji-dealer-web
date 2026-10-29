import { Link, useLocation } from "react-router-dom";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import { useSession } from "../data/session";
import { isPortalGated } from "../data/portalGate";
import { useFavorites } from "../data/favoritesStore";

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const session = useSession();
  const isGated = isPortalGated(session);
  const { count: favCount } = useFavorites();

  const isHome = pathname === "/";
  const isProducts = pathname === "/products" || pathname.startsWith("/products/");
  const isFavorites = pathname === "/favorites";
  const isSchemes = pathname.startsWith("/schemes");
  const isSupport = pathname.startsWith("/support");

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="mobile-bottom-inner">
        {/* 5-Tab Bar */}
        <div className="mobile-bottom-tabs">
          <Link
            to="/"
            className={`mobile-bottom-tab ${isHome ? "active" : ""}`}
            aria-current={isHome ? "page" : undefined}
          >
            <span className="mobile-tab-pill">
              <Icon name="home" size={20} />
              <span className="mobile-tab-text">{t("nav_home") || "Home"}</span>
            </span>
          </Link>

          {!isGated && (
            <>
              <Link
                to="/products"
                className={`mobile-bottom-tab ${isProducts ? "active" : ""}`}
                aria-current={isProducts ? "page" : undefined}
              >
                <span className="mobile-tab-pill">
                  <Icon name="grid" size={20} />
                  <span className="mobile-tab-text">{t("nav_products") || "Products"}</span>
                </span>
              </Link>

              <Link
                to="/favorites"
                className={`mobile-bottom-tab ${isFavorites ? "active" : ""}`}
                aria-current={isFavorites ? "page" : undefined}
              >
                <span className="mobile-tab-pill">
                  <span className="mobile-tab-icon-wrap">
                    <Icon name="heart" size={20} />
                    {favCount > 0 && <span className="mobile-fav-count-dot">{favCount}</span>}
                  </span>
                  <span className="mobile-tab-text">{t("nav_favorites") || "Favourites"}</span>
                </span>
              </Link>

              <Link
                to="/schemes"
                className={`mobile-bottom-tab ${isSchemes ? "active" : ""}`}
                aria-current={isSchemes ? "page" : undefined}
              >
                <span className="mobile-tab-pill">
                  <Icon name="badge" size={20} />
                  <span className="mobile-tab-text">{t("nav_schemes") || "Schemes"}</span>
                </span>
              </Link>
            </>
          )}

          <Link
            to="/support"
            className={`mobile-bottom-tab ${isSupport ? "active" : ""}`}
            aria-current={isSupport ? "page" : undefined}
          >
            <span className="mobile-tab-pill">
              <Icon name="support" size={20} />
              <span className="mobile-tab-text">{t("nav_support") || "Support"}</span>
            </span>
          </Link>
        </div>

        {/* iOS Home Indicator Bar */}
        <div className="ios-home-indicator" aria-hidden="true">
          <div className="ios-home-indicator-bar" />
        </div>
      </div>
    </nav>
  );
}
