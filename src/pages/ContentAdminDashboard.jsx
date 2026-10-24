import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../ui";
import FileOrUrlInput from "../components/FileOrUrlInput";
import { parseVideoUrl } from "../utils/video";

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
  duration_seconds: 5,
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

const DEFAULT_BRANDING_FORM = {
  id: "logo-primary",
  type: "branding",
  title: "Sunshine ReSTOR Official Logo",
  subtitle: "Primary Brand Asset",
  image_url: "/img/logo.webp",
  file_url: "",
  video_url: "",
  link_url: "/",
  bg_color: "#ffffff",
  display_order: 1,
  is_active: true,
  metadata: {},
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
  const [brandingForm, setBrandingForm] = useState(DEFAULT_BRANDING_FORM);
  const [editingId, setEditingId] = useState(null);

  // Admin Session State (In-memory only, never persisted in localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  });

  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    if (!adminKeyInput.trim()) {
      setAuthError("Please enter the Admin Security Key.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey: adminKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.token) {
        throw new Error(data.message || data.error || "Authentication failed. Check your key.");
      }
      setAdminToken(data.token);
      setAdminKeyInput("");
      setShowAuthModal(false);
      notify("✓ Administrative session unlocked (valid for 1 hour).");
    } catch (err) {
      setAuthError(err.message || "Failed to authenticate administrator.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    notify("Admin session locked. Mutation operations are now protected.");
  };

  const handleAuthRequired = () => {
    setAdminToken(null);
    setShowAuthModal(true);
    setError("Administrative authentication required. Please unlock with your Admin Key.");
  };

  // Global Slider Settings
  const [globalInterval, setGlobalInterval] = useState(5);
  const [globalAutoplay, setGlobalAutoplay] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const notify = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4500);
  };

  const fetchSliderSettings = async () => {
    try {
      const res = await fetch("/api/content?scope=slider_settings");
      const data = await res.json();
      if (data?.ok && data.settings) {
        setGlobalInterval(Number(data.settings.autoplay_interval) || 5);
        setGlobalAutoplay(data.settings.autoplay_enabled !== false);
      }
    } catch {}
  };

  const handleSaveGlobalSettings = async () => {
    if (!adminToken) {
      setShowAuthModal(true);
      return;
    }
    try {
      setSettingsSaving(true);
      const res = await fetch("/api/content?scope=slider_settings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          autoplay_interval: globalInterval,
          autoplay_enabled: globalAutoplay,
          pause_on_hover: true,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthRequired();
        return;
      }
      if (data.ok) {
        await refreshLiveCache();
        notify(`✓ Carousel rotation speed updated to ${globalInterval}s per slide!`);
      } else {
        throw new Error(data.error || "Failed to update carousel settings");
      }
    } catch (err) {
      setError(err.message || "Failed to update carousel settings");
    } finally {
      setSettingsSaving(false);
    }
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
    fetchSliderSettings();
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
    if (!adminToken) {
      setShowAuthModal(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/content?action=toggle&id=${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthRequired();
        return;
      }
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
    if (!adminToken) {
      setShowAuthModal(true);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${item.title}" from Supabase? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/content?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthRequired();
        return;
      }
      if (data.ok) {
        if (editingId === item.id) {
          setEditingId(null);
          setBannerForm(DEFAULT_BANNER_FORM);
          setSchemeForm(DEFAULT_SCHEME_FORM);
          setBrandingForm(DEFAULT_BRANDING_FORM);
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
      duration_seconds: Number(item.metadata?.duration_seconds) || 5,
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

  const startEditBranding = (item) => {
    setEditingId(item.id);
    setBrandingForm({
      id: item.id,
      type: "branding",
      title: item.title || "",
      subtitle: item.subtitle || "Primary Brand Asset",
      image_url: item.image_url || "",
      file_url: item.file_url || "",
      video_url: item.video_url || "",
      link_url: item.link_url || "/",
      bg_color: item.bg_color || "#ffffff",
      display_order: item.display_order || 1,
      is_active: item.is_active !== false,
      metadata: item.metadata || {},
    });
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  // Submit Banner Form
  const saveBanner = async (e) => {
    e.preventDefault();
    if (!adminToken) {
      setShowAuthModal(true);
      return;
    }
    setBusy(true);
    setError("");

    const payload = {
      ...bannerForm,
      id: (bannerForm.id || `hero-${Date.now()}`).trim().toLowerCase().replace(/\s+/g, "-"),
      type: "hero_banner",
      display_order: Number(bannerForm.display_order) || 1,
      metadata: {
        ...(bannerForm.metadata || {}),
        duration_seconds: Math.max(2, Math.min(120, Number(bannerForm.duration_seconds) || 5)),
      },
    };

    if (!payload.title.trim()) {
      setError("Banner Title is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthRequired();
        return;
      }
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
    if (!adminToken) {
      setShowAuthModal(true);
      return;
    }
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
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthRequired();
        return;
      }
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

  // Submit Branding Form
  const saveBranding = async (e) => {
    e.preventDefault();
    if (!adminToken) {
      setShowAuthModal(true);
      return;
    }
    setBusy(true);
    setError("");

    const payload = {
      ...brandingForm,
      id: (brandingForm.id || "logo-primary").trim().toLowerCase().replace(/\s+/g, "-"),
      type: "branding",
      display_order: Number(brandingForm.display_order) || 1,
    };

    if (!payload.title.trim()) {
      setError("Brand Asset Title is required.");
      setBusy(false);
      return;
    }

    if (!payload.image_url) {
      setError("Brand Logo Image is required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 401) {
        handleAuthRequired();
        return;
      }
      if (data.ok) {
        setEditingId(null);
        await refreshLiveCache();
        notify(`✓ Brand Logo "${payload.title}" saved & updated across the storefront!`);
      } else {
        throw new Error(data.error || "Failed to save brand asset");
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
            {adminToken ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#166534", fontSize: "0.82rem", fontWeight: 700 }}>
                <span>🟢 Admin Session Active</span>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  style={{ background: "transparent", border: "none", color: "#b91c1c", cursor: "pointer", fontWeight: 700, textDecoration: "underline", padding: 0 }}
                >
                  Lock
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-navy"
                onClick={() => { setShowAuthModal(true); setAuthError(""); }}
                style={{ background: "#0110a7", color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Icon name="lock" size={15} />
                <span>Unlock Admin Controls</span>
              </button>
            )}

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

        {/* Admin Unlock Modal */}
        {showAuthModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(16, 38, 58, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 20,
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "28px 24px",
                maxWidth: 440,
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", color: "#0110a7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="lock" size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#10263a" }}>Admin Operations Locked</h3>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>Enter your security key to unlock mutations and uploads.</p>
                </div>
              </div>

              {authError && (
                <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: "0.82rem", marginBottom: 14 }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAdminLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="admin-key-field" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Admin Security Key
                  </label>
                  <input
                    id="admin-key-field"
                    type="password"
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    placeholder="Enter ADMIN_API_KEY..."
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                    }}
                  />
                  <small style={{ display: "block", marginTop: 4, fontSize: "0.74rem", color: "#64748b" }}>
                    Issues a 1-hour short-lived in-memory session. Never saved to disk or browser storage.
                  </small>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setShowAuthModal(false); setAuthError(""); setAdminKeyInput(""); }}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={authBusy || !adminKeyInput.trim()}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0110a7", color: "#ffffff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", opacity: authBusy || !adminKeyInput.trim() ? 0.6 : 1 }}
                  >
                    {authBusy ? "Authenticating…" : "Unlock Session"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <label htmlFor="b-duration" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      Slide Rotation Duration (Seconds) *
                    </label>
                    <span style={{ fontSize: "0.82rem", color: "var(--c-brand)", fontWeight: 700 }}>
                      ⏱️ {bannerForm.duration_seconds || 5}s on screen
                    </span>
                  </div>
                  <input
                    id="b-duration"
                    type="number"
                    min="2"
                    max="120"
                    step="1"
                    value={bannerForm.duration_seconds || 5}
                    onChange={(e) =>
                      setBannerForm({
                        ...bannerForm,
                        duration_seconds: Math.max(2, Math.min(120, Number(e.target.value) || 5)),
                      })
                    }
                  />
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                    {[
                      { label: "3s (Fast)", sec: 3 },
                      { label: "5s (Default)", sec: 5 },
                      { label: "8s (Image)", sec: 8 },
                      { label: "12s", sec: 12 },
                      { label: "15s (Video)", sec: 15 },
                      { label: "20s (Long Video)", sec: 20 },
                      { label: "30s", sec: 30 },
                    ].map((preset) => (
                      <button
                        key={preset.sec}
                        type="button"
                        className="chip-btn"
                        style={{
                          fontSize: "0.75rem",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border:
                            (bannerForm.duration_seconds || 5) === preset.sec
                              ? "1.5px solid var(--c-brand)"
                              : "1px solid var(--line, #cbd5e1)",
                          background:
                            (bannerForm.duration_seconds || 5) === preset.sec
                              ? "rgba(1, 16, 167, 0.12)"
                              : "var(--bg-sub, #f8fafc)",
                          color:
                            (bannerForm.duration_seconds || 5) === preset.sec
                              ? "var(--c-brand)"
                              : "var(--c-text)",
                          fontWeight: (bannerForm.duration_seconds || 5) === preset.sec ? 700 : 500,
                          cursor: "pointer",
                        }}
                        onClick={() => setBannerForm({ ...bannerForm, duration_seconds: preset.sec })}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <small className="field-hint">
                    How many seconds this slide remains visible before rotating to the next. Video slides typically need 12s–20s.
                  </small>
                </div>

                <div className="field-group">
                  <FileOrUrlInput
                    id="b-img"
                    label="Banner Image"
                    value={bannerForm.image_url || ""}
                    onChange={(url) => setBannerForm({ ...bannerForm, image_url: url })}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    folder="hero-banners"
                    fileTypeLabel="Banner Image"
                    required={!bannerForm.video_url}
                    adminToken={adminToken}
                    onRequireAuth={() => setShowAuthModal(true)}
                    presets={[
                      { label: "01_Hero_Banner_Image.jpg", url: "/img/01_Hero_Banner_Image.jpg" },
                      { label: "1st.jpeg", url: "/img/1st.jpeg" },
                      { label: "2nd.jpeg", url: "/img/2nd.jpeg" },
                      { label: "3rd.jpeg", url: "/img/3rd.jpeg" },
                    ]}
                    helperText="Upload from your device via drag & drop, browse folders, or paste an online URL."
                  />
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
                  <FileOrUrlInput
                    id="b-video"
                    label="Video Asset (YouTube, Vimeo, Google Drive, or MP4 Upload)"
                    value={bannerForm.video_url || ""}
                    onChange={(url) => setBannerForm({ ...bannerForm, video_url: url })}
                    accept="video/mp4,video/webm"
                    folder="hero-banners"
                    fileTypeLabel="Video Asset"
                    previewType="video"
                    adminToken={adminToken}
                    onRequireAuth={() => setShowAuthModal(true)}
                    helperText="Paste any YouTube URL (e.g. youtube.com/watch?v=...), Vimeo, Google Drive link, or upload an MP4/WebM video file."
                  />
                </div>

                {/* Video Live Preview Stage */}
                {bannerForm.video_url && (() => {
                  const parsed = parseVideoUrl(bannerForm.video_url);
                  if (!parsed) return null;
                  return (
                    <div className="preview-stage-wrap" style={{ marginTop: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span className="preview-stage-lbl" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "#10b981", fontSize: "1.1rem" }}>●</span> Video Live Preview ({parsed.provider})
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--c-sub)", background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: "999px", fontWeight: 600 }}>
                          {parsed.type.toUpperCase()}
                        </span>
                      </div>
                      <div
                        className="banner-preview-box"
                        style={{
                          background: "#000",
                          height: 220,
                          position: "relative",
                          overflow: "hidden",
                          borderRadius: "10px",
                          border: "1px solid rgba(0,0,0,0.15)",
                        }}
                      >
                        {parsed.type === "youtube" || parsed.type === "vimeo" || parsed.type === "drive" ? (
                          <iframe
                            src={parsed.embedUrl}
                            title="Admin Video Preview"
                            style={{ width: "100%", height: "100%", border: "none" }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={parsed.src}
                            controls
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}

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

              {/* Global Carousel Speed & Autoplay Controls */}
              <div
                style={{
                  background: "var(--surface, #ffffff)",
                  border: "1px solid var(--line, #e2e8f0)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  marginBottom: "16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--c-sub)" }}>
                      GLOBAL ROTATION SPEED
                    </span>
                    <h4 style={{ margin: "1px 0 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--c-text)" }}>
                      Carousel Autoplay & Timing
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="btn btn-navy"
                    disabled={busy || settingsSaving}
                    onClick={handleSaveGlobalSettings}
                    style={{ padding: "5px 12px", fontSize: "0.78rem", minHeight: 32 }}
                  >
                    <Icon name="check" size={13} />
                    <span>{settingsSaving ? "Saving…" : "Save Speed Settings"}</span>
                  </button>
                </div>

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--c-text)" }}>
                      Default Slide Duration:
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={globalInterval}
                      onChange={(e) => setGlobalInterval(Math.max(2, Math.min(60, Number(e.target.value) || 5)))}
                      style={{ width: "65px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)", textAlign: "center", fontWeight: 700 }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--c-sub)" }}>sec</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setGlobalAutoplay(true)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: globalAutoplay ? "1.5px solid var(--c-brand)" : "1px solid var(--line)",
                        background: globalAutoplay ? "rgba(1, 16, 167, 0.08)" : "#f8fafc",
                        color: globalAutoplay ? "var(--c-brand)" : "var(--c-sub)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ▶ Auto-Slide Loop
                    </button>
                    <button
                      type="button"
                      onClick={() => setGlobalAutoplay(false)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: !globalAutoplay ? "1.5px solid var(--c-brand)" : "1px solid var(--line)",
                        background: !globalAutoplay ? "rgba(1, 16, 167, 0.08)" : "#f8fafc",
                        color: !globalAutoplay ? "var(--c-brand)" : "var(--c-sub)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ⏸ Manual Swipes Only
                    </button>
                  </div>
                </div>
              </div>

              {heroBanners.length === 0 ? (
                <div className="empty-content-state">
                  <Icon name="image" size={36} />
                  <p>No banners found in Supabase. Add your first hero slide using the form on the left!</p>
                </div>
              ) : (
                <div className="admin-items-list">
                  {heroBanners.map((item, idx) => {
                    const parsedVid = item.video_url ? parseVideoUrl(item.video_url) : null;
                    const thumb = item.image_url || parsedVid?.thumbnail;

                    return (
                      <div
                        key={item.id}
                        className={`admin-item-card ${editingId === item.id ? "is-editing" : ""} ${!item.is_active ? "is-inactive" : ""}`}
                      >
                        <div className="admin-item-thumb-box" style={{ background: item.bg_color || "#0110a7" }}>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <Icon name={parsedVid ? "play" : "image"} size={24} style={{ color: "rgba(255,255,255,0.7)" }} />
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
                            <span className="detail-tag" style={{ background: "rgba(1, 16, 167, 0.08)", color: "#0110a7", fontWeight: 600 }}>
                              ⏱️ {item.metadata?.duration_seconds || 5}s slide
                            </span>
                            {item.video_url && (
                              <span className="detail-tag video-tag" style={{ background: "rgba(220, 38, 38, 0.08)", color: "#dc2626", fontWeight: 600 }}>
                                🎬 {parsedVid?.provider || "Video"}
                              </span>
                            )}
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
                  );
                })}
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
                  <FileOrUrlInput
                    id="s-img"
                    label="Scheme Flyer Image"
                    value={schemeForm.image_url || ""}
                    onChange={(url) => setSchemeForm({ ...schemeForm, image_url: url })}
                    accept="image/png,image/jpeg,image/webp"
                    folder="schemes"
                    fileTypeLabel="Flyer Image"
                    required
                    adminToken={adminToken}
                    onRequireAuth={() => setShowAuthModal(true)}
                    presets={[
                      { label: "02_Scheme_Flyer_Image.jpg", url: "/img/02_Scheme_Flyer_Image.jpg" },
                      { label: "scheme-annual-business-2026.jpg", url: "/img/scheme-annual-business-2026.jpg" },
                    ]}
                    helperText="Upload promotional scheme flyer from your device via drag & drop or browse."
                  />
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

                <div className="field-group">
                  <FileOrUrlInput
                    id="s-pdf"
                    label="Official Circular Document (PDF)"
                    value={schemeForm.file_url || ""}
                    onChange={(url, meta) => {
                      const newMeta = { ...schemeForm.metadata };
                      if (meta?.originalName) {
                        newMeta.pdf_filename = meta.originalName;
                      }
                      setSchemeForm({
                        ...schemeForm,
                        file_url: url,
                        metadata: newMeta,
                      });
                    }}
                    accept=".pdf,application/pdf"
                    folder="circulars"
                    fileTypeLabel="PDF Document"
                    previewType="pdf"
                    adminToken={adminToken}
                    onRequireAuth={() => setShowAuthModal(true)}
                    presets={[
                      { label: "03_Scheme_Official_Circular.pdf", url: "/downloads/03_Scheme_Official_Circular.pdf" },
                    ]}
                    helperText="Drag & drop PDF from your computer or browse. Auto-fills the download filename below."
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
                  <small className="field-hint">The filename dealers see when downloading the circular.</small>
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
            {/* Left Column: Branding Form Editor */}
            <div className="content-card form-card">
              <div className="content-card-head">
                <div className="card-head-title-wrap">
                  <span className="card-eyebrow">
                    {editingId ? "EDITING BRAND ASSET" : "BRAND LOGO & GRAPHICS"}
                  </span>
                  <h2 className="card-main-heading">
                    {editingId ? "Update Brand Asset" : "Brand Logo Configuration"}
                  </h2>
                </div>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setEditingId(null);
                      setBrandingForm(DEFAULT_BRANDING_FORM);
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={saveBranding} className="content-admin-form">
                <div className="field-group">
                  <label htmlFor="br-title">Asset Title / Name *</label>
                  <input
                    id="br-title"
                    type="text"
                    required
                    placeholder="e.g. Sunshine ReSTOR Official Logo"
                    value={brandingForm.title}
                    onChange={(e) => setBrandingForm({ ...brandingForm, title: e.target.value })}
                  />
                </div>

                <div className="form-two-cols">
                  <div className="field-group">
                    <label htmlFor="br-id">Asset Identifier (ID)</label>
                    <input
                      id="br-id"
                      type="text"
                      placeholder="e.g. logo-primary"
                      value={brandingForm.id}
                      onChange={(e) => setBrandingForm({ ...brandingForm, id: e.target.value })}
                    />
                    <small className="field-hint">Use "logo-primary" for main header logo.</small>
                  </div>

                  <div className="field-group">
                    <label htmlFor="br-sub">Asset Note / Subtitle</label>
                    <input
                      id="br-sub"
                      type="text"
                      placeholder="e.g. Primary Brand Asset"
                      value={brandingForm.subtitle}
                      onChange={(e) => setBrandingForm({ ...brandingForm, subtitle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <FileOrUrlInput
                    id="br-img"
                    label="Brand Logo Asset"
                    value={brandingForm.image_url || ""}
                    onChange={(url) => setBrandingForm({ ...brandingForm, image_url: url })}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    folder="branding"
                    fileTypeLabel="Brand Logo"
                    required
                    adminToken={adminToken}
                    onRequireAuth={() => setShowAuthModal(true)}
                    presets={[
                      { label: "logo.webp", url: "/img/logo.webp" },
                      { label: "logo.png", url: "/img/logo.png" },
                    ]}
                    helperText="Upload transparent PNG, WebP or SVG from device via drag & drop, or paste an online URL."
                  />
                </div>

                {brandingForm.image_url && (
                  <div className="preview-stage-wrap">
                    <span className="preview-stage-lbl">Logo Live Preview</span>
                    <div className="banner-preview-box" style={{ background: "#ffffff", height: 100, border: "1px solid var(--line)" }}>
                      <img
                        src={brandingForm.image_url}
                        alt="Logo Preview"
                        style={{ maxHeight: 60 }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="field-group">
                  <label htmlFor="br-link">Click Navigation URL</label>
                  <input
                    id="br-link"
                    type="text"
                    placeholder="e.g. /"
                    value={brandingForm.link_url || "/"}
                    onChange={(e) => setBrandingForm({ ...brandingForm, link_url: e.target.value })}
                  />
                </div>

                <div className="toggle-checkbox-row">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={brandingForm.is_active}
                      onChange={(e) => setBrandingForm({ ...brandingForm, is_active: e.target.checked })}
                    />
                    <span className="toggle-custom-box" />
                    <span className="toggle-text-wrap">
                      <b>Active & Visible on Storefront Navigation</b>
                      <small>When enabled, this logo replaces the default logo across all pages.</small>
                    </span>
                  </label>
                </div>

                <div className="form-action-bar">
                  <button type="submit" className="btn btn-navy" disabled={busy} style={{ width: "100%", minHeight: 48 }}>
                    <Icon name="check" size={17} />
                    <span>{editingId ? "Update Brand Asset in Supabase" : "Save Brand Asset to Supabase"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Existing Branding Assets List */}
            <div className="content-card list-card">
              <div className="content-card-head">
                <div>
                  <span className="card-eyebrow">GLOBAL BRAND ASSETS</span>
                  <h2 className="card-main-heading">Current Brand Assets ({brandingItems.length})</h2>
                </div>
              </div>

              {brandingItems.length === 0 ? (
                <div className="empty-content-state">
                  <Icon name="sparkle" size={36} />
                  <p>No brand assets found in Supabase. Configure your logo using the form!</p>
                </div>
              ) : (
                <div className="admin-items-list">
                  {brandingItems.map((item) => (
                    <div
                      key={item.id}
                      className={`admin-item-card ${editingId === item.id ? "is-editing" : ""} ${!item.is_active ? "is-inactive" : ""}`}
                    >
                      <div className="admin-item-thumb-box" style={{ background: "#ffffff" }}>
                        <img
                          src={item.image_url}
                          alt={item.title}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="admin-item-body">
                        <div className="admin-item-meta-top">
                          <span className={`status-pill ${item.is_active ? "active" : "inactive"}`}>
                            <span className="status-dot" />
                            {item.is_active ? "Active Brand Logo" : "Paused / Inactive"}
                          </span>
                          <span className="admin-item-id-tag">ID: {item.id}</span>
                        </div>
                        <h3 className="admin-item-title">{item.title}</h3>
                        <p className="admin-item-subtitle">{item.subtitle || "Primary Brand Asset"}</p>

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

                          <button
                            type="button"
                            className="item-action-btn edit-btn"
                            onClick={() => startEditBranding(item)}
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
      </div>
    </section>
  );
}
