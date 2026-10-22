import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import { COMPANY, MATERIALS, ISSUE_TYPES } from "../data/site";
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
  const [assetTab, setAssetTab] = useState("all");
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

  const handleDownloadAsset = async (item) => {
    const rawUrl = item.downloadUrl || item.img || "/downloads/catalogue.pdf";
    const filename = item.filename || `${item.title.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;

    setToastMsg(`📥 Downloading ${filename}...`);

    try {
      const endpoint = `/api/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Download status ${res.status}`);

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);

      setToastMsg(`✅ Download completed: ${filename}`);
      setTimeout(() => setToastMsg(""), 3500);
    } catch {
      // Fallback direct download link
      const link = document.createElement("a");
      link.href = rawUrl;
      link.download = filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setToastMsg(`✅ Downloading ${filename}`);
      setTimeout(() => setToastMsg(""), 3500);
    }
  };

  // Filtered Marketing Materials
  const filteredAssets = useMemo(() => {
    if (assetTab === "all") return MATERIALS;
    if (assetTab === "brochures") return MATERIALS.filter((m) => m.tab === "Brochures" || m.filename?.endsWith(".pdf"));
    if (assetTab === "images") return MATERIALS.filter((m) => m.tab === "Images");
    if (assetTab === "flyers") return MATERIALS.filter((m) => m.tab === "Flyers");
    return MATERIALS;
  }, [assetTab]);

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

      {/* Marketing Material & Digital Brand Assets Hub */}
      <section className="sec support-assets-sec" id="marketing" style={{ scrollMarginTop: "90px" }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: "1.25rem" }}>
            <div>
              <span className="badge badge-blue">Official Brand Assets</span>
              <h2 className="d2" style={{ marginTop: "6px" }}>
                Marketing Materials &amp; Media Kit
              </h2>
              <p className="sub" style={{ marginTop: "4px" }}>
                High-resolution product imagery, print-ready showroom standees, 2026 catalogues, and social media
                campaign banners.
              </p>
            </div>
          </div>

          {/* Segmented Filter Pills */}
          <div className="support-assets-tabs" role="tablist">
            <button
              className={`support-asset-tab ${assetTab === "all" ? "active" : ""}`}
              onClick={() => setAssetTab("all")}
              type="button"
            >
              All Assets ({MATERIALS.length})
            </button>
            <button
              className={`support-asset-tab ${assetTab === "brochures" ? "active" : ""}`}
              onClick={() => setAssetTab("brochures")}
              type="button"
            >
              Brochures &amp; Catalogues
            </button>
            <button
              className={`support-asset-tab ${assetTab === "images" ? "active" : ""}`}
              onClick={() => setAssetTab("images")}
              type="button"
            >
              High-Res Image Packs
            </button>
            <button
              className={`support-asset-tab ${assetTab === "flyers" ? "active" : ""}`}
              onClick={() => setAssetTab("flyers")}
              type="button"
            >
              Scheme Posters &amp; Flyers
            </button>
          </div>

          {/* Assets Grid */}
          <div className="support-assets-grid">
            {filteredAssets.map((asset) => {
              const isPdf = asset.filename?.toLowerCase().endsWith(".pdf") || asset.tab === "Brochures";
              return (
                <article key={asset.id} className="support-asset-card">
                  <div className="support-asset-preview">
                    {asset.img ? (
                      <img src={asset.img} alt={asset.title} loading="lazy" />
                    ) : (
                      <div className="support-asset-preview-fallback">
                        <Icon name={isPdf ? "doc" : "image"} size={26} />
                      </div>
                    )}
                    <span className="support-asset-type-badge">{isPdf ? "PDF" : "ZIP PACK"}</span>
                  </div>

                  <div className="support-asset-info">
                    <h3 className="support-asset-title">{asset.title}</h3>
                    <div className="support-asset-meta">
                      <span>{asset.count || "Verified Asset"}</span>
                      {asset.fileSize && <b>{asset.fileSize}</b>}
                    </div>
                    <button
                      type="button"
                      className="btn btn-navy btn-sm"
                      style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                      onClick={() => handleDownloadAsset(asset)}
                    >
                      <Icon name="download" size={15} /> Download Asset
                    </button>
                  </div>
                </article>
              );
            })}
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
