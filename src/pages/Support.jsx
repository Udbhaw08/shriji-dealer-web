import { useState } from "react";
import { Link } from "react-router-dom";
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
                    Direct access to regional distribution managers, fast-track warranty assistance, transit claim
                    desk, and official brand marketing collateral.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Priority Contact Channels Grid */}
      <section style={{ paddingTop: "var(--s4)" }}>
        <div className="wrap">
          <div className="support-channels-grid">
            {/* Channel 1: Hotline */}
            <div className="support-channel-card">
              <div className="support-channel-top">
                <div className="support-channel-icon-wrap phone">
                  <Icon name="phone" size={22} />
                </div>
                <span className="badge badge-blue">Priority Phone Desk</span>
              </div>
              <div className="support-channel-body">
                <h3>Direct Trade Hotline</h3>
                <span className="support-channel-highlight">{COMPANY.phone}</span>
                <p className="support-channel-desc">
                  Connect immediately with our Mumbai distribution office for urgent stock allocations, dispatch
                  updates, and order booking.
                </p>
              </div>
              <a
                href={`tel:${COMPANY.phone.replace(/[^0-9+]/g, "")}`}
                className="btn btn-navy"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Icon name="phone" size={16} /> Call Priority Desk
              </a>
            </div>

            {/* Channel 2: WhatsApp Desk (Featured) */}
            <div className="support-channel-card featured">
              <div className="support-channel-top">
                <div className="support-channel-icon-wrap wa">
                  <Icon name="wa" size={22} />
                </div>
                <span className="support-live-dot">Online Now · TAT &lt; 15m</span>
              </div>
              <div className="support-channel-body">
                <h3>WhatsApp Trade Desk</h3>
                <span className="support-channel-highlight">Instant Photo &amp; Docket Help</span>
                <p className="support-channel-desc">
                  Fastest way to share unboxing videos, e-way bills, proof of delivery, and enquire on eligible volume
                  scheme slabs.
                </p>
              </div>
              <a
                href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hi Sunshine / Shriji Team, I am an authorized dealer requiring quick trade assistance.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-wa"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Icon name="chat" size={16} /> Chat on WhatsApp
              </a>
            </div>

            {/* Channel 3: Service Escalation */}
            <div className="support-channel-card">
              <div className="support-channel-top">
                <div className="support-channel-icon-wrap service">
                  <Icon name="bolt" size={22} />
                </div>
                <span className="badge badge-warn">48-Hr Service TAT</span>
              </div>
              <div className="support-channel-body">
                <h3>Service &amp; Warranty RMA</h3>
                <span className="support-channel-highlight">{COMPANY.email}</span>
                <p className="support-channel-desc">
                  Doorstep technician requests, burner/glass replacement claims, and genuine factory spares dispatch.
                </p>
              </div>
              <a
                href="#service-ticket"
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Icon name="doc" size={16} /> Raise Service Ticket
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Service & Warranty Ticket Request Form */}
      <section className="sec" id="service-ticket" style={{ scrollMarginTop: "90px" }}>
        <div className="wrap">
          <div className="support-form-card">
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

      {/* Marketing Material & Digital Brand Assets Hub (Modern Maintenance / Upgrade Representation) */}
      <section className="sec support-assets-sec" id="marketing" style={{ scrollMarginTop: "90px" }}>
        <div className="wrap">
          <div className="support-maint-card">
            {/* Glowing Icon Halo */}
            <div className="support-maint-icon-halo">
              <div className="support-maint-icon-inner">
                <Icon name="image" size={26} />
              </div>
            </div>

            {/* Pulsing Status Pill */}
            <span className="support-maint-status-pill">
              Asset Library Upgrade In Progress · FY 2026–27
            </span>

            {/* Heading & Subtitle */}
            <h2 className="support-maint-title">
              Official Brand Assets &amp; Marketing Media Kit
            </h2>
            <p className="support-maint-desc">
              Our official digital collateral repository is currently undergoing scheduled maintenance &amp; studio
              refresh. High-resolution 4K product cutouts, retail showroom standee prints, and updated 2026–27 catalog
              PDFs are being packaged and will be available here shortly.
            </p>

            {/* Modern Upcoming Media Chips */}
            <div className="support-maint-chips-grid">
              <div className="support-maint-chip">
                <div className="support-maint-chip-icon">
                  <Icon name="image" size={16} />
                </div>
                <div className="support-maint-chip-info">
                  <span className="support-maint-chip-title">4K Master Product Renders</span>
                  <span className="support-maint-chip-sub">White-bg &amp; lifestyle cutouts for store ads</span>
                </div>
              </div>

              <div className="support-maint-chip">
                <div className="support-maint-chip-icon">
                  <Icon name="doc" size={16} />
                </div>
                <div className="support-maint-chip-info">
                  <span className="support-maint-chip-title">Master Product Catalogue 2026</span>
                  <span className="support-maint-chip-sub">Full technical specifications &amp; range PDF</span>
                </div>
              </div>

              <div className="support-maint-chip">
                <div className="support-maint-chip-icon">
                  <Icon name="badge" size={16} />
                </div>
                <div className="support-maint-chip-info">
                  <span className="support-maint-chip-title">Vector Brand Identity &amp; Logos</span>
                  <span className="support-maint-chip-sub">Sunshine &amp; ReSTOR official vector files</span>
                </div>
              </div>

              <div className="support-maint-chip">
                <div className="support-maint-chip-icon">
                  <Icon name="sparkle" size={16} />
                </div>
                <div className="support-maint-chip-info">
                  <span className="support-maint-chip-title">Showroom Standee Creatives</span>
                  <span className="support-maint-chip-sub">6×3 &amp; 5×2 ft flex &amp; vinyl designs</span>
                </div>
              </div>
            </div>

            {/* Instant Fallback / Priority Request Bar */}
            <div className="support-maint-action-box">
              <div className="support-maint-action-text">
                <b>Need immediate high-res logos or product photographs?</b>
                <span>Our creative desk can dispatch customized asset packs directly to your store on WhatsApp.</span>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <a
                  href={`https://wa.me/${COMPANY.phoneRaw}?text=${encodeURIComponent("Hi Sunshine / Shriji Team, I need immediate high-res brand logos or product photos for our store display.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-wa btn-sm"
                  style={{ gap: "6px" }}
                >
                  <Icon name="wa" size={15} /> Request on WhatsApp
                </a>
                <a
                  href={`mailto:${COMPANY.email}?subject=${encodeURIComponent("Urgent Brand Asset Requisition")}&body=${encodeURIComponent("Hi Shriji Team,\n\nPlease share the high-resolution logo and product image pack for our retail showroom.\n\nStore Name:\nCity:\nContact:")}`}
                  className="btn btn-ghost btn-sm"
                  style={{ gap: "6px" }}
                >
                  <Icon name="mail" size={15} /> Email Media Desk
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dealer Operations FAQ Accordion */}
      <section className="sec support-faq-sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="badge badge-warn">Dealer FAQ</span>
              <h2 className="d2" style={{ marginTop: "6px" }}>
                Frequently Asked Operational Questions
              </h2>
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
      </section>

      {/* Central Depot & Warehouse Location Banner */}
      <section style={{ paddingTop: "var(--s4)" }}>
        <div className="wrap">
          <div className="support-depot-card">
            <div className="support-depot-left">
              <span className="support-depot-badge">
                <Icon name="pin" size={12} /> Regional Distribution Depot
              </span>
              <h3>Shriji Domestic Appliances Depot</h3>
              <p>
                {COMPANY.address} · Maharashtra 400104. Stock inspections, bulk order pickups, and immediate warranty
                spares dispatch.
              </p>
              <div className="support-depot-hours">
                <Icon name="clock" size={14} />
                <span>Working Hours: Monday – Saturday, 9:30 AM to 7:00 PM (Closed Sundays)</span>
              </div>
            </div>

            <div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Motilal Nagar 1, Goregaon West, Mumbai")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-amber"
                style={{ padding: "12px 22px" }}
              >
                <Icon name="pin" size={16} /> Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
