import { Link, useLocation } from "react-router-dom";
import { Icon } from "../ui";
import { COMPANY } from "../data/site";
import { useLanguage } from "../data/i18n";

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  const isHome = pathname === "/";
  const isProducts = pathname === "/products" || pathname.startsWith("/products/");
  const isSchemes = pathname.startsWith("/schemes");
  const isMore = pathname.startsWith("/support") || pathname.startsWith("/login");

  const phoneTel = COMPANY.phone.replace(/[^0-9+]/g, "");

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="mobile-bottom-inner">
        <div className="mobile-bottom-tabs">
          <Link
            to="/"
            className={`mobile-bottom-tab ${isHome ? "active" : ""}`}
            aria-current={isHome ? "page" : undefined}
          >
            <span className="mobile-tab-pill">
              <Icon name="home" size={19} />
              <span className="mobile-tab-text">{t("nav_home") || "Home"}</span>
            </span>
          </Link>

          <Link
            to="/products"
            className={`mobile-bottom-tab ${isProducts ? "active" : ""}`}
            aria-current={isProducts ? "page" : undefined}
          >
            <span className="mobile-tab-pill">
              <Icon name="grid" size={19} />
              <span className="mobile-tab-text">{t("nav_products") || "Products"}</span>
            </span>
          </Link>

          <Link
            to="/schemes"
            className={`mobile-bottom-tab ${isSchemes ? "active" : ""}`}
            aria-current={isSchemes ? "page" : undefined}
          >
            <span className="mobile-tab-pill">
              <Icon name="badge" size={19} />
              <span className="mobile-tab-text">{t("nav_schemes") || "Schemes"}</span>
            </span>
          </Link>

          <Link
            to="/support"
            className={`mobile-bottom-tab ${isMore ? "active" : ""}`}
            aria-current={isMore ? "page" : undefined}
          >
            <span className="mobile-tab-pill">
              <Icon name="menu" size={19} />
              <span className="mobile-tab-text">{t("nav_more") || "More"}</span>
            </span>
          </Link>
        </div>

        <a href={`tel:${phoneTel}`} className="mobile-bottom-call-bar" aria-label={`Call ${COMPANY.phone} for details`}>
          <div className="call-bar-left">
            <span className="call-bar-icon-wrap">
              <Icon name="phone" size={15} />
            </span>
            <span className="call-bar-number">{COMPANY.phone}</span>
          </div>
          <span className="call-bar-action">Call for Details</span>
        </a>
      </div>
    </nav>
  );
}
