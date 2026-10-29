import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { inr, priceFor, productSlug } from "../data/dealer";
import { useLanguage } from "../data/i18n";
import { useFavorites } from "../data/favoritesStore";

export default function ProductCard({ p }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(p.id);
  const [imgErr, setImgErr] = useState(false);
  const { t } = useLanguage();

  const { mrp, isPriceOnRequest } = priceFor(p);

  const subtitle =
    p.zohoTitle && p.name && p.zohoTitle.trim().toLowerCase() !== p.name.trim().toLowerCase()
      ? p.zohoTitle
      : [p.features?.[0] || p.finish, p.catLabel].filter(Boolean).join(" ");

  // Tag badge on image from live Zoho Commerce "tags" field (e.g. 'HOT SELLING', 'NEW', 'BESTSELLER')
  const productTags = (Array.isArray(p.tags) && p.tags.length > 0
    ? p.tags
    : (p.tag ? [p.tag] : []))
    .map((t) => (typeof t === "string" ? t : (t?.tag_name || t?.name || "")).trim())
    .filter(Boolean);

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
          {/* Tag badge(s) from Zoho Commerce in top-left of image area */}
          {productTags.length > 0 && (
            <div className="prod-tags-group" style={{ position: "absolute", top: "10px", left: "10px", display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "80%", zIndex: 1 }}>
              {productTags.slice(0, 2).map((tVal, idx) => (
                <span key={idx} className="badge badge-blue prod-tag">
                  {tVal}
                </span>
              ))}
              {productTags.length > 2 && (
                <span className="badge badge-blue prod-tag" style={{ opacity: 0.9 }}>
                  +{productTags.length - 2}
                </span>
              )}
            </div>
          )}
        </span>

        <span className="prod-foot">
          <b className="prod-title">{p.name || p.model}</b>
          {subtitle && <span className="prod-subtitle">{subtitle}</span>}

          <span className="prod-price-block">
            <span className="prod-price-row">
              <span className="prod-price-lbl mrp-lbl">{t("price_mrp_label") || "Retail MRP"}</span>
              <b className="prod-price-val">
                  {isPriceOnRequest || mrp <= 0 ? t("price_on_request") || "Price on Request" : inr(mrp)}
                </b>
            </span>
          </span>
        </span>
      </Link>
    </article>
  );
}
