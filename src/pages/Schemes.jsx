import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../data/i18n";
import { COMPANY } from "../data/site";
import { apiFetch } from "../data/api";
import { Icon } from "../ui";

const SCHEMES_CACHE_KEY = "shriji_supabase_schemes_v3";

const getCachedSchemes = () => {
  try {
    const raw = sessionStorage.getItem(SCHEMES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.active) && parsed.active.length > 0) {
        const hasLegacy = parsed.active.some(
          (s) => s.id === "annual-business-scheme-2026-27" || s.id === "diwali-scheme-2026"
        );
        if (!hasLegacy) return parsed;
      }
    }
  } catch {}
  return { active: [], upcoming: [], past: [] };
};

export default function Schemes() {
  const { t } = useLanguage();
  const [schemesData, setSchemesData] = useState(getCachedSchemes);
  const [, setLoading] = useState(() => !schemesData.active?.length);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "upcoming" | "past"
  const [activeFlyer, setActiveFlyer] = useState(null); // scheme object for modal
  const [toastMsg, setToastMsg] = useState("");

  // Fetch dynamic schemes from Supabase via /api/schemes
  useEffect(() => {
    let active = true;
    apiFetch("/api/schemes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.schemes) {
          setSchemesData(data.schemes);
          try {
            sessionStorage.setItem(SCHEMES_CACHE_KEY, JSON.stringify(data.schemes));
          } catch {}
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("Failed to load live schemes:", err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeSchemes = schemesData.active || [];
  const upcomingSchemes = schemesData.upcoming || [];
  const pastSchemes = schemesData.past || [];

  const handleDownload = async (scheme) => {
    const rawUrl = scheme.pdfUrl || scheme.flyer;
    if (!rawUrl) return;

    let targetFilename = scheme.pdfName || `${scheme.title || "scheme"}.pdf`;
    if (!targetFilename.toLowerCase().endsWith(".pdf")) {
      targetFilename += ".pdf";
    }

    setToastMsg(`📥 Downloading ${targetFilename}...`);

    try {
      const downloadEndpoint = `/api/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(targetFilename)}`;
      const res = await fetch(downloadEndpoint);
      if (!res.ok) throw new Error(`Download status ${res.status}`);

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);

      setToastMsg(`✅ Download completed: ${targetFilename}`);
      setTimeout(() => setToastMsg(""), 3500);
    } catch (err) {
      console.warn("Direct blob download failed, triggering native browser attachment download:", err);
      const downloadEndpoint = `/api/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(targetFilename)}`;
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = downloadEndpoint;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 20000);
    }
  };

  const getWhatsAppLink = (scheme) => {
    const text =
      scheme.whatsappBooking ||
      scheme.metadata?.whatsapp_booking ||
      `Hi Shriji Team, I am interested in the "${scheme.title}" scheme (${scheme.badge || "Dealer Scheme"}). Please share booking details and eligible models.`;
    return `https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="schemes-page">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="download-toast" role="status">
          <Icon name="check" size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Hero & Breadcrumbs Section */}
      <section className="schemes-hero">
        <div className="wrap">
          <div className="schemes-hero-inner">
            <nav className="schemes-crumbs" aria-label="Breadcrumb">
              <Link to="/">{t("nav_home") || "Home"}</Link>
              <Icon name="chev" size={12} />
              <Link to="/products">{t("nav_products") || "Products"}</Link>
              <Icon name="chev" size={12} />
              <span className="schemes-crumbs-current">{t("schemes_title") || "Dealer Schemes & Incentives"}</span>
            </nav>

            <div className="support-hero-main">
              <div className="support-title-group">
                <div className="schemes-icon-badge" aria-hidden="true">
                  <Icon name="badge" size={28} />
                </div>
                <div>
                  <span className="schemes-eyebrow-pill">
                    <Icon name="sparkle" size={13} />
                    Official Dealer Benefits · FY 2026–27
                  </span>
                  <h1 className="support-title">{t("schemes_title") || "Trade Schemes & Incentives"}</h1>
                  <p className="support-sub">
                    {t("schemes_sub") ||
                      "Exclusive volume slab incentives, festive bonuses, and special turnover benefits directly connected with Zoho Commerce."}
                  </p>
                </div>
              </div>
            </div>

            {/* Segmented Pill Tabs */}
            <div className="scheme-segmented-tabs" role="tablist" style={{ marginTop: "1rem" }}>
              <button
                className={`scheme-seg-tab ${activeTab === "active" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "active"}
                onClick={() => setActiveTab("active")}
              >
                {t("scheme_tab_active") || "Active Offers"} ({activeSchemes.length})
              </button>
              <button
                className={`scheme-seg-tab ${activeTab === "upcoming" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "upcoming"}
                onClick={() => setActiveTab("upcoming")}
              >
                {t("scheme_tab_upcoming") || "Upcoming"} ({upcomingSchemes.length})
              </button>
              <button
                className={`scheme-seg-tab ${activeTab === "past" ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === "past"}
                onClick={() => setActiveTab("past")}
              >
                {t("scheme_tab_past") || "Archived"} ({pastSchemes.length})
              </button>
            </div>
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
                    {/* Header Banner */}
                    <div className={`scheme-card-header ${isDiwali ? "diwali" : "annual"}`}>
                      <div className="scheme-card-badge-row">
                        <span className="badge badge-blue">{s.badge}</span>
                        {s.daysLeft && (
                          <span className="scheme-countdown-pill">
                            <Icon name="clock" size={13} /> {s.daysLeft}
                          </span>
                        )}
                      </div>
                      <h2 className="scheme-card-title">{s.title}</h2>
                      <span className="scheme-card-when">{s.when}</span>
                      <p className="scheme-card-tagline">{s.tagline}</p>
                    </div>

                    {/* Body: Poster thumbnail + details */}
                    <div className="scheme-card-body">
                      <div className="scheme-flyer-thumb-wrap" onClick={() => setActiveFlyer(s)}>
                        <img
                          src={s.flyer}
                          alt={`${s.title} official flyer`}
                          className="scheme-poster-thumb"
                          title="Click to view full scheme flyer"
                        />
                        <div className="scheme-flyer-pdf-badge">
                          <Icon name="search" size={12} />
                          <span>PDF</span>
                        </div>
                      </div>

                      <div className="scheme-card-meta">
                        <p className="scheme-card-blurb">{s.blurb}</p>
                        <div className="scheme-badges-bar">
                          <span className="scheme-verified-pill">
                            <span className="scheme-verified-dot" />
                            Verified Dealer Scheme
                          </span>
                          {s.badge ? (
                            <span className="scheme-slab-pill">{s.badge}</span>
                          ) : (
                            <span className="scheme-slab-pill">Volume Target Slabs</span>
                          )}
                        </div>

                        {/* Structured Slabs */}
                        {Array.isArray(s.slabs) && s.slabs.length > 0 && (
                          <div
                            className="scheme-slabs-container"
                            style={{
                              marginTop: "12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            {s.slabs.map((slab, sIdx) => (
                              <div key={sIdx} className="scheme-slab-item">
                                <span className="scheme-slab-icon">🎯</span>
                                <span>{slab}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
                      <a
                        href={getWhatsAppLink(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-wa btn-block"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      >
                        <Icon name="chat" size={16} /> Enquire on WhatsApp
                      </a>
                      {s.videoUrl && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-block btn-sm"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                          onClick={() => setActiveVideo(s)}
                        >
                          <Icon name="play" size={15} /> Watch Scheme Video
                        </button>
                      )}
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
            <div className="card pad" style={{ textAlign: "center", padding: "var(--s6) var(--s4)", borderRadius: 20 }}>
              <span className="tile tile-lg" style={{ margin: "0 auto var(--s3)", width: 54, height: 54, borderRadius: 16 }}>
                <Icon name="badge" size={26} />
              </span>
              <h3 style={{ fontSize: "1.25rem", color: "var(--navy)" }}>
                {activeTab === "upcoming"
                  ? "No Upcoming Schemes Announced Yet"
                  : activeTab === "past"
                  ? "No Archived Past Schemes"
                  : "No Active Schemes Right Now"}
              </h3>
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

      {/* Persistent Scheme Desk Direct Contact Bar */}
      <aside className="scheme-desk-dock">
        <div className="wrap">
          <a
            className="scheme-desk-card"
            href={`tel:${COMPANY.phone.replace(/[^0-9+]/g, "")}`}
            aria-label="Call Scheme Desk Direct"
          >
            <div className="scheme-desk-left">
              <span className="scheme-desk-icon-wrap">
                <Icon name="phone" size={18} />
              </span>
              <div className="scheme-desk-info">
                <span className="scheme-desk-label">Scheme Desk Direct</span>
                <span className="scheme-desk-number">{COMPANY.phone}</span>
              </div>
            </div>
            <div className="scheme-desk-action-pill">
              <span>Call for Details</span>
              <Icon name="chev" size={14} />
            </div>
          </a>
        </div>
      </aside>

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
                <h3 style={{ fontSize: "1.1rem", margin: 0, color: "var(--navy)" }}>{activeFlyer.title}</h3>
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

      {/* Interactive Video Modal */}
      {activeVideo && (
        <div
          className="flyer-modal-backdrop"
          onClick={() => setActiveVideo(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${activeVideo.title} video`}
        >
          <div className="flyer-modal-box" style={{ maxWidth: "760px", width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <div className="flyer-modal-head">
              <div>
                <h3 style={{ fontSize: "1.1rem", margin: 0, color: "var(--navy)" }}>{activeVideo.title}</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--tx-3)" }}>
                  {activeVideo.driveVideo?.isDrive ? "Google Drive Video Presentation" : "Official Promotional Video"}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setActiveVideo(null)}
                aria-label="Close video"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#000", borderRadius: "var(--r2)", overflow: "hidden" }}>
              {activeVideo.driveVideo?.isDrive || activeVideo.videoUrl?.includes("drive.google.com") || activeVideo.videoUrl?.includes("youtube") || activeVideo.videoUrl?.includes("youtu.be") || activeVideo.videoUrl?.includes("vimeo") ? (
                <iframe
                  src={activeVideo.driveVideo?.previewUrl || activeVideo.videoUrl}
                  title={activeVideo.title}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                />
              ) : (
                <video
                  src={activeVideo.videoUrl}
                  controls
                  autoPlay
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>

            <div className="flyer-modal-foot" style={{ justifyContent: "space-between" }}>
              <a
                href={activeVideo.driveVideo?.original || activeVideo.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                <Icon name="arrow" size={15} /> Open in New Tab
              </a>
              <button
                type="button"
                className="btn btn-navy btn-sm"
                onClick={() => setActiveVideo(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
