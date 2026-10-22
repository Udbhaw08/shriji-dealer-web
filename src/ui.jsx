import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { COMPANY, NAV } from "./data/site";
import { isDealer, useSession } from "./data/session";
import { dealerById } from "./data/dealer";
import { useLanguage } from "./data/i18n";
import { isPortalGated } from "./data/portalGate";
import { useFavorites } from "./data/favoritesStore";
import { apiFetch } from "./data/api";

/* Line icons, one 1.6 stroke family — matches the mockup's icon set. */
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const PATHS = {
  arrow: <path d="M4 10h12M11 5l5 5-5 5" />,
  arrowsm: <path d="M5 10h9M10 6l4 4-4 4" />,
  home: <path d="m3 9.5 7-6 7 6v8a1 1 0 0 1-1 1h-4v-5h-4v5H4a1 1 0 0 1-1-1v-8Z" />,
  grid: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </>
  ),
  badge: (
    <>
      <circle cx="10" cy="7.5" r="4.5" />
      <path d="m7 11.5-1.5 6 4.5-2.2 4.5 2.2-1.5-6" />
    </>
  ),
  chev: <path d="M8 5l5 5-5 5" />,
  chevleft: <path d="M12 5l-5 5 5 5" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.4" />
      <path d="m13.3 13.3 3.5 3.5" />
    </>
  ),
  filter: <path d="M3 5.5h14M5.5 10h9M8.5 14.5h3" />,
  heart: <path d="M10 16.2S3.6 12.4 3.6 8.1a3.4 3.4 0 0 1 6.4-1.6 3.4 3.4 0 0 1 6.4 1.6c0 4.3-6.4 8.1-6.4 8.1Z" />,
  stove: (
    <>
      <rect x="2.6" y="4.4" width="14.8" height="11.2" rx="2.2" />
      <circle cx="7" cy="8.4" r="1.8" />
      <circle cx="13" cy="8.4" r="1.8" />
      <path d="M5.4 12.8h9.2" />
    </>
  ),
  chimney: (
    <>
      <path d="M3 8.6 10 4l7 4.6" />
      <path d="M4.6 8.6v3.2a2 2 0 0 0 2 2h6.8a2 2 0 0 0 2-2V8.6" />
      <path d="M8.2 16.4h3.6" />
    </>
  ),
  hob: (
    <>
      <rect x="2.6" y="5.6" width="14.8" height="8.8" rx="2.2" />
      <circle cx="6.6" cy="10" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="13.4" cy="10" r="1.5" />
    </>
  ),
  blender: (
    <>
      <path d="M7 3.4h6l-.7 4.4H7.7L7 3.4Z" />
      <path d="M7.7 7.8 6.6 13a1.8 1.8 0 0 0 1.8 2.2h3.2A1.8 1.8 0 0 0 13.4 13l-1.1-5.2" />
      <path d="M6.6 16.6h6.8" />
    </>
  ),
  tag: (
    <>
      <path d="M3.4 9.2V4.2a.8.8 0 0 1 .8-.8h5l7.4 7.4a1.4 1.4 0 0 1 0 2l-4.2 4.2a1.4 1.4 0 0 1-2 0L3.4 9.2Z" />
      <circle cx="6.8" cy="6.8" r="1.1" />
    </>
  ),
  sparkle: <path d="M10 3.2 11.6 8 16.4 9.6 11.6 11.2 10 16l-1.6-4.8L3.6 9.6 8.4 8 10 3.2Z" />,
  support: (
    <>
      <circle cx="10" cy="10" r="6.6" />
      <circle cx="10" cy="10" r="2.4" />
      <path d="m5.4 5.4 2.9 2.9m3.4 3.4 2.9 2.9m0-9.2-2.9 2.9m-3.4 3.4-2.9 2.9" />
    </>
  ),
  doc: (
    <>
      <path d="M5 3.4h6l4 4v9.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1Z" />
      <path d="M11 3.4v4h4M6.8 11h6.4M6.8 13.8h4.4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4.2" width="14" height="11.6" rx="2" />
      <circle cx="7.4" cy="8.2" r="1.3" />
      <path d="m3.6 14 3.8-3.6 3 2.8 2.6-2.2 3.4 3" />
    </>
  ),
  download: <path d="M10 3.4v8.4m0 0 3-3m-3 3-3-3M4 14.2v1.4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.4" />,
  phone: <path d="M4.6 3.4h2.8l1.3 3.1-1.6 1.2a9 9 0 0 0 4.4 4.4l1.2-1.6 3.1 1.3v2.8a1.4 1.4 0 0 1-1.6 1.4A13 13 0 0 1 3.2 5a1.4 1.4 0 0 1 1.4-1.6Z" />,
  mail: (
    <>
      <rect x="2.8" y="4.6" width="14.4" height="10.8" rx="1.8" />
      <path d="m3.6 5.8 6.4 4.6 6.4-4.6" />
    </>
  ),
  pin: (
    <>
      <path d="M10 17.2s5.4-4.9 5.4-8.7a5.4 5.4 0 1 0-10.8 0c0 3.8 5.4 8.7 5.4 8.7Z" />
      <circle cx="10" cy="8.3" r="2" />
    </>
  ),
  wa: (
    <>
      <path d="M3.4 16.6 4.5 13a6.7 6.7 0 1 1 2.6 2.5l-3.7 1.1Z" />
      <path d="M7.5 8.1c.3 1.9 2.4 4 4.3 4.3.6.1 1.3-.4 1.4-1l-1.5-.8-.8.8a5.3 5.3 0 0 1-2-2l.8-.8-.8-1.5c-.6.1-1.1.8-1 1.4Z" />
    </>
  ),
  share: (
    <>
      <path d="M10 3.4v9.2M10 3.4 7.2 6.2M10 3.4l2.8 2.8" />
      <path d="M4.4 10.6v4.6a1.4 1.4 0 0 0 1.4 1.4h8.4a1.4 1.4 0 0 0 1.4-1.4v-4.6" />
    </>
  ),
  menu: <path d="M3.4 6h13.2M3.4 10h13.2M3.4 14h13.2" />,
  close: <path d="M5 5l10 10M15 5 5 15" />,
  check: <path d="M4.4 10.4 8 14l7.6-8" />,
  shield: (
    <>
      <path d="M10 3 4.6 5.2v4.2c0 3.3 2.2 6.3 5.4 7.4 3.2-1.1 5.4-4.1 5.4-7.4V5.2L10 3Z" />
      <path d="m7.8 9.8 1.6 1.6 3-3.2" />
    </>
  ),
  flame: <path d="M10 17c2.8 0 4.7-1.9 4.7-4.4 0-3.2-3.2-4.6-3-8.6C9.3 5.4 8 7.3 8 9c-.9-.4-1.3-1.2-1.4-2.2-1 1.2-1.3 2.9-1.3 4.8C5.3 14.6 7.2 17 10 17Z" />,
  glass: (
    <>
      <rect x="3" y="4.6" width="14" height="10.8" rx="2" />
      <path d="M6.2 13.4 12.4 6.6" />
      <path d="M9.4 14.2 14.6 8.4" />
    </>
  ),
  steel: (
    <>
      <rect x="3" y="4.6" width="14" height="10.8" rx="2" />
      <path d="M5.6 14.6 13.4 5.4M8.6 14.6 16.4 5.4" opacity="0.55" />
    </>
  ),
  bolt: <path d="M11.2 2.8 5.4 11h4L8.8 17.2 14.6 9h-4l.6-6.2Z" />,
  upload: (
    <>
      <path d="M10 13.4V4.6m0 0 3.2 3.2M10 4.6 6.8 7.8" />
      <path d="M4 12.6v2.8a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4v-2.8" />
    </>
  ),
  plus: <path d="M10 4.6v10.8M4.6 10h10.8" />,
  lock: (
    <>
      <rect x="4.4" y="8.6" width="11.2" height="8" rx="2" />
      <path d="M7 8.6V6.8a3 3 0 0 1 6 0v1.8" />
    </>
  ),
  eyeoff: (
    <>
      <path d="M7.6 7.7a3 3 0 0 0 4.2 4.2" />
      <path d="M5 5.4A9.6 9.6 0 0 0 2 10s3 5 8 5a8 8 0 0 0 3.6-.9M8.4 5.2A8.4 8.4 0 0 1 10 5c5 0 8 5 8 5a12 12 0 0 1-2.3 2.8" />
      <path d="M3.4 3.4l13.2 13.2" />
    </>
  ),
  mic: (
    <>
      <rect x="7" y="3" width="6" height="9" rx="3" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0" />
      <path d="M10 15v3m-3 0h6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6h12M7 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </>
  ),
  bell: (
    <>
      <path d="M15 13.5v-4a5 5 0 0 0-10 0v4l-1.5 2h13L15 13.5Z" />
      <path d="M8.5 17.5a1.8 1.8 0 0 0 3 0" />
    </>
  ),
  user: (
    <>
      <circle cx="10" cy="6" r="3.5" />
      <path d="M4 17a6 6 0 0 1 12 0" />
    </>
  ),
  layers: (
    <>
      <path d="m10 3 7 3.5-7 3.5-7-3.5L10 3Z" />
      <path d="m3 10.5 7 3.5 7-3.5" />
      <path d="m3 14.5 7 3.5 7-3.5" />
    </>
  ),
};

export function Icon({ name, size = 18, ...rest }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" {...base} {...rest}>
      {PATHS[name] || PATHS.doc}
    </svg>
  );
}

export function Mark() {
  const [brandLogo, setBrandLogo] = useState(() => {
    try {
      const raw = sessionStorage.getItem("shriji_supabase_branding_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.imageUrl) return parsed;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    let active = true;
    apiFetch("/api/branding")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.branding) {
          const primary = Array.isArray(data.branding)
            ? data.branding.find((b) => b.id === "logo-primary" || b.id.includes("logo")) || data.branding[0]
            : data.branding;
          if (primary && primary.imageUrl) {
            setBrandLogo(primary);
            try {
              sessionStorage.setItem("shriji_supabase_branding_v2", JSON.stringify(primary));
            } catch {}
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (brandLogo?.imageUrl) {
    return (
      <Link to="/" className="mark mark-restor-wrap mark-custom-logo" aria-label={brandLogo.title || "ReSTOR — Shriji Domestic Appliances"}>
        <img
          src={brandLogo.imageUrl}
          alt={brandLogo.title || "ReSTOR"}
          className="mark-logo-img"
          style={{ maxHeight: 34, maxWidth: 140, objectFit: "contain", display: "block" }}
          onError={() => setBrandLogo(null)}
        />
      </Link>
    );
  }

  return (
    <Link to="/" className="mark mark-restor-wrap" aria-label="ReSTOR — Shriji Domestic Appliances">
      <span className="mark-restor-text">
        <span className="mark-restor-re">Re</span>
        <span className="mark-restor-stor">STOR</span>
      </span>
    </Link>
  );
}

export function LangToggle({ className = "" }) {
  const { toggleLang, isHindi } = useLanguage();
  return (
    <button
      type="button"
      className={`lang-toggle ${className}`.trim()}
      onClick={toggleLang}
      aria-label={isHindi ? "Switch to English" : "हिन्दी में बदलें"}
      title={isHindi ? "Switch to English" : "हिन्दी में बदलें"}
    >
      <span className={`lang-opt ${!isHindi ? "active" : ""}`}>EN</span>
      <span className="lang-sep">|</span>
      <span className={`lang-opt ${isHindi ? "active" : ""}`}>हिन्दी</span>
    </button>
  );
}

/* One control, rendered twice (inside the mobile nav and beside it on desktop). */
function AccountLink({ className = "" }) {
  const s = useSession();
  const dealer = isDealer(s) ? (dealerById(s.dealerId) || s.dealer) : null;

  if (dealer) {
    return (
      <Link className={`acct ${className}`.trim()} to="/login" title="Active Dealer: ownershop (8826) · Click to switch">
        <span className="acct-dot" aria-hidden="true">
          {dealer.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b>{dealer.name}</b>
          <span style={{ color: "#16a34a", fontWeight: 700 }}>● Dealer (8826)</span>
        </span>
      </Link>
    );
  }

  return (
    <Link className={`acct ${className}`.trim()} to="/login" title="Customer View · Click to switch to Dealer">
      <span className="acct-dot" style={{ background: "var(--tx-3, #64748b)" }} aria-hidden="true">
        C
      </span>
      <span>
        <b>Customer View</b>
        <span style={{ color: "var(--tx-2, #475569)" }}>MRP · Switch</span>
      </span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const s = useSession();
  const { t } = useLanguage();
  const { pathname, hash } = useLocation();
  const isGated = isPortalGated(s);
  const { count: favCount } = useFavorites();
  const dealer = isDealer(s) ? (dealerById(s.dealerId) || s.dealer) : null;

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  const navLabels = {
    "/": t("nav_home"),
    "/products": t("nav_products"),
    "/favorites": t("nav_favorites") || "Favorites",
    "/schemes": t("nav_schemes"),
    "/support": t("nav_support"),
  };

  const navItems = isGated
    ? NAV.filter((n) => n.to === "/" || n.to === "/support")
    : NAV;

  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Mark />

        <nav className={`nav${open ? " open" : ""}`} id="nav">
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              {navLabels[n.to] || n.label}
              {n.to === "/favorites" && favCount > 0 && (
                <span className="nav-fav-count">{favCount}</span>
              )}
            </NavLink>
          ))}
          <div className="nav-drawer-actions">
            <LangToggle />
            <AccountLink />
          </div>
        </nav>

        {!isGated && (
          <p className="hdr-tag">
            {t("tagline_1")}
            <br />
            {t("tagline_2")}
            <br />
            {t("tagline_3")}
          </p>
        )}

        <div className="hdr-actions" style={isGated ? { marginLeft: "auto" } : undefined}>
          {!isGated && (
            <Link
              to="/favorites"
              className="hdr-fav-btn"
              aria-label={`Favorites (${favCount})`}
              title="Saved Favorites"
            >
              <Icon name="heart" size={18} />
              {favCount > 0 && <span className="hdr-fav-count">{favCount}</span>}
            </Link>
          )}
          <LangToggle />
          <AccountLink />
        </div>

        <div className="hdr-mobile-right">
          <Link
            to="/login"
            className="hdr-profile-avatar-btn"
            aria-label={dealer ? `Dealer ${dealer.name}` : "Account"}
            title={dealer ? `Dealer: ${dealer.name}` : "Account Login"}
          >
            {dealer ? (
              <span className="hdr-avatar-letter">{dealer.name.slice(0, 1).toUpperCase()}</span>
            ) : (
              <Icon name="user" size={18} />
            )}
            {dealer && <span className="hdr-verified-badge">✓</span>}
          </Link>

          <button
            className="icon-btn burger"
            aria-expanded={open}
            aria-controls="nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? "close" : "menu"} size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useLanguage();
  const s = useSession();
  const isGated = isPortalGated(s);

  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <Mark />
            <p style={{ marginTop: "var(--s4)", fontSize: "0.9rem", maxWidth: "30ch" }}>{t("ftr_about")}</p>
          </div>
          {!isGated ? (
            <div>
              <h4>{t("ftr_range")}</h4>
              <ul>
                <li>
                  <Link to="/products?cat=gas_stoves">{t("cat_gas_stoves")}</Link>
                </li>
                <li>
                  <Link to="/products?cat=hobs">{t("cat_hobs")}</Link>
                </li>
                <li>
                  <Link to="/products?cat=hob_tops">{t("cat_hob_tops")}</Link>
                </li>
                <li>
                  <Link to="/products?cat=chimneys">{t("cat_chimneys")}</Link>
                </li>
                <li>
                  <Link to="/products?cat=small_appliances">{t("cat_small_appliances")}</Link>
                </li>
              </ul>
            </div>
          ) : (
            <div>
              <h4>{t("quick_products") || "Quick Links"}</h4>
              <ul>
                <li>
                  <Link to="/">{t("nav_home") || "Home"}</Link>
                </li>
                <li>
                  <Link to="/support">{t("support_title") || "Customer Support"}</Link>
                </li>
                <li>
                  <Link to="/support#marketing">{t("mat_title") || "Marketing Material"}</Link>
                </li>
              </ul>
            </div>
          )}
          <div>
            <h4>{t("ftr_dealers")}</h4>
            <ul>
              {!isGated && (
                <li>
                  <Link to="/schemes">{t("nav_schemes")}</Link>
                </li>
              )}
              <li>
                <Link to="/support#marketing">{t("mat_title")}</Link>
              </li>
              <li>
                <Link to="/support">{t("support_title")}</Link>
              </li>
              {isGated && (
                <>
                  <li>
                    <Link to="/login">Verified Dealer Login</Link>
                  </li>
                  <li>
                    <Link to="/login?tab=apply">Apply for Dealership</Link>
                  </li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h4>{t("ftr_contact")}</h4>
            <ul>
              <li>
                <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>{COMPANY.phone}</a>
              </li>
              <li>
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </li>
              <li>{COMPANY.address}</li>
            </ul>
          </div>
        </div>
        <div className="ftr-base">
          <span>
            © {new Date().getFullYear()} {COMPANY.legal}
          </span>
          <div style={{ display: "flex", gap: "var(--s3)", alignItems: "center", flexWrap: "wrap" }}>
            <Link to="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</Link>
            <span>·</span>
            <Link to="/terms" style={{ color: "inherit", textDecoration: "underline" }}>Terms of Service</Link>
            <span>·</span>
            <Link to="/admin" style={{ color: "inherit", textDecoration: "underline" }}>Content CMS</Link>
            <span>·</span>
            <span>{t("ftr_auth_dist")} · Sunshine India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function EnquiryButtons({ model, block = false }) {
  const msg = encodeURIComponent(
    model ? `Hello Shriji Domestic, I would like details on the ${model}.` : "Hello Shriji Domestic, I would like details on the Sunshine range.",
  );
  return (
    <div className="row" style={{ gap: "var(--s3)" }}>
      <a
        className={`btn btn-navy${block ? " btn-block" : ""}`}
        href={`https://wa.me/${COMPANY.phoneRaw}?text=${msg}`}
        target="_blank"
        rel="noreferrer"
      >
        <Icon name="wa" /> Enquire Now
      </a>
      <a className="btn btn-ghost" href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>
        <Icon name="phone" /> Call
      </a>
    </div>
  );
}
