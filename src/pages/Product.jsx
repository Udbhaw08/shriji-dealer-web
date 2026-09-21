import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useProducts } from "../data/productsStore";
import { COMPANY } from "../data/site";
import { registerDealer, shareLink, tagFor, viewerFor } from "../data/dealer";
import { useSession } from "../data/session";
import { Icon } from "../ui";
import ProductCard from "../components/ProductCard";
import PriceBlock from "../components/PriceBlock";

/* Feature boxes mirror the mockup: icon over a two-line label. */
function featureBoxes(p) {
  const out = [];
  if (p.burners) out.push({ icon: "flame", label: `${p.burners} Brass\nBurners` });
  if (p.features.includes("Auto Ignition")) out.push({ icon: "bolt", label: "Auto\nIgnition" });
  if (p.fkey === "glass") out.push({ icon: "glass", label: "Toughened\nGlass" });
  if (p.fkey === "steel" || p.fkey === "alloy") out.push({ icon: "steel", label: "Stainless\nSteel Body" });
  if (p.features.includes("BLDC Motor")) out.push({ icon: "bolt", label: "BLDC\nMotor" });
  if (p.features.includes("Spill Proof")) out.push({ icon: "shield", label: "Spill\nProof" });
  if (p.features.includes("Flame Failure Device")) out.push({ icon: "shield", label: "Flame Failure\nDevice" });
  out.push({ icon: "shield", label: "Sunshine\nWarranty" });
  return out.slice(0, 4);
}

function inTheBox(p) {
  const box = [`${p.model} unit`, "User manual", "Warranty card"];
  if (p.burners) box.push("Pan supports", "Burner caps");
  if (p.cat === "chimneys") box.push("Mounting kit", "Duct pipe");
  if (p.cat === "hobs" || p.cat === "hob_tops") box.push("Cut-out template", "Fixing clamps");
  return box;
}

const TABS = ["Overview", "Specifications", "In The Box", "Marketing Material", "Videos"];

export default function Product() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession();
  const { products: PRODUCTS, loaded } = useProducts();
  const [fetchedProduct, setFetchedProduct] = useState(null);

  useEffect(() => {
    if (id) {
      fetch(`/api/products/${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.product) setFetchedProduct(data.product);
        })
        .catch(() => {});
    }
  }, [id]);

  const p = useMemo(() => {
    return fetchedProduct || PRODUCTS.find((x) => x.id === id) || null;
  }, [fetchedProduct, PRODUCTS, id]);

  const [shot, setShot] = useState(0);
  const [shotError, setShotError] = useState(false);
  const [tab, setTab] = useState(TABS[0]);
  const [copied, setCopied] = useState(false);

  // A ?from= link is a customer link, full stop. Whoever opens it — including the
  // dealer who sent it — gets the customer view and no way to reach a dealer price.
  const fromId = params.get("from");
  const { sharedBy: localSharedBy, me, customerView: viewerCustomerView } = viewerFor(session, fromId);
  const [remoteSharedBy, setRemoteSharedBy] = useState(null);

  useEffect(() => {
    if (fromId && !localSharedBy && !remoteSharedBy) {
      fetch(`/api/dealer/info?id=${encodeURIComponent(fromId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.dealer) {
            registerDealer(data.dealer);
            setRemoteSharedBy(data.dealer);
          }
        })
        .catch(() => {});
    }
  }, [fromId, localSharedBy, remoteSharedBy]);

  const sharedBy = localSharedBy || remoteSharedBy;
  const customerView = Boolean(fromId) || viewerCustomerView;

  const related = useMemo(
    () => (p ? PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id && x.img).slice(0, 4) : []),
    [p, PRODUCTS],
  );

  // the mockup shows a thumbnail strip; we build it from the sibling shots on file
  const shots = useMemo(() => {
    if (!p) return [];
    if (p.images && p.images.length > 0) return p.images;
    const others = PRODUCTS.filter((x) => x.cat === p.cat && x.img && x.img !== p.img)
      .map((x) => x.img)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    return [p.img, ...others].filter(Boolean);
  }, [p, PRODUCTS]);

  if (!p) {
    if (!loaded) {
      return (
        <section className="sec" style={{ paddingTop: "var(--s8)" }}>
          <div className="wrap empty" style={{ minHeight: "320px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
              <Icon name="bolt" size={24} style={{ animation: "spin 1s linear infinite" }} />
            </span>
            <h2 className="h3">Loading product from Zoho…</h2>
            <p className="muted">Fetching real-time product details and live dealer pricing.</p>
          </div>
        </section>
      );
    }
    return (
      <section className="sec">
        <div className="wrap empty">
          <h1 className="h3">This page is not available</h1>
          <p className="muted">The link may be out of date. Open the catalogue and search by model name.</p>
          <Link className="btn btn-navy" style={{ marginTop: "var(--s5)" }} to="/products">
            Browse products
          </Link>
        </div>
      </section>
    );
  }

  const tag = tagFor(p);

  const displayTitle = p?.model && p.model.toLowerCase() !== "test" ? p.model : (p?.name || "");

  const specs = [
    ["Model", displayTitle],
    ["Full catalogue name", p.name],
    ["Category", p.catLabel],
    p.size && ["Size", p.size],
    ["Finish", p.finish],
    ["Brand", p.brand],
    p.features.length && ["Features", p.features.join(", ")],
    ["Product code", `${p.code}-${p.id.slice(-6)}`],
  ].filter(Boolean);

  const overview = `The Sunshine ${displayTitle} combines ${p.finish.toLowerCase()} construction with ${
    p.features.length ? p.features.join(" and ").toLowerCase() : "everyday reliability"
  }, making it a dependable choice for the modern Indian kitchen.`;

  const share = () => {
    const url = shareLink(p, me);
    const data = {
      title: p.name,
      text: `${displayTitle} — ${p.catLabel} from ${COMPANY.brand}.`,
      url,
    };
    if (navigator.share) {
      navigator.share(data).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const backToDealerView = () => {
    const next = new URLSearchParams(params);
    next.delete("from");
    setParams(next, { replace: true });
  };

  return (
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <Icon name="chev" size={13} />
          <Link to={`/products?cat=${p.cat}`}>{p.catLabel}</Link>
          <Icon name="chev" size={13} />
          <span>{displayTitle}</span>
        </nav>

        <div className="detail">
          {/* ---- gallery ---- */}
          <div className="gallery">
            <div className="gallery-main">
              {shots.length && !shotError ? (
                <img
                  src={shots[shot]?.startsWith("http") ? shots[shot] : `/img/${shots[shot]}`}
                  alt={`${p.name}, view ${shot + 1}`}
                  onError={() => setShotError(true)}
                />
              ) : (
                <Icon name={p.cat === "chimneys" ? "chimney" : p.cat === "small_appliances" ? "blender" : "stove"} size={90} style={{ color: "var(--tx-3)" }} />
              )}
              {tag && <span className={`badge badge-${tag.kind === "blue" ? "blue" : ""} prod-tag`}>{tag.label}</span>}
            </div>

            {shots.length > 1 && (
              <>
                <div className="dots">
                  {shots.map((s, i) => (
                    <button
                      key={s}
                      className="dot"
                      aria-current={i === shot}
                      aria-label={`View ${i + 1}`}
                      onClick={() => {
                        setShot(i);
                        setShotError(false);
                      }}
                    />
                  ))}
                </div>
                <div className="thumbs">
                  {shots.map((s, i) => (
                    <button
                      key={s}
                      className="thumb"
                      aria-pressed={i === shot}
                      onClick={() => {
                        setShot(i);
                        setShotError(false);
                      }}
                    >
                      <img
                        src={s?.startsWith("http") ? s : `/img/${s}`}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ---- info ---- */}
          <div>
            <h1 className="d2">{displayTitle}</h1>
            <p className="muted" style={{ marginTop: 6, fontWeight: 600 }}>
              {[p.size, p.features[0], p.catLabel].filter(Boolean).join(" · ")}
            </p>

            <div className="feats">
              {featureBoxes(p).map((f) => (
                <div className="feat" key={f.label}>
                  <Icon name={f.icon} size={20} />
                  <span style={{ whiteSpace: "pre-line" }}>{f.label}</span>
                </div>
              ))}
            </div>

            <PriceBlock p={p} customerView={customerView} dealer={me} sharedBy={sharedBy} />

            {!customerView && (
              <>
                <div className="actions">
                  <button className="btn btn-ghost" onClick={share}>
                    <Icon name="share" /> {copied ? "Link copied" : "Share with Customer"}
                  </button>
                  <Link className="btn btn-ghost" to="/schemes">
                    <Icon name="tag" /> Current Scheme · 5 + 1
                  </Link>
                </div>
                <p className="note" style={{ marginTop: "var(--s3)" }}>
                  The link you share opens the customer view — MRP only, with your shop named on it.
                </p>
              </>
            )}

            {sharedBy && me && (
              <div className="viewnote">
                <Icon name="eyeoff" size={16} />
                <span>
                  This is the customer view of a link from <b>{sharedBy.name}</b>.
                </span>
                {sharedBy.id === me.id && (
                  <button className="link" onClick={backToDealerView}>
                    Back to dealer view
                  </button>
                )}
              </div>
            )}

            {customerView && !sharedBy && !me && session.role === "guest" && (
              <p className="note" style={{ marginTop: "var(--s3)" }}>
                Are you a Sunshine retailer?{" "}
                <Link className="link" to="/login">
                  Sign in for dealer pricing
                </Link>
                .
              </p>
            )}

            <div className="utabs" role="tablist">
              {TABS.map((t) => (
                <button key={t} className="utab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>

            <div className="overview" role="tabpanel">
              {tab === "Overview" && (
                <>
                  <h3>Engineered for Everyday Excellence</h3>
                  <p className="muted" style={{ fontSize: "0.93rem" }}>
                    {overview}
                  </p>
                </>
              )}

              {tab === "Specifications" && (
                <>
                  <h3>Specification</h3>
                  <table className="spec">
                    <tbody>
                      {specs.map(([k, v]) => (
                        <tr key={k}>
                          <th scope="row">{k}</th>
                          <td>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="note" style={{ marginTop: "var(--s4)" }}>
                    Specifications are drawn from the live {COMPANY.brand} catalogue.
                  </p>
                </>
              )}

              {tab === "In The Box" && (
                <>
                  <h3>In The Box</h3>
                  <ul className="bullets">
                    {inTheBox(p).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </>
              )}

              {(tab === "Marketing Material" || tab === "Videos") && (
                <>
                  <h3>{tab}</h3>
                  <p className="muted" style={{ fontSize: "0.93rem" }}>
                    No {tab.toLowerCase()} uploaded for the {p.model} yet.
                  </p>
                  <Link className="btn btn-ghost btn-sm" to="/support#marketing" style={{ marginTop: "var(--s4)" }}>
                    <Icon name="image" size={16} /> Browse all material
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* related sits below the whole detail block, so it never jumps above the
            info column when the grid collapses to one column on a phone */}
        {related.length > 0 && (
          <div style={{ marginTop: "var(--s7)" }}>
            <div className="sec-head">
              <h2>More in {p.catLabel}</h2>
              <Link className="link" to={`/products?cat=${p.cat}`}>
                View All <Icon name="arrowsm" size={15} />
              </Link>
            </div>
            <div className="prods">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
