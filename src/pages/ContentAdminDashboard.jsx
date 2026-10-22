import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";

const DEFAULT_BANNER_FORM = {
  id: "",
  type: "hero_banner",
  title: "",
  subtitle: "",
  badge: "",
  image_url: "",
  file_url: "",
  video_url: "",
  link_url: "/products",
  bg_color: "#0110a7",
  display_order: 1,
  is_active: true,
  metadata: {},
};

const DEFAULT_SCHEME_FORM = {
  id: "",
  type: "scheme",
  title: "",
  subtitle: "Valid for Limited Time",
  badge: "Dealer Exclusive",
  image_url: "",
  file_url: "",
  video_url: "",
  link_url: "https://wa.me/917738369367?text=Hi%20Shriji%20Team%2C%20I%20want%20to%20enquire%20about%20the%20active%20dealer%20scheme",
  bg_color: "#0110a7",
  display_order: 1,
  is_active: true,
  metadata: {
    blurb: "Exclusive dealer wholesale scheme on selected Sunshine models.",
    tagline: "Celebrate More. Earn More.",
    pdf_filename: "Sunshine_Dealer_Scheme_Circular.pdf",
  },
};

const QUICK_COLORS = [
  { label: "Classic ReSTOR Blue", hex: "#0110a7" },
  { label: "Nordic Deep Navy", hex: "#10263a" },
  { label: "Vibrant Royal", hex: "#0c5cd6" },
  { label: "Charcoal Obsidian", hex: "#152334" },
  { label: "Slate Grey", hex: "#95a5b5" },
];

export default function ContentAdminDashboard() {
  const [activeTab, setActiveTab] = useState("hero_banner"); // 'hero_banner' | 'scheme' | 'branding'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Forms
  const [bannerForm, setBannerForm] = useState(DEFAULT_BANNER_FORM);
  const [schemeForm, setSchemeForm] = useState(DEFAULT_SCHEME_FORM);
  const [editingId, setEditingId] = useState(null);

  const notify = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4500);
  };

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/content");
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setItems(data.items);
      } else {
        throw new Error(data.error || "Failed to load store content");
      }
    } catch (err) {
      setError(err.message || "Failed to connect to Supabase");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const heroBanners = useMemo(
    () => items.filter((x) => x.type === "hero_banner").sort((a, b) => (a.display_order || 1) - (b.display_order || 1)),
    [items]
  );

  const schemes = useMemo(
    () => items.filter((x) => x.type === "scheme").sort((a, b) => (a.display_order || 1) - (b.display_order || 1)),
    [items]
  );

  const brandingItems = useMemo(
    () => items.filter((x) => x.type === "branding"),
    [items]
  );

  // Bust cache on live store
  const refreshLiveCache = async () => {
    setBusy(true);
    try {
      try {
        sessionStorage.removeItem("shriji_supabase_banners");
        sessionStorage.removeItem("shriji_supabase_schemes");
        sessionStorage.removeItem("shriji_supabase_banners_v2");
        sessionStorage.removeItem("shriji_supabase_schemes_v2");
        sessionStorage.removeItem("shriji_supabase_branding_v2");
      } catch {}
      await Promise.all([
        fetch("/api/banners?refresh=true").catch(() => {}),
        fetch("/api/schemes?refresh=true").catch(() => {}),
        fetch("/api/branding?refresh=true").catch(() => {}),
      ]);
      await fetchContent();
      notify("✓ Live cache refreshed! Home page and Schemes page are completely in sync with Supabase.");
    } catch (err) {
      setError("Cache refresh failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  // Toggle active status
  const handleToggle = async (item) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/content?action=toggle&id=${encodeURIComponent(item.id)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        await refreshLiveCache();
        notify(`✓ Status toggled for "${item.title}"`);
      } else {
        throw new Error(data.error || "Failed to toggle status");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Delete item
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}" from Supabase? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/content?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        if (editingId === item.id) {
          setEditingId(null);
          setBannerForm(DEFAULT_BANNER_FORM);
          setSchemeForm(DEFAULT_SCHEME_FORM);
        }
        await refreshLiveCache();
        notify(`✓ "${item.title}" deleted from Supabase.`);
      } else {
        throw new Error(data.error || "Failed to delete item");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Edit item prefill
  const startEditBanner = (item) => {
    setEditingId(item.id);
    setBannerForm({
      id: item.id,
      type: "hero_banner",
      title: item.title || "",
      subtitle: item.subtitle || "",
      badge: item.badge || "",
      image_url: item.image_url || "",
      file_url: item.file_url || "",
      video_url: item.video_url || "",
      link_url: item.link_url || "/products",
      bg_color: item.bg_color || "#0110a7",
      display_order: item.display_order || 1,
      is_active: item.is_active !== false,
      metadata: item.metadata || {},
    });
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const startEditScheme = (item) => {
    setEditingId(item.id);
    const meta = item.metadata || {};
    setSchemeForm({
      id: item.id,
      type: "scheme",
      title: item.title || "",
      subtitle: item.subtitle || "Valid for Limited Time",
      badge: item.badge || "Dealer Exclusive",
      image_url: item.image_url || "",
      file_url: item.file_url || "",
      video_url: item.video_url || "",
      link_url: item.link_url || "https://wa.me/917738369367",
      bg_color: item.bg_color || "#0110a7",
      display_order: item.display_order || 1,
      is_active: item.is_active !== false,
      metadata: {
        blurb: meta.blurb || item.subtitle || "",
        tagline: meta.tagline || "Celebrate More. Earn More.",
        pdf_filename: meta.pdf_filename || "Sunshine_Dealer_Scheme_Circular.pdf",
      },
    });
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  // Submit Banner Form
  const saveBanner = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      ...bannerForm,
      id: (bannerForm.id || `hero-${Date.now()}`).trim().toLowerCase().replace(/\s+/g, "-"),
      type: "hero_banner",
      display_order: Number(bannerForm.display_order) || 1,
    };

    if (!payload.title.trim()) {
      setError("Banner Title is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingId(null);
        setBannerForm(DEFAULT_BANNER_FORM);
        await refreshLiveCache();
        notify(`✓ Hero Banner "${payload.title}" saved & live in Supabase!`);
      } else {
        throw new Error(data.error || "Failed to save banner");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Submit Scheme Form
  const saveScheme = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      ...schemeForm,
      id: (schemeForm.id || `scheme-${Date.now()}`).trim().toLowerCase().replace(/\s+/g, "-"),
      type: "scheme",
      display_order: Number(schemeForm.display_order) || 1,
    };

    if (!payload.title.trim()) {
      setError("Scheme Title is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingId(null);
        setSchemeForm(DEFAULT_SCHEME_FORM);
        await refreshLiveCache();
        notify(`✓ Scheme "${payload.title}" saved & live in Supabase!`);
      } else {
        throw new Error(data.error || "Failed to save scheme");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sec" style={{ minHeight: "85vh", paddingTop: "var(--s4)", paddingBottom: "var(--s8)" }}>
      <div className="wrap">
        {/* Top Header Card */}
        <div className="content-admin-header-card">
          <div className="content-admin-header-left">
            <div className="content-admin-badge-row">
              <span className="live-db-dot" />
              <span className="live-db-pill">Supabase Connected: public.store_content</span>
              <span className="content-count-pill">{items.length} Total Records</span>
            </div>
            <h1 className="content-admin-main-title">Store Content CMS Dashboard</h1>
            <p className="content-admin-sub">
              Manage live homepage hero banners, active dealer promotional schemes, and circular flyers directly in your Supabase database.
            </p>
          </div>

          <div className="content-admin-header-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={refreshLiveCache}
              disabled={busy}
              title="Re-query Supabase and bust cache"
            >
              <Icon name="bolt" size={16} />
              <span>{busy ? "Syncing…" : "Refresh Live Cache"}</span>
            </button>
            <Link to="/" className="btn btn-navy" target="_blank" rel="noopener noreferrer">
              <Icon name="arrow" size={16} />
              <span>View Live Home</span>
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="admin-alert-banner error" role="alert">
            <Icon name="close" size={18} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="admin-alert-banner success" role="status">
            <Icon name="check" size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Segmented Section Tabs */}
        <div className="content-segmented-nav">
          <button
            type="button"
            className={`content-nav-btn ${activeTab === "hero_banner" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("hero_banner");
              setEditingId(null);
            }}
          >
            <Icon name="image" size={18} />
            <span>Hero Banners</span>
            <span className="tab-counter-badge">{heroBanners.length}</span>
          </button>

          <button
            type="button"
            className={`content-nav-btn ${activeTab === "scheme" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("scheme");
              setEditingId(null);
            }}
          >
            <Icon name="tag" size={18} />
            <span>Dealer Schemes</span>
            <span className="tab-counter-badge">{schemes.length}</span>
          </button>

          <button
            type="button"
            className={`content-nav-btn ${activeTab === "branding" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("branding");
              setEditingId(null);
            }}
          >
            <Icon name="sparkle" size={18} />
            <span>Branding & Logo</span>
            <span className="tab-counter-badge">{brandingItems.length}</span>
          </button>
        </div>

        {/* ============================================================
            TAB 1: HERO BANNERS MANAGEMENT
            ============================================================ */}
        {activeTab === "hero_banner" && (
          <div className="content-tab-content-grid">
            {/* Left Column: Form Editor */}
            <div className="content-card form-card">
              <div className="content-card-head">
                <div className="card-head-title-wrap">
                  <span className="card-eyebrow">
                    {editingId ? "EDITING EXISTING BANNER" : "ADD NEW HERO BANNER"}
                  </span>
                  <h2 className="card-main-heading">
                    {editingId ? "Update Banner Details" : "Create Hero Slide"}
                  </h2>
                </div>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setEditingId(null);
                      setBannerForm(DEFAULT_BANNER_FORM);
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={saveBanner} className="content-admin-form">
                <div className="field-group">
                  <label htmlFor="b-title">Banner Headline / Title *</label>
                  <input
                    id="b-title"
                    type="text"
                    required
                    placeholder="e.g. Sunshine Shine Platinum — Toughened Glass"
                    value={bannerForm.title}
                    onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="b-sub">Subtitle / Key Selling Proposition</label>
                  <input
                    id="b-sub"
                    type="text"
                    placeholder="e.g. Reimagine, Rebuild, Restart. 5-Yr Burner Warranty"
                    value={bannerForm.subtitle}
                    onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                  />
                </div>

                <div className="form-two-cols">
                  <div className="field-group">
                    <label htmlFor="b-id">Unique Identifier (ID)</label>
                    <input
                      id="b-id"
                      type="text"
                      placeholder="e.g. hero-platinum-stove"
                      value={bannerForm.id}
                      onChange={(e) => setBannerForm({ ...bannerForm, id: e.target.value })}
                    />
                    <small className="field-hint">Leave blank to auto-generate</small>
                  </div>

                  <div className="field-group">
                    <label htmlFor="b-order">Display Sequence Order</label>
                    <input
                      id="b-order"
                      type="number"
                      min="1"
                      max="99"
                      value={bannerForm.display_order}
                      onChange={(e) => setBannerForm({ ...bannerForm, display_order: e.target.value })}
                    />
                    <small className="field-hint">1 = First slide, 2 = Second slide</small>
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="b-img">Banner Image URL</label>
                  <input
                    id="b-img"
                    type="text"
                    placeholder="e.g. https://...supabase.co/.../banner.jpg or /img/1st.jpeg"
                    value={bannerForm.image_url || ""}
                    onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })}
                  />
                  <div className="quick-suggestions-row">
                    <span className="suggestions-lbl">Presets:</span>
                    <button
                      type="button"
                      className="suggestion-chip"
                      onClick={() => setBannerForm({ ...bannerForm, image_url: "/img/1st.jpeg" })}
                    >
                      /img/1st.jpeg
                    </button>
                    <button
                      type="button"
                      className="suggestion-chip"
                      onClick={() => setBannerForm({ ...bannerForm, image_url: "/img/2nd.jpeg" })}
                    >
                      /img/2nd.jpeg
                    </button>
                    <button
                      type="button"
                      className="suggestion-chip"
                      onClick={() => setBannerForm({ ...bannerForm, image_url: "/img/3rd.jpeg" })}
                    >
                      /img/3rd.jpeg
                    </button>
                  </div>
                </div>

                {/* Image Live Preview Stage */}
                {bannerForm.image_url && (
                  <div className="preview-stage-wrap">
                    <span className="preview-stage-lbl">Image Live Preview</span>
                    <div className="banner-preview-box" style={{ background: bannerForm.bg_color || "#0110a7" }}>
                      <img
                        src={bannerForm.image_url}
                        alt="Preview"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="form-two-cols">
                  <div className="field-group">
                    <label htmlFor="b-link">Target Navigation Link</label>
                    <input
                      id="b-link"
                      type="text"
                      placeholder="e.g. /products?cat=gas_stoves"
                      value={bannerForm.link_url || ""}
                      onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="b-color">Background Accent Color</label>
                    <div className="color-picker-group">
                      <input
                        id="b-color"
                        type="color"
                        value={bannerForm.bg_color || "#0110a7"}
                        onChange={(e) => setBannerForm({ ...bannerForm, bg_color: e.target.value })}
                        className="color-picker-input"
                      />
                      <input
                        type="text"
                        value={bannerForm.bg_color || "#0110a7"}
                        onChange={(e) => setBannerForm({ ...bannerForm, bg_color: e.target.value })}
                        className="color-hex-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Color Swatches */}
                <div className="color-swatches-strip">
                  {QUICK_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className="swatch-btn"
                      style={{ background: c.hex }}
                      title={c.label}
                      onClick={() => setBannerForm({ ...bannerForm, bg_color: c.hex })}
                    />
                  ))}
                </div>

                <div className="field-group">
                  <label htmlFor="b-video">Video Link (Optional MP4 or Google Drive Link)</label>
                  <input
                    id="b-video"
                    type="text"
                    placeholder="e.g. https://.../video.mp4 or https://drive.google.com/file/d/.../preview"
                    value={bannerForm.video_url || ""}
                    onChange={(e) => setBannerForm({ ...bannerForm, video_url: e.target.value })}
                  />
                  <small className="field-hint">Direct MP4 will play in loop; Google Drive link creates a Play badge.</small>
                </div>

                <div className="toggle-checkbox-row">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={bannerForm.is_active}
                      onChange={(e) => setBannerForm({ ...bannerForm, is_active: e.target.checked })}
                    />
                    <span className="toggle-custom-box" />
                    <span className="toggle-text-wrap">
                      <b>Active & Visible on Home Page</b>
                      <small>If unchecked, slide is saved in Supabase but hidden from visitors.</small>
                    </span>
                  </label>
                </div>

                <div className="form-action-bar">
                  <button type="submit" className="btn btn-navy" disabled={busy} style={{ width: "100%", minHeight: 48 }}>
                    <Icon name="check" size={17} />
                    <span>{editingId ? "Update Banner in Supabase" : "Publish Banner to Live Hero"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Existing Banners List */}
            <div className="content-card list-card">
              <div className="content-card-head">
                <div>
                  <span className="card-eyebrow">DATABASE ROWS</span>
                  <h2 className="card-main-heading">Current Hero Banners ({heroBanners.length})</h2>
                </div>
                <Link to="/" className="view-external-link" target="_blank" rel="noopener noreferrer">
                  View Carousel <Icon name="chev" size={13} />
                </Link>
              </div>

              {heroBanners.length === 0 ? (
                <div className="empty-content-state">
                  <Icon name="image" size={36} />
                  <p>No banners found in Supabase. Add your first hero slide using the form on the left!</p>
                </div>
              ) : (
                <div className="admin-items-list">
                  {heroBanners.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`admin-item-card ${editingId === item.id ? "is-editing" : ""} ${!item.is_active ? "is-inactive" : ""}`}
                    >
                      <div className="admin-item-thumb-box" style={{ background: item.bg_color || "#0110a7" }}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Icon name="image" size={24} style={{ color: "rgba(255,255,255,0.7)" }} />
                        )}
                        <span className="order-sequence-pill">#{item.display_order || idx + 1}</span>
                      </div>

                      <div className="admin-item-body">
                        <div className="admin-item-meta-top">
                          <span className={`status-pill ${item.is_active ? "active" : "inactive"}`}>
                            <span className="status-dot" />
                            {item.is_active ? "Live on Store" : "Inactive / Draft"}
                          </span>
                          <span className="admin-item-id-tag">ID: {item.id}</span>
                        </div>

                        <h3 className="admin-item-title">{item.title}</h3>
                        {item.subtitle && <p className="admin-item-subtitle">{item.subtitle}</p>}

                        <div className="admin-item-details-row">
                          <span className="detail-tag">Link: {item.link_url || "/products"}</span>
                          {item.video_url && <span className="detail-tag video-tag">📹 Video Linked</span>}
                        </div>

                        <div className="admin-item-actions-row">
                          <button
                            type="button"
                            className="item-action-btn toggle-btn"
                            onClick={() => handleToggle(item)}
                            disabled={busy}
                            title={item.is_active ? "Deactivate banner" : "Activate banner"}
                          >
                            <span className="item-action-icon">{item.is_active ? "⏸" : "▶"}</span>
                            <span>{item.is_active ? "Pause" : "Activate"}</span>
                          </button>

                          <button
                            type="button"
                            className="item-action-btn edit-btn"
                            onClick={() => startEditBanner(item)}
                            disabled={busy}
                          >
                            <span className="item-action-icon">✏️</span>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="item-action-btn delete-btn"
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                          >
                            <span className="item-action-icon">🗑️</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: DEALER SCHEMES MANAGEMENT
            ============================================================ */}
        {activeTab === "scheme" && (
          <div className="content-tab-content-grid">
            {/* Left Column: Scheme Form */}
            <div className="content-card form-card">
              <div className="content-card-head">
                <div className="card-head-title-wrap">
                  <span className="card-eyebrow">
                    {editingId ? "EDITING EXISTING SCHEME" : "ADD NEW DEALER SCHEME"}
                  </span>
                  <h2 className="card-main-heading">
                    {editingId ? "Update Scheme Details" : "Create Dealer Promotion"}
                  </h2>
                </div>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setEditingId(null);
                      setSchemeForm(DEFAULT_SCHEME_FORM);
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={saveScheme} className="content-admin-form">
                <div className="field-group">
                  <label htmlFor="s-title">Scheme Title *</label>
                  <input
                    id="s-title"
                    type="text"
                    required
                    placeholder="e.g. Festive 5+1 Bonanza Cooktop Offer"
                    value={schemeForm.title}
                    onChange={(e) => setSchemeForm({ ...schemeForm, title: e.target.value })}
                  />
                </div>

                <div className="form-two-cols">
                  <div className="field-group">
                    <label htmlFor="s-badge">Badge / Slab Tag</label>
                    <input
                      id="s-badge"
                      type="text"
                      placeholder="e.g. Dealer Exclusive, 5+1 Slab"
                      value={schemeForm.badge}
                      onChange={(e) => setSchemeForm({ ...schemeForm, badge: e.target.value })}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="s-validity">Validity Dates / Period</label>
                    <input
                      id="s-validity"
                      type="text"
                      placeholder="e.g. Valid 01 Sep 2026 – 31 Dec 2026"
                      value={schemeForm.subtitle}
                      onChange={(e) => setSchemeForm({ ...schemeForm, subtitle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="s-blurb">Scheme Description / Blurb</label>
                  <textarea
                    id="s-blurb"
                    rows="3"
                    placeholder="e.g. Purchase any 5 Sunshine Cooktops and receive 1 unit completely Free along with official warranty..."
                    value={schemeForm.metadata?.blurb || ""}
                    onChange={(e) =>
                      setSchemeForm({
                        ...schemeForm,
                        metadata: { ...schemeForm.metadata, blurb: e.target.value },
                      })
                    }
                  />
                </div>

                <div className="form-two-cols">
                  <div className="field-group">
                    <label htmlFor="s-tagline">Marketing Tagline</label>
                    <input
                      id="s-tagline"
                      type="text"
                      placeholder="e.g. Celebrate More. Earn More."
                      value={schemeForm.metadata?.tagline || ""}
                      onChange={(e) =>
                        setSchemeForm({
                          ...schemeForm,
                          metadata: { ...schemeForm.metadata, tagline: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="s-order">Display Sequence</label>
                    <input
                      id="s-order"
                      type="number"
                      min="1"
                      max="99"
                      value={schemeForm.display_order}
                      onChange={(e) => setSchemeForm({ ...schemeForm, display_order: e.target.value })}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="s-img">Flyer Image URL</label>
                  <input
                    id="s-img"
                    type="text"
                    placeholder="e.g. https://...supabase.co/.../flyer.jpg or /img/02_Scheme_Flyer_Image.jpg"
                    value={schemeForm.image_url || ""}
                    onChange={(e) => setSchemeForm({ ...schemeForm, image_url: e.target.value })}
                  />
                  <div className="quick-suggestions-row">
                    <span className="suggestions-lbl">Flyer Presets:</span>
                    <button
                      type="button"
                      className="suggestion-chip"
                      onClick={() => setSchemeForm({ ...schemeForm, image_url: "/img/02_Scheme_Flyer_Image.jpg" })}
                    >
                      /img/02_Scheme_Flyer_Image.jpg
                    </button>
                    <button
                      type="button"
                      className="suggestion-chip"
                      onClick={() => setSchemeForm({ ...schemeForm, image_url: "/img/scheme-annual-business-2026.jpg" })}
                    >
                      /img/scheme-annual-business-2026.jpg
                    </button>
                  </div>
                </div>

                {schemeForm.image_url && (
                  <div className="preview-stage-wrap">
                    <span className="preview-stage-lbl">Flyer Image Preview</span>
                    <div className="banner-preview-box" style={{ background: "#ffffff", height: 180 }}>
                      <img
                        src={schemeForm.image_url}
                        alt="Flyer Preview"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="form-two-cols">
                  <div className="field-group">
                    <label htmlFor="s-pdf">Official Circular PDF Link</label>
                    <input
                      id="s-pdf"
                      type="text"
                      placeholder="e.g. /downloads/03_Scheme_Official_Circular.pdf"
                      value={schemeForm.file_url || ""}
                      onChange={(e) => setSchemeForm({ ...schemeForm, file_url: e.target.value })}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="s-pdfname">PDF Filename on Download</label>
                    <input
                      id="s-pdfname"
                      type="text"
                      placeholder="e.g. Sunshine_Festive_5_1_Circular.pdf"
                      value={schemeForm.metadata?.pdf_filename || ""}
                      onChange={(e) =>
                        setSchemeForm({
                          ...schemeForm,
                          metadata: { ...schemeForm.metadata, pdf_filename: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="s-link">WhatsApp / Enquiry Link</label>
                  <input
                    id="s-link"
                    type="text"
                    placeholder="e.g. https://wa.me/917738369367?text=..."
                    value={schemeForm.link_url || ""}
                    onChange={(e) => setSchemeForm({ ...schemeForm, link_url: e.target.value })}
                  />
                </div>

                <div className="toggle-checkbox-row">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={schemeForm.is_active}
                      onChange={(e) => setSchemeForm({ ...schemeForm, is_active: e.target.checked })}
                    />
                    <span className="toggle-custom-box" />
                    <span className="toggle-text-wrap">
                      <b>Active & Visible on Schemes Page</b>
                      <small>Dealers will see this scheme in /schemes with flyer & PDF download.</small>
                    </span>
                  </label>
                </div>

                <div className="form-action-bar">
                  <button type="submit" className="btn btn-navy" disabled={busy} style={{ width: "100%", minHeight: 48 }}>
                    <Icon name="check" size={17} />
                    <span>{editingId ? "Update Scheme in Supabase" : "Publish Scheme to Live Store"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Schemes List */}
            <div className="content-card list-card">
              <div className="content-card-head">
                <div>
                  <span className="card-eyebrow">DATABASE ROWS</span>
                  <h2 className="card-main-heading">Current Schemes ({schemes.length})</h2>
                </div>
                <Link to="/schemes" className="view-external-link" target="_blank" rel="noopener noreferrer">
                  View Schemes Page <Icon name="chev" size={13} />
                </Link>
              </div>

              {schemes.length === 0 ? (
                <div className="empty-content-state">
                  <Icon name="tag" size={36} />
                  <p>No promotional schemes in Supabase yet. Create one with the form!</p>
                </div>
              ) : (
                <div className="admin-items-list">
                  {schemes.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`admin-item-card ${editingId === item.id ? "is-editing" : ""} ${!item.is_active ? "is-inactive" : ""}`}
                    >
                      <div className="admin-item-thumb-box" style={{ background: "#ffffff" }}>
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Icon name="doc" size={24} style={{ color: "var(--navy)" }} />
                        )}
                        <span className="order-sequence-pill">#{item.display_order || idx + 1}</span>
                      </div>

                      <div className="admin-item-body">
                        <div className="admin-item-meta-top">
                          <span className={`status-pill ${item.is_active ? "active" : "inactive"}`}>
                            <span className="status-dot" />
                            {item.is_active ? "Active Scheme" : "Inactive / Draft"}
                          </span>
                          {item.badge && <span className="badge badge-blue">{item.badge}</span>}
                        </div>

                        <h3 className="admin-item-title">{item.title}</h3>
                        {item.subtitle && <p className="admin-item-subtitle">{item.subtitle}</p>}

                        <div className="admin-item-details-row">
                          {item.file_url ? (
                            <span className="detail-tag pdf-tag">📄 PDF Circular Attached</span>
                          ) : (
                            <span className="detail-tag">No PDF</span>
                          )}
                          <span className="admin-item-id-tag">ID: {item.id}</span>
                        </div>

                        <div className="admin-item-actions-row">
                          <button
                            type="button"
                            className="item-action-btn toggle-btn"
                            onClick={() => handleToggle(item)}
                            disabled={busy}
                          >
                            <span className="item-action-icon">{item.is_active ? "⏸" : "▶"}</span>
                            <span>{item.is_active ? "Pause" : "Activate"}</span>
                          </button>

                          <button
                            type="button"
                            className="item-action-btn edit-btn"
                            onClick={() => startEditScheme(item)}
                            disabled={busy}
                          >
                            <span className="item-action-icon">✏️</span>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="item-action-btn delete-btn"
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                          >
                            <span className="item-action-icon">🗑️</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: BRANDING & ASSETS
            ============================================================ */}
        {activeTab === "branding" && (
          <div className="content-tab-content-grid">
            <div className="content-card list-card" style={{ gridColumn: "1 / -1" }}>
              <div className="content-card-head">
                <div>
                  <span className="card-eyebrow">GLOBAL BRAND ASSETS</span>
                  <h2 className="card-main-heading">Branding Records ({brandingItems.length})</h2>
                </div>
              </div>

              <div className="admin-items-list">
                {brandingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`admin-item-card ${!item.is_active ? "is-inactive" : ""}`}
                  >
                    <div className="admin-item-thumb-box" style={{ background: "#ffffff" }}>
                      <img src={item.image_url} alt={item.title} />
                    </div>
                    <div className="admin-item-body">
                      <div className="admin-item-meta-top">
                        <span className={`status-pill ${item.is_active ? "active" : "inactive"}`}>
                          <span className="status-dot" />
                          {item.is_active ? "Active Brand Logo" : "Paused / Inactive"}
                        </span>
                      </div>
                      <h3 className="admin-item-title">{item.title}</h3>
                      <p className="admin-item-subtitle">{item.subtitle || "Primary Brand Asset"}</p>
                      <span className="admin-item-id-tag">ID: {item.id}</span>

                      <div className="admin-item-actions-row" style={{ marginTop: "var(--s3)" }}>
                        <button
                          type="button"
                          className="item-action-btn toggle-btn"
                          onClick={() => handleToggle(item)}
                          disabled={busy}
                          title={item.is_active ? "Pause brand logo" : "Activate brand logo"}
                        >
                          <span className="item-action-icon">{item.is_active ? "⏸" : "▶"}</span>
                          <span>{item.is_active ? "Pause" : "Activate"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
