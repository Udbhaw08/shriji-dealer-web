import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import { COMPANY, ISSUE_TYPES } from "../data/site";
import { useSession } from "../data/session";

const FAQS = [
  {
    q: "How do I report transit damage or missing items?",
    a: "Please inspect the outer packaging upon delivery. If any carton is dented or opened, record a short 10-second unboxing video or take 2-3 clear photos. Share them with our WhatsApp Priority Desk within 48 hours of delivery. A replacement or credit note is processed immediately.",
  },
  {
    q: "What is the warranty turnaround time (TAT) for customer service calls?",
    a: "For Mumbai Metro, Thane, and Navi Mumbai, technician visits are scheduled within 24 to 48 business hours. For outer Maharashtra and Gujarat tier-2/3 regions, TAT is 48 to 72 business hours. All Sunshine gas stoves carry up to 5-year burner warranty and 2-year comprehensive coverage.",
  },
  {
    q: "How can I request spare parts (burners, glass panels, motor impellers)?",
    a: "Dealers can raise a spare part requisition directly through the Service Ticket form below or on WhatsApp. Standard service parts (brass burner caps, knobs, rubber legs, spark generators) are dispatched from our Goregaon West depot on the same business day.",
  },
  {
    q: "Where can I find updated dealer pricebooks and volume scheme circulars?",
    a: "Verified and approved dealers can view live wholesale rates directly on the Products page when signed in. Special volume slab incentives, 5+1 schemes, and festive promotions are accessible on the Schemes tab with downloadable PDFs.",
  },
  {
    q: "What are the standard payment terms and dispatch schedules?",
    a: "For local Mumbai dispatches, orders confirmed before 1:00 PM are dispatched on the same business day. Credit periods (15 to 30 days) are available for active, approved trade accounts subject to periodic credit evaluation.",
  },
];

export default function Support() {
  const { t } = useLanguage();
  const session = useSession();
  const dealer = session?.dealer;
  const location = useLocation();

  const [activeGroup, setActiveGroup] = useState(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#sales") return "sales";
      if (hash === "#service" || hash === "#service-ticket") return "service";
      if (hash === "#marketing" || hash === "#faq") return "marketing";
    }
    return "all";
  });

  useEffect(() => {
    if (location.hash === "#sales") setActiveGroup("sales");
    else if (location.hash === "#service" || location.hash === "#service-ticket") setActiveGroup("service");
    else if (location.hash === "#marketing" || location.hash === "#faq") setActiveGroup("marketing");
  }, [location.hash]);

  // Contact / Ticket Form State
  const [form, setForm] = useState(() => ({
    shop: dealer?.name || "",
    person: dealer?.person || session?.fullName || "",
    phone: dealer?.phone || session?.phone || "",
    issueType: ISSUE_TYPES[0] || "Installation support",
    category: "Gas Stoves",
    modelSerial: "",
    details: "",
  }));

  const [toastMsg, setToastMsg] = useState("");
  const [ticketSent, setTicketSent] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const handleFieldChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleWhatsAppTicket = (e) => {
    e.preventDefault();
    if (!form.shop.trim() || !form.phone.trim()) {
      alert("Please provide at least your Store/Firm Name and Phone Number.");
      return;
    }

    const text = `*New Dealer Service Request — Shriji Domestic / Sunshine*
━━━━━━━━━━━━━━━━━━━━
🏪 *Store / Firm:* ${form.shop.trim()}
👤 *Contact Person:* ${form.person.trim() || "N/A"}
📞 *Phone:* ${form.phone.trim()}
🛠️ *Issue Type:* ${form.issueType}
📦 *Appliance Category:* ${form.category}
🏷️ *Model / Serial / Invoice:* ${form.modelSerial.trim() || "N/A"}
📝 *Description:*
${form.details.trim() || "Assistance requested from service desk."}
━━━━━━━━━━━━━━━━━━━━
_Submitted via Sunshine Dealer Portal_`;

    const url = `https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setTicketSent(true);
    setToastMsg("✅ Service request opened in WhatsApp!");
    setTimeout(() => setToastMsg(""), 4500);
  };

  const handleEmailTicket = (e) => {
    e.preventDefault();
    if (!form.shop.trim() || !form.phone.trim()) {
      alert("Please provide at least your Store/Firm Name and Phone Number.");
      return;
    }

    const subject = encodeURIComponent(`Service Request - ${form.shop.trim()} (${form.issueType})`);
    const body = encodeURIComponent(`Dealer Service Request:
Store/Firm Name: ${form.shop.trim()}
Contact Person: ${form.person.trim()}
Phone Number: ${form.phone.trim()}
Issue Type: ${form.issueType}
Category: ${form.category}
Model / Serial: ${form.modelSerial.trim()}

Details:
${form.details.trim()}
`);
    window.location.href = `mailto:${COMPANY.email}?subject=${subject}&body=${body}`;
    setTicketSent(true);
    setToastMsg("✅ Email client opened with your ticket!");
    setTimeout(() => setToastMsg(""), 4500);
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

      {/* Hero & Breadcrumb Section */}
      <section className="support-hero">
        <div className="wrap">
          <div className="support-hero-inner">
            <nav className="support-crumbs" aria-label="Breadcrumb">
              <Link to="/">{t("nav_home") || "Home"}</Link>
              <Icon name="chev" size={12} />
              <span className="support-crumbs-current">Support &amp; Help Desk</span>
            </nav>

            <div className="support-hero-main">
              <div className="support-title-group">
                <div className="support-icon-badge" aria-hidden="true">
                  <Icon name="support" size={28} />
                </div>
                <div>
                  <span className="support-eyebrow-pill">
                    <Icon name="shield" size={13} />
                    Dedicated Dealer Concierge · Mon–Sat 9:30 AM – 7:00 PM
                  </span>
                  <h1 className="support-title">Dealer Support &amp; Help Center</h1>
                  <p className="support-sub">
                    Direct access to regional distribution managers, fast-track warranty assistance, and official brand marketing collateral.
                  </p>
                </div>
              </div>
            </div>

            {/* Department Groups Segmented Filter Tabs */}
            <div className="scheme-segmented-tabs" role="tablist" style={{ marginTop: "1.25rem" }}>
              <button
                type="button"
                className={`scheme-seg-tab ${activeGroup === "all" ? "active" : ""}`}
                role="tab"
                aria-selected={activeGroup === "all"}
                onClick={() => setActiveGroup("all")}
              >
                All Departments
              </button>
              <button
                type="button"
                className={`scheme-seg-tab ${activeGroup === "sales" ? "active" : ""}`}
                role="tab"
                aria-selected={activeGroup === "sales"}
                onClick={() => setActiveGroup("sales")}
              >
                Sales
              </button>
              <button
                type="button"
                className={`scheme-seg-tab ${activeGroup === "service" ? "active" : ""}`}
                role="tab"
                aria-selected={activeGroup === "service"}
                onClick={() => setActiveGroup("service")}
              >
                Service
              </button>
              <button
                type="button"
                className={`scheme-seg-tab ${activeGroup === "marketing" ? "active" : ""}`}
                role="tab"
                aria-selected={activeGroup === "marketing"}
                onClick={() => setActiveGroup("marketing")}
              >
                Marketing &amp; FAQ
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* GROUP 1: SALES */}
      {(activeGroup === "all" || activeGroup === "sales") && (
        <section className="sec" id="sales" style={{ paddingTop: "var(--s4)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="badge badge-blue">SALES</span>
                <h2 className="d2" style={{ marginTop: "6px" }}>Sales Desk</h2>
                <p className="sub" style={{ marginTop: "4px" }}>
                  Orders, pricing enquiries, volume allocations, and dispatch coordination.
                </p>
              </div>
            </div>

            <div className="support-channels-grid">
              {/* Sales 1: Direct Trade Hotline */}
              <div className="support-channel-card">
                <div className="support-channel-top">
                  <div className="support-channel-icon-wrap phone">
                    <Icon name="phone" size={22} />
                  </div>
                  <span className="badge badge-blue">SALES</span>
                </div>
                <div className="support-channel-body">
                  <h3>Direct Trade Hotline</h3>
                  <p className="support-channel-desc" style={{ fontSize: "0.92rem", lineHeight: 1.55 }}>
                    Speak directly with our sales team. Get assistance with dealer enquiries, pricing, stock availability, order placement, urgent dispatch coordination and business-related queries.
                  </p>
                </div>
                <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
                  <a
                    href={`tel:${COMPANY.phone.replace(/[^0-9+]/g, "")}`}
                    className="btn btn-navy"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Icon name="phone" size={16} /> Call Sales Desk
                  </a>
                  <span style={{ fontSize: "0.8rem", color: "var(--tx-3)", textAlign: "center" }}>
                    Opens your business phone number directly.
                  </span>
                </div>
              </div>

              {/* Sales 2: WhatsApp Trade Desk */}
              <div className="support-channel-card featured">
                <div className="support-channel-top">
                  <div className="support-channel-icon-wrap wa">
                    <Icon name="wa" size={22} />
                  </div>
                  <span className="badge badge-green">SALES</span>
                </div>
                <div className="support-channel-body">
                  <h3>WhatsApp Trade Desk</h3>
                  <span className="support-channel-highlight">Orders, dispatches and everyday dealer assistance.</span>
                  <p className="support-channel-desc" style={{ fontSize: "0.92rem", lineHeight: 1.55 }}>
                    Send order requirements, product enquiries, delivery follow-ups, payment confirmations and scheme-related questions directly to our trade team via WhatsApp.
                  </p>
                </div>
                <div style={{ marginTop: "auto" }}>
                  <a
                    href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hi Shriji Sales Team, I would like to place an order / enquire on trade pricing.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-wa"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Icon name="chat" size={16} /> Chat on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GROUP 2: SERVICE */}
      {(activeGroup === "all" || activeGroup === "service") && (
        <section className="sec" id="service" style={{ paddingTop: "var(--s4)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="badge badge-warn">SERVICE</span>
                <h2 className="d2" style={{ marginTop: "6px" }}>Service &amp; Warranty Desk</h2>
                <p className="sub" style={{ marginTop: "4px" }}>
                  Dedicated support for technician requests, installation assistance, and genuine spares.
                </p>
              </div>
            </div>

            {/* Service & Warranty Card */}
            <div
              className="card pad"
              style={{
                borderRadius: "var(--r-xl, 20px)",
                border: "1.5px solid var(--line, #dce4ed)",
                background: "#ffffff",
                boxShadow: "0 6px 24px rgba(16, 38, 58, 0.05)",
                padding: "clamp(20px, 3.5vw, 32px)",
                marginBottom: "var(--s4)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <div className="support-channel-icon-wrap service" style={{ width: 48, height: 48, borderRadius: 12 }}>
                  <Icon name="bolt" size={24} />
                </div>
                <div style={{ flex: "1 1 240px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>Service &amp; Warranty Desk</h3>
                    <span className="badge badge-warn">SERVICE</span>
                  </div>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--navy-2, #174d7a)" }}>
                    Dedicated WhatsApp support
                  </span>
                </div>
              </div>

              <p style={{ fontSize: "0.96rem", color: "var(--tx-2, #475569)", lineHeight: 1.6, margin: "0 0 24px", maxWidth: "68ch" }}>
                For service requests, installation assistance, warranty-related queries, technical troubleshooting and genuine spare parts enquiries.
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <a
                  href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hi Shriji Service Desk, I need technician / warranty support for an appliance.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-navy"
                  style={{ padding: "12px 22px" }}
                >
                  <Icon name="chat" size={16} /> Chat with Service Desk
                </a>
                <Link
                  to="/terms"
                  className="btn btn-ghost"
                  style={{ padding: "12px 22px" }}
                >
                  <Icon name="doc" size={16} /> Service Terms &amp; Conditions
                </Link>
              </div>

              <span style={{ display: "block", marginTop: 14, fontSize: "0.82rem", color: "var(--tx-3, #94a3b8)" }}>
                Both actions are connected to their respective live destinations on the website.
              </span>
            </div>

            {/* Interactive Service & Warranty Ticket Request Form */}
            <div className="support-form-card" id="service-ticket" style={{ scrollMarginTop: "90px" }}>
            <div className="support-form-head">
              <h2>Raise a Service or Warranty Request</h2>
              <p>
                Fill out the details below. Our technical coordinator will register the service docket and route a
                certified technician or dispatch replacement spares.
              </p>
            </div>

            {ticketSent ? (
              <div className="ok" style={{ margin: "var(--s3) 0" }}>
                <Icon name="check" size={22} style={{ flex: "none", marginTop: 2 }} />
                <div>
                  <h3 className="h3" style={{ fontSize: "1.05rem" }}>
                    Service Request Prepared
                  </h3>
                  <p style={{ fontSize: "0.92rem", marginTop: 4 }}>
                    Your ticket details have been compiled. Our dispatch desk at Motilal Nagar, Goregaon West will
                    review and contact your store within 1 business day.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={() => setTicketSent(false)}
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleWhatsAppTicket}>
                <div className="support-form-grid">
                  <div className="support-field">
                    <label htmlFor="ticket-shop">Store / Dealership Name *</label>
                    <input
                      id="ticket-shop"
                      type="text"
                      required
                      placeholder="e.g. Apex Electronics & Kitchenware"
                      value={form.shop}
                      onChange={handleFieldChange("shop")}
                    />
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-person">Contact Person</label>
                    <input
                      id="ticket-person"
                      type="text"
                      placeholder="e.g. Kunal Shah"
                      value={form.person}
                      onChange={handleFieldChange("person")}
                    />
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-phone">Registered Contact Number *</label>
                    <input
                      id="ticket-phone"
                      type="tel"
                      required
                      placeholder="e.g. +91 98200 00000"
                      value={form.phone}
                      onChange={handleFieldChange("phone")}
                    />
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-issue">Issue / Request Type</label>
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

                  <div className="support-field">
                    <label htmlFor="ticket-category">Appliance Category</label>
                    <select
                      id="ticket-category"
                      value={form.category}
                      onChange={handleFieldChange("category")}
                    >
                      <option value="Gas Stoves">Gas Stoves (SS &amp; Toughened Glass)</option>
                      <option value="Chimneys">Kitchen Chimneys (BLDC &amp; Auto-Clean)</option>
                      <option value="Hob Tops">Built-In Hobs &amp; Hob Tops</option>
                      <option value="Induction Cooktops">Induction Cookers &amp; Infrared Hobs</option>
                      <option value="Cookware & Small Appliances">Electric Kettles &amp; Cookware</option>
                    </select>
                  </div>

                  <div className="support-field">
                    <label htmlFor="ticket-model">Model Name / Serial / Invoice No.</label>
                    <input
                      id="ticket-model"
                      type="text"
                      placeholder="e.g. Apollo 2B Black or Invoice #SH-4892"
                      value={form.modelSerial}
                      onChange={handleFieldChange("modelSerial")}
                    />
                  </div>

                  <div className="support-field full-col">
                    <label htmlFor="ticket-details">Issue Description &amp; Symptom Details</label>
                    <textarea
                      id="ticket-details"
                      rows={3}
                      placeholder="Describe the issue, required spare part (e.g., burner valve, glass crack, motor noise), or delivery condition..."
                      value={form.details}
                      onChange={handleFieldChange("details")}
                    />
                  </div>
                </div>

                <div className="support-form-actions">
                  <button type="submit" className="btn btn-wa" style={{ padding: "12px 24px" }}>
                    <Icon name="chat" size={17} /> Submit via WhatsApp Desk
                  </button>
                  <button
                    type="button"
                    onClick={handleEmailTicket}
                    className="btn btn-navy"
                    style={{ padding: "12px 24px" }}
                  >
                    <Icon name="mail" size={17} /> Send via Official Email
                  </button>
                  <span className="note" style={{ fontSize: "0.82rem", color: "var(--tx-3)" }}>
                    Directly pre-fills your request with instant ticket formatting.
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
      )}

      {/* GROUP 3: MARKETING & FAQ */}
      {(activeGroup === "all" || activeGroup === "marketing") && (
        <section className="sec" id="marketing" style={{ paddingTop: "var(--s4)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="badge badge-blue">MARKETING &amp; FAQ</span>
                <h2 className="d2" style={{ marginTop: "6px" }}>Product Media &amp; Catalogues</h2>
                <p className="sub" style={{ marginTop: "4px" }}>
                  Access official product resources for your store, all in one place.
                </p>
              </div>
            </div>

            {/* Media & Catalogues Cards (Matches Sheet 2 Reference image19) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
                gap: "var(--s3, 16px)",
                marginBottom: "var(--s5, 36px)",
              }}
            >
              {/* Card 1: Product Catalogues */}
              <div
                className="card pad"
                style={{
                  borderRadius: "var(--r-xl, 20px)",
                  border: "1.5px solid var(--line, #dce4ed)",
                  background: "#ffffff",
                  boxShadow: "0 4px 18px rgba(16, 38, 58, 0.04)",
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-sm, 10px)",
                      background: "rgba(16, 38, 58, 0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--navy, #10263a)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="doc" size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 800, color: "var(--tx, #10263a)" }}>
                      Product Catalogues
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--tx-2, #64748b)", lineHeight: 1.5 }}>
                      Product catalogues, specifications and brochures.
                    </p>
                  </div>
                </div>

                <a
                  href="/downloads/Sunshine-Range-Brochure-2026.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-navy"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Icon name="doc" size={15} /> View Catalogues
                </a>
              </div>

              {/* Card 2: Product Images & Videos */}
              <div
                className="card pad"
                style={{
                  borderRadius: "var(--r-xl, 20px)",
                  border: "1.5px solid var(--line, #dce4ed)",
                  background: "#ffffff",
                  boxShadow: "0 4px 18px rgba(16, 38, 58, 0.04)",
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-sm, 10px)",
                      background: "rgba(16, 38, 58, 0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--navy, #10263a)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="image" size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 800, color: "var(--tx, #10263a)" }}>
                      Product Images &amp; Videos
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--tx-2, #64748b)", lineHeight: 1.5 }}>
                      High-resolution product photos and product demonstration videos.
                    </p>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hi Shriji Marketing Desk, please share the high-resolution product photos and demonstration videos for our retail showroom.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-navy"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Icon name="image" size={15} /> View Media Library
                </a>
              </div>
            </div>

            {/* Dealer Operations FAQ Accordion */}
            <div id="faq" style={{ scrollMarginTop: "90px" }}>
              <div className="sec-head">
                <div>
                  <span className="badge badge-warn">Dealer FAQ</span>
                  <h3 className="d2" style={{ fontSize: "1.45rem", marginTop: "6px" }}>
                    Frequently Asked Operational Questions
                  </h3>
                  <p className="sub" style={{ marginTop: "4px" }}>
                    Quick answers on trade credit, warranty claim procedures, spare parts, and transit replacements.
                  </p>
                </div>
              </div>

              <div className="support-faq-list">
                {FAQS.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={idx} className={`support-faq-item ${isOpen ? "open" : ""}`}>
                      <button
                        type="button"
                        className="support-faq-trigger"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        aria-expanded={isOpen}
                      >
                        <span>{faq.q}</span>
                        <span className="support-faq-icon" aria-hidden="true">
                          <Icon name="chev" size={14} />
                        </span>
                      </button>
                      {isOpen && <div className="support-faq-content">{faq.a}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
