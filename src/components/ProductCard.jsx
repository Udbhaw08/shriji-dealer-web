import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { inr, priceFor, tagFor } from "../data/dealer";
import { isDealer, useSession } from "../data/session";

export default function ProductCard({ p }) {
  const session = useSession();
  const dealerSession = isDealer(session) ? (session.dealer || session) : null;
  const [saved, setSaved] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const tag = tagFor(p);
  const price = dealerSession ? priceFor(p, dealerSession) : null;

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
          {price && (
            <span style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
              <b style={{ color: "var(--blue-700, #1d4ed8)", fontSize: "0.95rem" }}>
                {inr(price.dealer)}
              </b>
              <s style={{ color: "var(--tx-3)", fontSize: "0.8rem" }}>
                {inr(price.mrp)}
              </s>
              <span style={{ fontSize: "0.75rem", color: "var(--green-700, #15803d)", fontWeight: 600 }}>
                {price.rebatePct}% off
              </span>
            </span>
          )}
        </span>
      </Link>
    </article>
  );
}
