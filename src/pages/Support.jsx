import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import { COMPANY, ISSUE_TYPES } from "../data/site";
import { apiFetch } from "../data/api";

export default function Support() {
  const { t } = useLanguage();

  const [siteSettings, setSiteSettings] = useState(() => {
    try {
      const cached = sessionStorage.getItem("shriji_site_settings") || localStorage.getItem("shriji_site_settings");
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  useEffect(() => {
    let active = true;

    // Fetch live settings from /api/content?scope=settings
    apiFetch("/api/content?scope=settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.settings) {
          setSiteSettings(data.settings);
          try {
            sessionStorage.setItem("shriji_site_settings", JSON.stringify(data.settings));
            localStorage.setItem("shriji_site_settings", JSON.stringify(data.settings));
          } catch {}
        }
      })
      .catch(() => {});

    // Listen to local event when updated from Admin Dashboard
    const onSettingsUpdate = (e) => {
      if (e?.detail) setSiteSettings(e.detail);
    };
    window.addEventListener("shriji_settings_updated", onSettingsUpdate);

    // Cross-tab broadcast listener
    let channel = null;
    try {
      channel = new BroadcastChannel("shriji_settings_channel");
      channel.onmessage = (event) => {
        if (event?.data?.type === "settings_updated" && event.data.settings) {
          setSiteSettings(event.data.settings);
        }
      };
    } catch {}

    return () => {
      active = false;
      window.removeEventListener("shriji_settings_updated", onSettingsUpdate);
      if (channel) {
        try {
          channel.close();
        } catch {}
      }
    };
  }, []);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    issueType: ISSUE_TYPES[0] || "General enquiry",
    details: "",
  });

  const [toastMsg, setToastMsg] = useState("");
  const [ticketSent, setTicketSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleFieldChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      alert("Please provide your name and contact phone number.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const payload = {
        access_key: "29eb49b5-8801-4f50-bf17-bf018e3c6a8c",
        subject: `Support Request: ${form.name.trim()} (${form.issueType})`,
        from_name: form.name.trim(),
        name: form.name.trim(),
        email: form.email?.trim() || COMPANY.email || "support@shrijidomestic.com",
        phone: form.phone.trim(),
        issue_type: form.issueType,
        message: form.details.trim() || "Support request submitted via website.",
      };

      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTicketSent(true);
        setToastMsg("✅ Request sent successfully! We'll get back to you shortly.");
        setTimeout(() => setToastMsg(""), 5000);
      } else {
        const errorMsg = data?.message || "Unable to submit your request. Please try again.";
        setSubmitError(errorMsg);
        setToastMsg(`⚠️ ${errorMsg}`);
        setTimeout(() => setToastMsg(""), 5000);
      }
    } catch {
      const errorMsg = "Network error. Please check your internet connection or try again.";
      setSubmitError(errorMsg);
      setToastMsg(`⚠️ ${errorMsg}`);
      setTimeout(() => setToastMsg(""), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const catalogueUrl = (siteSettings?.catalogue_download_url ?? "/downloads/Sunshine-Range-Brochure-2026.pdf").trim();
  const catalogueTitle = siteSettings?.catalogue_title || "Looking for Product Catalogues?";
  const catalogueSubtitle = siteSettings?.catalogue_subtitle || "Download the official Sunshine 2026 range brochure (PDF)";
  const catalogueEnabled = siteSettings?.catalogue_enabled !== false;

  const handleCatalogueClick = (e) => {
    if (!catalogueUrl) {
      e.preventDefault();
      setToastMsg("ℹ️ Product catalogue will be available for download shortly.");
      setTimeout(() => setToastMsg(""), 5000);
    }
  };

  return (
    <div className="support-page">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="download-toast" role="status">
          <Icon name="check" size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <section className="support-hero">
        <div className="wrap">
          <nav className="support-crumbs" aria-label="Breadcrumb">
            <Link to="/">{t("nav_home") || "Home"}</Link>
            <Icon name="chev" size={12} />
            <span className="support-crumbs-current">{t("nav_support") || "Support"}</span>
          </nav>
          <div style={{ marginTop: "0.85rem" }}>
            <h1 className="support-title">{t("nav_support") || "Help & Support"}</h1>
            <p className="support-sub">
              Need assistance with orders, dispatches, or service? Reach out directly or leave a message below.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Contact Cards */}
      <section className="sec" style={{ paddingTop: "var(--s4)", paddingBottom: "var(--s2)" }}>
        <div className="wrap">
          <div className="support-channels-grid">
            {/* 1: Sales Hotline */}
            <div className="support-channel-card">
              <div className="support-channel-top">
                <div className="support-channel-icon-wrap phone">
                  <Icon name="phone" size={20} />
                </div>
                <span className="badge badge-blue">PHONE</span>
              </div>
              <div className="support-channel-body">
                <h3>Sales Hotline</h3>
                <span className="support-channel-highlight">{COMPANY.phone}</span>
                <p className="support-channel-desc">Orders, stock availability, and trade inquiries.</p>
              </div>
              <div style={{ marginTop: "auto" }}>
                <a
                  href={`tel:${COMPANY.phone.replace(/[^0-9+]/g, "")}`}
                  className="btn btn-navy"
                  style={{ width: "100%", justifyContent: "center", minHeight: "44px" }}
                >
                  <Icon name="phone" size={15} /> Call Sales
                </a>
              </div>
            </div>

            {/* 2: WhatsApp Desk */}
            <div className="support-channel-card featured">
              <div className="support-channel-top">
                <div className="support-channel-icon-wrap wa">
                  <Icon name="wa" size={20} />
                </div>
                <span className="badge badge-green">WHATSAPP</span>
              </div>
              <div className="support-channel-body">
                <h3>WhatsApp Trade Desk</h3>
                <span className="support-channel-highlight">Fast Response</span>
                <p className="support-channel-desc">Send purchase orders and quick inquiries.</p>
              </div>
              <div style={{ marginTop: "auto" }}>
                <a
                  href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hi Shriji Team, I have an enquiry.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-wa"
                  style={{ width: "100%", justifyContent: "center", minHeight: "44px" }}
                >
                  <Icon name="chat" size={15} /> Chat on WhatsApp
                </a>
              </div>
            </div>

            {/* 3: Service & Spares */}
            <div className="support-channel-card">
              <div className="support-channel-top">
                <div className="support-channel-icon-wrap service">
                  <Icon name="bolt" size={20} />
                </div>
                <span className="badge badge-warn">SERVICE</span>
              </div>
              <div className="support-channel-body">
                <h3>Service &amp; Warranty</h3>
                <span className="support-channel-highlight">{COMPANY.servicePhone || "+91 74004 20888"}</span>
                <p className="support-channel-desc">Technician requests, claims, and spare parts.</p>
              </div>
              <div style={{ marginTop: "auto" }}>
                <a
                  href={`https://wa.me/${COMPANY.servicePhoneRaw || "917400420888"}?text=${encodeURIComponent("Hi Shriji Service Desk, I need assistance with an appliance.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-navy"
                  style={{ width: "100%", justifyContent: "center", minHeight: "44px" }}
                >
                  <Icon name="chat" size={15} /> Chat with Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Support Form */}
      <section className="sec" style={{ paddingTop: "var(--s3)", paddingBottom: "var(--s4)" }}>
        <div className="wrap">
          <div className="support-form-card" id="contact" style={{ marginTop: 0 }}>
            <div className="support-form-head">
              <h2>Send Us a Message</h2>
              <p>Fill out the details below and our team will get back to you shortly.</p>
            </div>

            {ticketSent ? (
              <div
                className="ok"
                style={{
                  margin: "var(--s3) 0",
                  padding: "24px",
                  borderRadius: "16px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  display: "flex",
                  gap: 16,
                }}
              >
                <Icon name="check" size={26} style={{ flex: "none", color: "var(--emerald-600, #059669)", marginTop: 2 }} />
                <div>
                  <h3 className="h3" style={{ fontSize: "1.15rem", color: "var(--navy, #0f172a)", margin: 0, fontWeight: 800 }}>
                    Message Sent
                  </h3>
                  <p style={{ fontSize: "0.93rem", marginTop: 6, color: "var(--tx-2, #475569)", lineHeight: 1.6 }}>
                    Thank you! Your message has been received. Our team will contact you shortly.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 14, minHeight: "38px" }}
                    onClick={() => {
                      setTicketSent(false);
                      setForm({ name: "", phone: "", email: "", issueType: ISSUE_TYPES[0] || "General enquiry", details: "" });
                    }}
                  >
                    Send Another Message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} autoComplete="off">
                <div className="support-form-grid">
                  <div className="support-field">
                    <label htmlFor="ticket-name">Name / Dealership *</label>
                    <input
                      id="ticket-name"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="Your Name or Store Name"
                      value={form.name}
                      onChange={handleFieldChange("name")}
                    />
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-phone">Phone Number *</label>
                    <input
                      id="ticket-phone"
                      type="tel"
                      required
                      autoComplete="off"
                      placeholder="+91 98200 00000"
                      value={form.phone}
                      onChange={handleFieldChange("phone")}
                    />
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-email">Email Address</label>
                    <input
                      id="ticket-email"
                      type="email"
                      autoComplete="off"
                      placeholder="store@example.com (optional)"
                      value={form.email}
                      onChange={handleFieldChange("email")}
                    />
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-issue">Subject / Purpose</label>
                    <select
                      id="ticket-issue"
                      value={form.issueType}
                      onChange={handleFieldChange("issueType")}
                    >
                      {ISSUE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="support-field full-col">
                    <label htmlFor="ticket-details">Message</label>
                    <textarea
                      id="ticket-details"
                      rows={4}
                      placeholder="How can we help? Enter order, product, or spare part details..."
                      value={form.details}
                      onChange={handleFieldChange("details")}
                    />
                  </div>
                </div>

                <div className="support-form-actions">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-navy"
                    style={{
                      padding: "12px 28px",
                      minHeight: "46px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      opacity: isSubmitting ? 0.75 : 1,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Icon name="refresh" size={17} style={{ animation: "spin 1s linear infinite" }} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon name="mail" size={17} /> Send Message
                      </>
                    )}
                  </button>
                  {submitError && (
                    <span style={{ fontSize: "0.86rem", color: "var(--crimson, #dc2626)", fontWeight: 600 }}>
                      {submitError}
                    </span>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Minimal Product Catalogue Resource Bar */}
      {catalogueEnabled && (
        <section className="sec" style={{ paddingTop: 0, paddingBottom: "var(--s5)" }}>
          <div className="wrap">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "18px 24px",
                borderRadius: "16px",
                background: "#ffffff",
                border: "1px solid var(--line)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon name="doc" size={22} style={{ color: "var(--navy)" }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--navy)" }}>
                    {catalogueTitle}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--tx-2)" }}>
                    {catalogueSubtitle}
                  </div>
                </div>
              </div>
              <a
                href={catalogueUrl || "#"}
                target={catalogueUrl ? "_blank" : undefined}
                rel={catalogueUrl ? "noopener noreferrer" : undefined}
                className="btn btn-ghost btn-sm"
                style={{ minHeight: "38px" }}
                onClick={handleCatalogueClick}
              >
                <Icon name="download" size={15} /> Download Catalogue
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
