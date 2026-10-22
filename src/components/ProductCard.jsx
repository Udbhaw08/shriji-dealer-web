import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { inr, priceFor, tagFor, productSlug } from "../data/dealer";
import { useLanguage } from "../data/i18n";
import { useFavorites } from "../data/favoritesStore";
import { useSession, isDealer } from "../data/session";

export default function ProductCard({ p }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(p.id);
  const [imgErr, setImgErr] = useState(false);
  const { t } = useLanguage();
  const session = useSession();
  const isDealerUser = isDealer(session) && session?.canSeeDealerPrice !== false;

  const tag = tagFor(p);
  const { mrp, dealer, isPriceOnRequest } = priceFor(p);

  const subtitle =
    p.zohoTitle && p.name && p.zohoTitle.trim().toLowerCase() !== p.name.trim().toLowerCase()
      ? p.zohoTitle
      : [p.features?.[0] || p.finish, p.catLabel].filter(Boolean).join(" ");

  const badges = [];
  if (tag) badges.push(tag);
  if (p.isNew && (!tag || tag.label !== "New")) {
    badges.push({ label: "New", kind: "blue" });
  }

  const categoryChip = p.brand?.toUpperCase() || (p.cat === "small_appliances" ? "KUCHENBAU" : (p.catLabel || "APPLIANCE").toUpperCase());

  return (
    <article className="prod">
      {/* Elevated Floating Heart Button (Top-Right) */}
      <button
        type="button"
        className="heart"
        aria-pressed={saved}
        aria-label={saved ? `Remove ${p.model || p.name} from saved favorites` : `Save ${p.model || p.name} to favorites`}
        title={saved ? "Remove from favorites" : "Save to favorites"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(p.id);
        }}
      >
        <Icon name="heart" size={17} />
      </button>

      <Link to={`/products/${p.slug || productSlug(p) || p.id}`} className="prod-link">
        <span className="prod-img">
          {p.img && !imgErr ? (
            <img
              src={p.img.startsWith("http") ? p.img : `/img/${p.img}`}
              alt={p.name}
              loading="lazy"
              draggable="false"
              onError={() => setImgErr(true)}
            />
          ) : (
            <span className="prod-fallback">
              <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={32} />
            </span>
          )}
          {/* Category Chip in lower-left of image area */}
          <span className="prod-cat-badge">
            {categoryChip}
          </span>
        </span>

        <span className="prod-foot">
          <b className="prod-title">{p.name || p.model}</b>
          {subtitle && <span className="prod-subtitle">{subtitle}</span>}

          {badges.length > 0 && (
            <span className="prod-badges-row">
              {badges.map((b, idx) => (
                <span key={idx} className={`badge badge-${b.kind === "blue" ? "blue" : b.kind === "ok" ? "ok" : "blue"}`}>
                  {b.label}
                </span>
              ))}
            </span>
          )}

          <span className="prod-price-block">
            <span className="prod-price-row">
              <span className="prod-price-lbl mrp-lbl">{t("price_mrp_label") || "Retail MRP"}</span>
              <div className="prod-mrp-group">
                <b className="prod-price-val">
                  {isPriceOnRequest || mrp <= 0 ? t("price_on_request") || "Price on Request" : inr(mrp)}
                </b>
                {!isPriceOnRequest && mrp > 0 && (
                  <span className="prod-tax-note">(Incl. taxes)</span>
                )}
              </div>
            </span>

            {/* Dealer Wholesale Action Button Pill */}
            {isDealerUser && dealer > 0 && !isPriceOnRequest ? (
              <span className="prod-dealer-action unlocked" aria-label="Dealer Wholesale Rate">
                <span className="prod-dealer-action-left">
                  <span className="dealer-verified-dot" />
                  <span className="dealer-rate-text">
                    Wholesale: <b>{inr(dealer)}</b> <small>+GST</small>
                  </span>
                </span>
                <Icon name="chev" size={12} />
              </span>
            ) : (
              <span className="prod-dealer-action" aria-label="View Dealer Price">
                <span className="prod-dealer-action-left">
                  <Icon name="lock" size={13} />
                  <span>{t("price_dealer_view") || "View Dealer Price"}</span>
                </span>
                <Icon name="chev" size={12} />
              </span>
            )}
          </span>
        </span>
      </Link>
    </article>
  );
}
