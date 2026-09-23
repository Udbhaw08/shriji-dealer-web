import { useState } from "react";
import { useLanguage } from "../data/i18n";
import { SCHEMES } from "../data/site";
import { Icon } from "../ui";

export default function Schemes() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("active"); // "active" | "upcoming" | "past"
  const [activeFlyer, setActiveFlyer] = useState(null); // scheme object for modal
  const [toastMsg, setToastMsg] = useState("");

  const handleDownload = (scheme) => {
    setToastMsg(`📥 Downloading ${scheme.pdfName}...`);
    setTimeout(() => setToastMsg(""), 3500);

    // Trigger mock/real file download
    const link = document.createElement("a");
    link.href = scheme.pdfUrl || scheme.flyer;
    link.download = scheme.pdfName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="download-toast" role="status">
          <Icon name="check" size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <h1 className="d2">{t("schemes_title")}</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {t("schemes_sub")}
          </p>

          {/* Segmented Pill Tabs */}
          <div className="tabs" role="tablist" style={{ marginTop: "var(--s4)", display: "inline-flex" }}>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "active"}
              onClick={() => setActiveTab("active")}
            >
              {t("scheme_tab_active")} ({SCHEMES.active.length})
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "upcoming"}
              onClick={() => setActiveTab("upcoming")}
            >
              {t("scheme_tab_upcoming")} (0)
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "past"}
              onClick={() => setActiveTab("past")}
            >
              {t("scheme_tab_past")} (0)
            </button>
          </div>
        </div>
      </section>

      {/* Schemes Grid */}
      <section className="sec" style={{ paddingTop: "var(--s4)" }}>
        <div className="wrap">
          {activeTab === "active" ? (
            <div className="schemes-grid">
              {SCHEMES.active.map((s) => {
                const isDiwali = s.id.includes("diwali");
                return (
                  <article key={s.id} className="scheme-card">
                    {/* Header Banner - Title per image */}
                    <div className={`scheme-card-header ${isDiwali ? "diwali" : "annual"}`}>
                      <span className="badge badge-blue">{s.badge}</span>
                      <h2 className="scheme-card-title">{s.title}</h2>
                      <span className="scheme-card-when">{s.when}</span>
                      <p className="scheme-card-tagline">{s.tagline}</p>
                    </div>

                    {/* Body: Poster thumbnail + brief summary without details */}
                    <div className="scheme-card-body">
                      <img
                        src={s.flyer}
                        alt={`${s.title} official flyer`}
                        className="scheme-poster-thumb"
                        onClick={() => setActiveFlyer(s)}
                        title="Click to view full scheme flyer"
                      />
                      <div className="scheme-card-meta">
                        <p>{s.blurb}</p>
                        <p style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--tx-3)" }}>
                          Official flyer available in high-resolution PDF format.
                        </p>
                      </div>
                    </div>

                    {/* Actions: Download Scheme PDF as mock */}
                    <div className="scheme-card-actions">
                      <button
                        type="button"
                        className="btn btn-navy btn-block"
                        onClick={() => handleDownload(s)}
                      >
                        <Icon name="download" size={17} /> {t("scheme_download_pdf")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-block btn-sm"
                        onClick={() => setActiveFlyer(s)}
                      >
                        <Icon name="doc" size={16} /> View Scheme Flyer
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="card pad" style={{ textAlign: "center", padding: "var(--s6) var(--s4)" }}>
              <span className="tile tile-lg" style={{ margin: "0 auto var(--s3)" }}>
                <Icon name="badge" size={26} />
              </span>
              <h3>{activeTab === "upcoming" ? "No Upcoming Schemes Announced Yet" : "No Archived Past Schemes"}</h3>
              <p className="sub" style={{ marginTop: "var(--s2)", maxWidth: "45ch", marginInline: "auto" }}>
                All live dealer schemes are currently active. Please switch to the Active tab to view and download available scheme PDFs.
              </p>
              <button
                type="button"
                className="btn btn-navy"
                style={{ marginTop: "var(--s4)" }}
                onClick={() => setActiveTab("active")}
              >
                View Active Schemes (2)
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Modal for Scheme Flyer */}
      {activeFlyer && (
        <div
          className="flyer-modal-backdrop"
          onClick={() => setActiveFlyer(null)}
          role="dialog"
          aria-modal="true"
          aria-label={activeFlyer.title}
        >
          <div className="flyer-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="flyer-modal-head">
              <div>
                <h3 style={{ fontSize: "1.1rem", margin: 0 }}>{activeFlyer.title}</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--tx-3)" }}>{activeFlyer.when}</span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setActiveFlyer(null)}
                aria-label="Close flyer preview"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <img
              src={activeFlyer.flyer}
              alt={activeFlyer.title}
              className="flyer-modal-img"
            />

            <div className="flyer-modal-foot">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setActiveFlyer(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-navy btn-sm"
                onClick={() => handleDownload(activeFlyer)}
              >
                <Icon name="download" size={16} /> Download Scheme PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
