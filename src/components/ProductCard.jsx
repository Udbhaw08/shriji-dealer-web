import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { inr, priceFor, tagFor, productSlug } from "../data/dealer";
import { useLanguage } from "../data/i18n";

export default function ProductCard({ p }) {
  const [saved, setSaved] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const { t } = useLanguage();

  const tag = tagFor(p);
  const { mrp, isPriceOnRequest } = priceFor(p);

  const subtitle =
    p.name && p.model && p.name.trim().toLowerCase() !== p.model.trim().toLowerCase()
      ? p.name
      : [p.features?.[0] || p.finish, p.catLabel].filter(Boolean).join(" ");

  const badges = [];
  if (tag) badges.push(tag);
  if (p.isNew && (!tag || tag.label !== "New")) {
    badges.push({ label: "New", kind: "blue" });
  }

  return (
    <article className="prod">
      <button
        type="button"
        className="heart"
        aria-pressed={saved}
        aria-label={saved ? `Remove ${p.model} from saved` : `Save ${p.model}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSaved((v) => !v);
        }}
      >
        <Icon name="heart" size={16} />
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
              <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={28} />
            </span>
          )}
        </span>

        <span className="prod-foot">
          <b className="prod-title">{p.model && p.model.toLowerCase() !== "test" ? p.model : p.name}</b>
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
              <span className="prod-price-lbl mrp-lbl">{t("price_mrp_label") || "MRP"}</span>
              <b className="prod-price-val">
                {isPriceOnRequest || mrp <= 0 ? t("price_on_request") : inr(mrp)}
              </b>
            </span>
            {mrp > 0 && !isPriceOnRequest && (
              <small className="prod-tax-sub">{t("price_incl_taxes") || "Incl. of all taxes"}</small>
            )}
          </span>
        </span>
      </Link>
    </article>
  );
}
