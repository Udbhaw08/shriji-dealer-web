import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { tagFor } from "../data/dealer";

/* No price here by design — dealer pricing lives on the product detail page behind View Dealer Price. */
export default function ProductCard({ p }) {
  const [saved, setSaved] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const tag = tagFor(p);

  return (
    <article className="prod">
      <button
        className="heart"
        aria-pressed={saved}
        aria-label={saved ? `Remove ${p.model} from saved` : `Save ${p.model}`}
        onClick={() => setSaved((v) => !v)}
      >
        <Icon name="heart" size={16} />
      </button>

      <Link to={`/products/${p.id}`} className="prod-link">
        <span className="prod-img">
          {p.img && !imgErr ? (
            <img
              src={p.img.startsWith("http") ? p.img : `/img/${p.img}`}
              alt={p.name}
              loading="lazy"
              onError={() => setImgErr(true)}
            />
          ) : (
            <span className="prod-fallback">
              <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={28} />
            </span>
          )}
          {tag && <span className={`badge badge-${tag.kind === "blue" ? "blue" : ""} prod-tag`}>{tag.label}</span>}
        </span>
        <span className="prod-foot">
          <b>{p.model}</b>
          <span>{[p.size, p.features[0] || p.finish, p.catLabel].filter(Boolean).join(" · ")}</span>
        </span>
      </Link>
    </article>
  );
}
