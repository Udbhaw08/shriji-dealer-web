import { useState } from "react";
import { Link } from "react-router-dom";
import { SCHEMES, COMPANY } from "../data/site";
import { isDealer, useSession } from "../data/session";
import { useProducts } from "../data/productsStore";
import { useLanguage } from "../data/i18n";
import { Icon } from "../ui";

export default function Schemes() {
  const session = useSession();
  const dealer = isDealer(session);
  const { categories: CATEGORIES } = useProducts();
  const { t, tCat } = useLanguage();
  const [tab, setTab] = useState("active");
  const list = SCHEMES[tab] || [];

  const TABS = [
    { key: "active", label: t("scheme_tab_active") },
    { key: "upcoming", label: t("scheme_tab_upcoming") },
    { key: "past", label: t("scheme_tab_past") },
  ];

  return (
    <>
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <h1 className="d2">{t("schemes_title")}</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {t("schemes_sub")}
          </p>

          <div className="tabs" role="tablist" aria-label="Scheme status" style={{ marginTop: "var(--s5)" }}>
            {TABS.map((tItem) => (
              <button
                key={tItem.key}
                className="tab"
                role="tab"
                aria-selected={tab === tItem.key}
                onClick={() => setTab(tItem.key)}
              >
                {tItem.label}
                {SCHEMES[tItem.key]?.length ? ` (${SCHEMES[tItem.key].length})` : ""}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          {list.length === 0 ? (
            <div className="empty">
              <span className="tile tile-lg" style={{ margin: "0 auto var(--s4)" }}>
                <Icon name="tag" size={24} />
              </span>
              <h3 className="h3">{t("scheme_empty_title")}</h3>
              <p className="muted">{t("scheme_empty_sub")}</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: "var(--s5)" }}>
              {list.map((s) => (
                <article className="card" key={s.id} style={{ overflow: "hidden" }}>
                  <div className="scheme" style={{ borderRadius: 0, border: 0, borderBottom: "1px solid var(--line)" }}>
                    <div className="scheme-txt">
                      <span className={`badge${tab === "upcoming" ? " badge-warn" : tab === "past" ? " badge-blue" : ""}`}>
                        {tab === "active" ? t("scheme_live_now") : tab === "upcoming" ? t("scheme_coming_soon") : t("scheme_closed")}
                      </span>
                      <h3 style={{ marginTop: "var(--s3)" }}>{s.title}</h3>
                      <p className="when">{s.when}</p>
                      <p>{s.blurb}</p>
                    </div>
                    <span className="fab" aria-hidden="true">
                      <Icon name="arrowsm" size={17} />
                    </span>
                  </div>

                  <div>
                    {s.items.map((it) => (
                      <div className="pricerow" key={it.name}>
                        <b>{it.name}</b>
                        <span className="amt">{it.price}</span>
                        <Icon name="chev" size={15} style={{ color: "var(--tx-3)" }} />
                      </div>
                    ))}
                  </div>

                  <div className="pad">
                    <h4 style={{ fontSize: "0.98rem" }}>{t("scheme_details_title")}</h4>
                    <ul className="bullets">
                      {s.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    <button className="btn btn-navy btn-block" style={{ marginTop: "var(--s5)" }}>
                      <Icon name="download" /> {t("scheme_download_pdf")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <p className="note" style={{ marginTop: "var(--s5)" }}>
            Scheme content shown here is sample data for this demo build. Live schemes appear once the dealer account is
            connected.
          </p>
        </div>
      </section>

      {/* ---------- Price lists ---------- */}
      <section className="sec" id="pricing" style={{ paddingTop: 0, scrollMarginTop: 90 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2>{t("price_lists_title")}</h2>
            <span className="note">{t("price_lists_sub")}</span>
          </div>
          {dealer ? (
            <div className="list">
              {CATEGORIES.map((c) => (
                <div className="list-row" key={c.key}>
                  <span className="tile tile-sm">
                    <Icon name="doc" size={18} />
                  </span>
                  <span className="txt">
                    <b>{tCat(c.key, c.label)} {t("price_lists_title")}</b>
                    <span>{t("price_list_format")}</span>
                  </span>
                  <button className="btn btn-ghost btn-sm">
                    <Icon name="download" size={15} /> {t("price_list_download")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="card pad" style={{ display: "grid", gap: "var(--s3)" }}>
              <span className="tile tile-lg">
                <Icon name="lock" size={22} />
              </span>
              <h3 className="h3" style={{ fontSize: "1.05rem" }}>
                {t("price_lists_dealer_only")}
              </h3>
              <p className="muted" style={{ fontSize: "0.94rem" }}>
                {session.role === "dealer"
                  ? `Your application is with ${COMPANY.legal}. Price lists unlock the moment it is approved.`
                  : t("price_lists_dealer_sub")}
              </p>
              <div className="row">
                <Link className="btn btn-navy" to="/login">
                  {session.role === "dealer" ? "Check application" : t("dealer_login")} <Icon name="arrowsm" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
