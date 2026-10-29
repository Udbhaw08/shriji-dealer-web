import { useEffect, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useSession, revalidateSession, signOut } from "../data/session";
import {
  hasSession,
  staffList, staffApprove, staffHold, staffResume, staffRevoke, staffDelete,
  staffTogglePrice, staffTogglePriceAll,
  syncDealerWithCrm,
} from "../data/auth";

/* Dealer dashboard — Workspace modules, 2x2 Hub menu buttons, store identity,
 * live Zoho CRM sync, and comprehensive staff permissions management.
 */
export default function DealerDashboard() {
  const navigate = useNavigate();
  const s = useSession();
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedDealerCode, setCopiedDealerCode] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState("workspace"); // 'workspace' | 'staff'
  const [filter, setFilter] = useState("all"); // 'all' | 'pending' | 'active' | 'hold'
  const [activeModal, setActiveModal] = useState(null); // null | 'invite' | 'details' | 'manage'
  const [crmSyncing, setCrmSyncing] = useState(false);
  const [hideStaffDealerPrice, setHideStaffDealerPrice] = useState(
    Boolean(s.dealer?.hide_staff_dealer_price)
  );

  useEffect(() => {
    if (s.dealer && typeof s.dealer.hide_staff_dealer_price === "boolean") {
      setHideStaffDealerPrice(Boolean(s.dealer.hide_staff_dealer_price));
    }
  }, [s.dealer?.hide_staff_dealer_price]);

  const loadStaff = async (silent = false) => {
    try {
      const list = await staffList();
      setStaff(list);
      if (typeof list.hide_staff_dealer_price === "boolean") {
        setHideStaffDealerPrice(list.hide_staff_dealer_price);
      }
      if (!silent) setError("");
    } catch (err) {
      if (!silent) setError(err.message);
    }
  };

  // Initial load + live polling every 10s for incoming staff requests
  useEffect(() => {
    loadStaff();
    const interval = setInterval(() => {
      loadStaff(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const act = async (fn, userId, successText) => {
    setBusy(true);
    setError("");
    setActionSuccessMsg("");
    try {
      await fn(userId);
      await loadStaff();
      if (successText) {
        setActionSuccessMsg(successText);
        setTimeout(() => setActionSuccessMsg(""), 4500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStaffPrice = async (userId, enablePrice, staffName) => {
    setBusy(true);
    setError("");
    setActionSuccessMsg("");
    setStaff((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, can_see_dealer_price: enablePrice } : m))
    );
    try {
      await staffTogglePrice(userId, enablePrice);
      await revalidateSession(true);
      await loadStaff(true);
      const actionText = enablePrice
        ? `✓ Wholesale dealer price unlocked for ${staffName || "staff member"}.`
        : `✓ Wholesale dealer price hidden for ${staffName || "staff member"}. They will now only see retail MRP.`;
      setActionSuccessMsg(actionText);
      setTimeout(() => setActionSuccessMsg(""), 4500);
    } catch (err) {
      await loadStaff(true);
      setError(err.message || "Failed to update staff wholesale price visibility");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAllStaffPrices = async (enablePrice) => {
    // enablePrice === true  -> Unlock wholesale rates for staff (hide_staff_dealer_price: false)
    // enablePrice === false -> Hide wholesale rates for staff (hide_staff_dealer_price: true)
    const nextHidden = !enablePrice;
    setBusy(true);
    setError("");
    setActionSuccessMsg("");
    setHideStaffDealerPrice(nextHidden);
    try {
      await staffTogglePriceAll(enablePrice);
      await revalidateSession(true);
      await loadStaff(true);
      const actionText = enablePrice
        ? "✓ Wholesale dealer pricing unlocked for all store staff members."
        : "✓ Wholesale dealer pricing hidden for all store staff. Staff now see retail MRP.";
      setActionSuccessMsg(actionText);
      setTimeout(() => setActionSuccessMsg(""), 4500);
    } catch (err) {
      setHideStaffDealerPrice(!nextHidden);
      setError(err.message || "Failed to update all staff wholesale price visibility");
    } finally {
      setBusy(false);
    }
  };

  const handleCrmSync = async () => {
    setCrmSyncing(true);
    setBusy(true);
    setActionSuccessMsg("");
    setError("");
    try {
      await syncDealerWithCrm();
      await revalidateSession();
      setActionSuccessMsg("✓ Successfully synced live Price List & account details from Zoho CRM!");
      setTimeout(() => setActionSuccessMsg(""), 4500);
    } catch (err) {
      setError(err.message || "Failed to sync with Zoho CRM");
    } finally {
      setBusy(false);
      setTimeout(() => setCrmSyncing(false), 600);
    }
  };

  const copyDealerCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedDealerCode(true);
      setTimeout(() => setCopiedDealerCode(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  if (s.authRole === "dealer_staff") {
    return <Navigate to="/staff" replace />;
  }

  // Smooth hydrating state while tokens exist: eliminates "Sign in" gate flash
  if (hasSession() && (s.role === "guest" || !s.dealer)) {
    return (
      <div className="dealer-ws-page" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ margin: "0 auto 16px", width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#1d4ed8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: 600 }}>Loading Dealer Workspace…</p>
        </div>
      </div>
    );
  }

  if (s.role === "dealer" && (s.status === "pending" || s.dealer?.status === "pending")) {
    return <Navigate to="/dealer/pending" replace />;
  }

  const isApprovedDealer = (s.role === "dealer" || s.role === "admin") && (s.status === "approved" || s.status === "active");

  if (!isApprovedDealer) {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 className="d2">Dealer Dashboard</h1>
          <p className="sub">This area is for approved dealers only.</p>
          <Link className="btn btn-navy" to="/login?needAuth=true">
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  const pendingStaff = staff.filter((m) => m.status === "pending");
  const activeStaff = staff.filter((m) => m.status === "active");
  const holdStaffList = staff.filter((m) => m.status === "hold");
  const filteredStaff = staff.filter((m) => {
    if (filter === "pending") return m.status === "pending";
    if (filter === "active") return m.status === "active";
    if (filter === "hold") return m.status === "hold";
    return true;
  });

  const storeInitial = (s.dealer?.name || "O").charAt(0).toUpperCase();
  const dealerCode = s.dealer?.dealer_code || "DE-BKV-8180";

  return (
    <div className="dealer-ws-page">
      {/* Top Fixed Header Bar */}
      <header className="dealer-ws-header">
        <div className="dealer-ws-header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link to="/products" className="dealer-ws-back-btn" aria-label="Go Back">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back_ios_new</span>
            </Link>
            <h1 className="dealer-ws-header-title">Dealer Workspace</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="dealer-ws-back-btn"
              onClick={() => loadStaff()}
              title="Refresh store data"
              disabled={busy}
            >
              <span className={`material-symbols-outlined ${crmSyncing ? "rotate-180" : ""}`} style={{ fontSize: 20 }}>
                refresh
              </span>
            </button>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                backgroundColor: "#10263a",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              }}
              title={`Store: ${s.dealer?.name || 'Dealership'}`}
            >
              {storeInitial}
            </div>
            <button
              type="button"
              className="dealer-ws-back-btn"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              title="Log Out of Dealership"
              aria-label="Log Out"
              style={{
                color: "var(--err, #dc2626)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                background: "#fef2f2",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                logout
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="dealer-ws-content">
        {/* Store Identity & Status Banner */}
        <section className="dealer-ws-card">
          <div className="dealer-identity-profile">
            <div className="dealer-identity-avatar-wrap">
              <div className="dealer-identity-avatar">
                <span>{storeInitial}</span>
              </div>
              <span className="dealer-identity-verified-badge" title="Verified Dealership">
                <span className="material-symbols-outlined fill-1" style={{ fontSize: 16, color: "#31618f" }}>
                  verified
                </span>
              </span>
            </div>

            <div className="dealer-identity-info">
              <div className="dealer-identity-name-row">
                <h2 className="dealer-identity-name">{s.dealer?.name || "ownershop"}</h2>
                <span className="dealer-verified-chip">
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: 12 }}>verified</span>
                  Verified Dealer
                </span>
              </div>
              <div className="dealer-contact-meta">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>call</span>
                  {s.dealer?.phone || s.phone || "+91 98765 43210"}
                </span>
                <span style={{ color: "#c4c6cd" }}>•</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>location_on</span>
                  {[s.dealer?.city, s.dealer?.state].filter(Boolean).join(", ") || s.dealer?.city || s.dealer?.address || "Location on File"}
                </span>
              </div>
            </div>
          </div>

          {/* GST Identification Box */}
          <div className="dealer-gst-box">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="dealer-gst-label">GST Identification</span>
              <span className="dealer-gst-value">
                GSTIN: {s.dealer?.gst_number || s.dealer?.gst_treatment || "27AJHPJ2192C1ZF"}
              </span>
            </div>
            <span className="material-symbols-outlined" style={{ color: "#31618f", fontSize: 22 }}>
              assignment
            </span>
          </div>

          {/* Dealer Code Strip with 1-Click Copy */}
          <div className="dealer-code-strip">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div className="dealer-code-icon-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>store</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="dealer-code-sublabel">Dealer Code</span>
                <span className="dealer-code-val" id="dealerCodeText">{dealerCode}</span>
              </div>
            </div>

            <button
              type="button"
              className="dealer-copy-btn"
              onClick={() => copyDealerCode(dealerCode)}
              id="copyCodeBtn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {copiedDealerCode ? "check" : "content_copy"}
              </span>
              <span>{copiedDealerCode ? "Copied!" : "Copy"}</span>
            </button>
          </div>
        </section>

        {/* Global Toast / Success Message */}
        {actionSuccessMsg && (
          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "1.5px solid #86efac",
              color: "#15803d",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 6px rgba(34,197,94,0.12)",
            }}
          >
            <span className="material-symbols-outlined fill-1" style={{ fontSize: 18 }}>check_circle</span>
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1.5px solid #fca5a5",
              color: "#b91c1c",
              padding: "10px 14px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Health & Onboarding Status Notification */}
        {pendingStaff.length > 0 ? (
          <div
            className="dealer-health-alert pending-alert"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setActiveTab("staff");
              setFilter("pending");
            }}
          >
            <div className="dealer-health-icon-wrap">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications_active</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="dealer-health-title" style={{ color: "#92400e" }}>
                {pendingStaff.length} Pending Staff Request{pendingStaff.length > 1 ? "s" : ""}
              </p>
              <p className="dealer-health-desc" style={{ color: "#b45309" }}>
                Entered Dealer Code <b>{dealerCode}</b>. Tap to authorize team access.
              </p>
            </div>
            <span className="material-symbols-outlined" style={{ color: "#d97706", fontSize: 20 }}>
              chevron_right
            </span>
          </div>
        ) : (
          <div className="dealer-health-alert">
            <div className="dealer-health-icon-wrap">
              <span className="material-symbols-outlined fill-1" style={{ fontSize: 20 }}>task_alt</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="dealer-health-title">Team Directory Up to Date</p>
              <p className="dealer-health-desc">0 pending staff requests awaiting authorization</p>
            </div>
          </div>
        )}

        {/* Segmented Tabs (Workspace Modules vs Store Staff) */}
        <div className="dealer-segmented-tabs">
          <button
            type="button"
            className={`dealer-segment-btn ${activeTab === "workspace" ? "active" : ""}`}
            onClick={() => setActiveTab("workspace")}
            id="tabWorkspaceBtn"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>grid_view</span>
            <span>Workspace Modules</span>
          </button>
          <button
            type="button"
            className={`dealer-segment-btn ${activeTab === "staff" ? "active" : ""}`}
            onClick={() => setActiveTab("staff")}
            id="tabStaffBtn"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>badge</span>
            <span>Store Staff</span>
            <span className="dealer-badge-count">{staff.length}</span>
          </button>
        </div>

        {/* TAB 1: WORKSPACE MODULES (Features the 2x2 Hub Menu Buttons) */}
        {activeTab === "workspace" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} id="tabContentWorkspace">
            {/* Primary Hub Actions (2x2 Grid) — Menu Buttons */}
            <div className="dealer-hub-grid">
              {/* Button 1: Team */}
              <button
                type="button"
                className="dealer-hub-card"
                onClick={() => setActiveTab("staff")}
                aria-label="View Store Team"
              >
                <div className="dealer-hub-top-row">
                  <div className="dealer-hub-icon-tile team-tile">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
                </div>
                <div className="dealer-hub-body">
                  <h4 className="dealer-hub-title">Team</h4>
                  <p className="dealer-hub-stat">
                    {activeStaff.length} Active • {pendingStaff.length} Pending
                  </p>
                  <p className="dealer-hub-desc">Permissions &amp; contacts</p>
                </div>
              </button>

              {/* Button 2: Invite Staff */}
              <button
                type="button"
                className="dealer-hub-card"
                onClick={() => setActiveModal("invite")}
                aria-label="Invite Staff"
              >
                <div className="dealer-hub-top-row">
                  <div className="dealer-hub-icon-tile invite-tile">
                    <span className="material-symbols-outlined">person_add</span>
                  </div>
                  <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
                </div>
                <div className="dealer-hub-body">
                  <h4 className="dealer-hub-title">Invite Staff</h4>
                  <p className="dealer-hub-stat">Store Code</p>
                  <p className="dealer-hub-desc">Add staff via Store Code</p>
                </div>
              </button>

              {/* Button 3: Store Details */}
              <button
                type="button"
                className="dealer-hub-card"
                onClick={() => setActiveModal("details")}
                aria-label="Store Details"
              >
                <div className="dealer-hub-top-row">
                  <div className="dealer-hub-icon-tile details-tile">
                    <span className="material-symbols-outlined">store</span>
                  </div>
                  <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
                </div>
                <div className="dealer-hub-body">
                  <h4 className="dealer-hub-title">Store Details</h4>
                  <p className="dealer-hub-stat">GST &amp; Pricing Tier</p>
                  <p className="dealer-hub-desc">Business info &amp; CRM sync</p>
                </div>
              </button>

              {/* Button 4: Manage Access */}
              <button
                type="button"
                className="dealer-hub-card"
                onClick={() => setActiveModal("manage")}
                aria-label="Manage Access"
                id="hubManageAccessBtn"
              >
                <div className="dealer-hub-top-row">
                  <div className="dealer-hub-icon-tile manage-tile">
                    <span className="material-symbols-outlined">admin_panel_settings</span>
                  </div>
                  <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
                </div>
                <div className="dealer-hub-body">
                  <h4 className="dealer-hub-title">Manage Access</h4>
                  <p className="dealer-hub-stat">
                    {hideStaffDealerPrice ? "Rates Hidden (MRP)" : "Rates Active"}
                  </p>
                  <p className="dealer-hub-desc">Dealer rates &amp; staff permissions</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: STORE STAFF (Team Members & Granular Access) */}
        {activeTab === "staff" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} id="tabContentStaff">
            {/* Filter Chips Bar */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`dealer-segment-btn ${filter === "all" ? "active" : ""}`}
                style={{ flex: "none", padding: "6px 14px", height: 34, borderRadius: 9999, border: "1px solid #e0e3e6" }}
                onClick={() => setFilter("all")}
              >
                All ({staff.length})
              </button>
              <button
                type="button"
                className={`dealer-segment-btn ${filter === "pending" ? "active" : ""}`}
                style={{ flex: "none", padding: "6px 14px", height: 34, borderRadius: 9999, border: "1px solid #e0e3e6" }}
                onClick={() => setFilter("pending")}
              >
                Pending ({pendingStaff.length})
              </button>
              <button
                type="button"
                className={`dealer-segment-btn ${filter === "active" ? "active" : ""}`}
                style={{ flex: "none", padding: "6px 14px", height: 34, borderRadius: 9999, border: "1px solid #e0e3e6" }}
                onClick={() => setFilter("active")}
              >
                Active ({activeStaff.length})
              </button>
              <button
                type="button"
                className={`dealer-segment-btn ${filter === "hold" ? "active" : ""}`}
                style={{ flex: "none", padding: "6px 14px", height: 34, borderRadius: 9999, border: "1px solid #e0e3e6" }}
                onClick={() => setFilter("hold")}
              >
                On Hold ({holdStaffList.length})
              </button>
            </div>

            {filteredStaff.length === 0 ? (
              <div className="dealer-ws-card" style={{ textAlign: "center", padding: "32px 16px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 40, color: "#74777d" }}>
                  group_off
                </span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#001021", margin: "8px 0 4px" }}>
                  {filter === "all" ? "No team members registered yet" : `No staff members in "${filter}" status`}
                </p>
                <p style={{ fontSize: 13, color: "#43474c", margin: 0 }}>
                  Share your Store Code <b>{dealerCode}</b> with counter staff to let them register.
                </p>
                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="dealer-copy-btn"
                    style={{ margin: "0 auto" }}
                    onClick={() => setActiveModal("invite")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                    <span>Invite via Store Code</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {filteredStaff.map((m) => {
                  const initial = (m.full_name || m.phone || "S").charAt(0).toUpperCase();
                  const isPriceVisible = m.can_see_dealer_price !== false && !s.dealer?.hide_staff_dealer_price;

                  return (
                    <div key={m.id} className="dealer-staff-card">
                      {/* Staff Header */}
                      <div className="dealer-staff-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div className="dealer-staff-avatar">{initial}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 16, fontWeight: 700, color: "#001021" }}>
                                {m.full_name || "Staff Member"}
                              </span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "1px 8px",
                                  borderRadius: 9999,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  backgroundColor: m.status === "active" ? "#eaf8f0" : m.status === "pending" ? "#fff8eb" : "#f1f5f9",
                                  color: m.status === "active" ? "#16834a" : m.status === "pending" ? "#c98616" : "#475569",
                                }}
                              >
                                {m.status === "active" ? "Active" : m.status === "pending" ? "Pending" : m.status === "hold" ? "On Hold" : m.status}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, color: "#43474c", margin: "2px 0 0" }}>
                              {m.phone || m.email || "No direct phone"}
                            </p>
                          </div>
                        </div>

                        {/* Price Badge */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: isPriceVisible ? "#eceef1" : "#e6e8eb",
                            color: isPriceVisible ? "#31618f" : "#43474c",
                            flexShrink: 0,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                            {isPriceVisible ? "visibility" : "lock"}
                          </span>
                          <span>{isPriceVisible ? "Price Visible" : "Price Hidden"}</span>
                        </span>
                      </div>

                      {/* Meta Info Row */}
                      <div className="dealer-gst-box" style={{ fontSize: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#43474c" }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>event</span>
                          Joined: {new Date(m.created_at).toLocaleDateString()}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#31618f", fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>link</span>
                          Synced CRM
                        </span>
                      </div>

                      {/* Primary Actions Grid */}
                      <div className="dealer-staff-action-grid">
                        {m.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              className="dealer-staff-btn-primary"
                              disabled={busy}
                              onClick={() => act(staffApprove, m.id, `✓ Approved access for ${m.full_name || m.phone}!`)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                              <span>Approve Access</span>
                            </button>
                            <button
                              type="button"
                              className="dealer-staff-btn-secondary"
                              disabled={busy}
                              onClick={() => act(staffRevoke, m.id, `✕ Rejected request from ${m.full_name || m.phone}`)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Wholesale Price Visibility Toggle */}
                            <button
                              type="button"
                              className={isPriceVisible ? "dealer-staff-btn-secondary" : "dealer-staff-btn-primary"}
                              disabled={busy}
                              onClick={() => handleToggleStaffPrice(m.id, !isPriceVisible, m.full_name || m.phone)}
                              title={isPriceVisible ? "Hide dealer wholesale price for this staff member" : "Show dealer wholesale price to this staff member"}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                {isPriceVisible ? "visibility_off" : "visibility"}
                              </span>
                              <span>{isPriceVisible ? "Hide Rate" : "Show Rate"}</span>
                            </button>

                            {/* Account Hold / Resume Toggle */}
                            {m.status === "active" ? (
                              <button
                                type="button"
                                className="dealer-staff-btn-secondary"
                                disabled={busy}
                                onClick={() => act(staffHold, m.id, `⏸ Placed ${m.full_name || m.phone} on hold.`)}
                                title="Temporarily pause staff access"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>pause_circle</span>
                                <span>Put on Hold</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="dealer-staff-btn-primary"
                                disabled={busy}
                                onClick={() => act(staffResume, m.id, `▶ Resumed access for ${m.full_name || m.phone}.`)}
                                title="Resume staff access"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_circle</span>
                                <span>Resume Access</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Sub-actions Row (Manage Store Access & Inactivate) */}
                      {m.status !== "pending" && (
                        <div className="dealer-staff-footer-row">
                          <button
                            type="button"
                            className="dealer-staff-footer-btn"
                            onClick={() => setActiveModal("manage")}
                            title="Open Store Access controls"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>admin_panel_settings</span>
                            <span>Store Access Rules</span>
                          </button>

                          <button
                            type="button"
                            className="dealer-staff-footer-btn btn-error"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to deactivate ${m.full_name || m.phone}? They will lose access to wholesale pricing.`)) {
                                act(staffDelete, m.id, `✕ Marked ${m.full_name || m.phone} as inactive.`);
                              }
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>person_off</span>
                            <span>Inactivate Staff</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>


      {/* MODAL 1: INVITE STAFF MODAL */}
      {activeModal === "invite" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">Invite Staff Member</h3>
                <p className="dealer-modal-subtitle">
                  Share your official Store Code with staff to register.
                </p>
              </div>
              <button
                type="button"
                className="dealer-modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Store Code Card */}
            <div className="dealer-gst-box" style={{ padding: "14px 16px" }}>
              <div>
                <span className="dealer-gst-label">Official Store Code</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#001021", letterSpacing: "0.08em" }}>
                  {dealerCode}
                </span>
              </div>
              <button
                type="button"
                className="dealer-copy-btn"
                onClick={() => copyDealerCode(dealerCode)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {copiedDealerCode ? "check" : "content_copy"}
                </span>
                <span>{copiedDealerCode ? "Copied" : "Copy Code"}</span>
              </button>
            </div>

            {/* WhatsApp Share Button (Strictly Store Code, no registration links) */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Store Code for Sunshine B2B Staff Registration: ${dealerCode}. Please enter this Store Code when registering your staff account.`)}`}
              target="_blank"
              rel="noreferrer"
              className="dealer-staff-btn-primary"
              style={{ backgroundColor: "#25D366", color: "#ffffff", textDecoration: "none" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>share</span>
              <span>Share Store Code via WhatsApp</span>
            </a>

            {/* Audit & Security Protocol Guidance */}
            <div style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#001021" }}>verified_user</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#001021" }}>Audit &amp; Security Protocol</span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.5 }}>
                Staff members register exclusively using your official Store Code. No bypass links or temporary relief passes are permitted. All registrations require your manual review and approval under <strong>Pending Approvals</strong> before granting access to wholesale rates.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: STORE DETAILS MODAL */}
      {activeModal === "details" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">Store &amp; Account Details</h3>
                <p className="dealer-modal-subtitle">
                  Synchronized live with Zoho CRM (Accounts &amp; Price Lists).
                </p>
              </div>
              <button
                type="button"
                className="dealer-modal-close-btn"
                onClick={() => setActiveModal(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="dealer-gst-box">
                <div>
                  <span className="dealer-gst-label">Dealership Legal Name</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#001021" }}>
                    {s.dealer?.name || "ownershop"}
                  </span>
                </div>
                <span className="material-symbols-outlined" style={{ color: "#31618f" }}>verified</span>
              </div>

              <div className="dealer-gst-box">
                <div>
                  <span className="dealer-gst-label">Wholesale Price Tier</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#001021" }}>
                    {s.dealer?.price_tier || "MH Dist Basic Oct 2026"}
                  </span>
                </div>
                <span className="material-symbols-outlined" style={{ color: "#31618f" }}>payments</span>
              </div>

              <div className="dealer-gst-box">
                <div>
                  <span className="dealer-gst-label">GSTIN / Tax ID</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#001021" }}>
                    {s.dealer?.gst_number || "27AJHPJ2192C1ZF"}
                  </span>
                </div>
                <span className="material-symbols-outlined" style={{ color: "#31618f" }}>receipt_long</span>
              </div>

              <div className="dealer-gst-box">
                <div>
                  <span className="dealer-gst-label">GST Treatment</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#001021" }}>
                    {s.dealer?.gst_treatment || "Registered Business - Regular"}
                  </span>
                </div>
                <span className="material-symbols-outlined" style={{ color: "#31618f" }}>domain</span>
              </div>
            </div>

            {/* CRM Live Sync Button */}
            <button
              type="button"
              className="dealer-staff-btn-primary"
              onClick={handleCrmSync}
              disabled={busy}
            >
              <span className={`material-symbols-outlined ${crmSyncing ? "rotate-180" : ""}`} style={{ fontSize: 18 }}>
                sync
              </span>
              <span>{crmSyncing ? "Syncing with Zoho CRM…" : "Sync Live with Zoho CRM"}</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: MANAGE ACCESS MODAL */}
      {activeModal === "manage" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">Manage Store Access</h3>
                <p className="dealer-modal-subtitle">
                  Control wholesale dealer rates visibility and staff member permissions.
                </p>
              </div>
              <button
                type="button"
                className="dealer-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* 1. Master Storewide Dealer Rates Visibility Card */}
            <div className="dealer-manage-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: hideStaffDealerPrice ? "#fef3c7" : "#d0e4ff",
                      color: hideStaffDealerPrice ? "#b45309" : "#1d4ed8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                      {hideStaffDealerPrice ? "visibility_off" : "storefront"}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#001021", margin: 0 }}>
                      Storewide Wholesale Rates
                    </p>
                    <p style={{ fontSize: 12, color: "#43474c", margin: "2px 0 0" }}>
                      {hideStaffDealerPrice ? "Staff view retail MRP only" : "Visible to authorized team members"}
                    </p>
                  </div>
                </div>

                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: hideStaffDealerPrice ? "#fef3c7" : "#dcfce7",
                    color: hideStaffDealerPrice ? "#b45309" : "#15803d",
                    flexShrink: 0,
                  }}
                >
                  {hideStaffDealerPrice ? "Rates Hidden" : "Rates Active"}
                </span>
              </div>

              <p style={{ fontSize: 12.5, lineHeight: "18px", color: "#43474c", margin: 0 }}>
                Hide wholesale rates for all staff when using the portal at the sales counter. Staff will browse with retail MRP, protecting wholesale margins in front of walk-in customers.
              </p>

              <button
                type="button"
                className={hideStaffDealerPrice ? "dealer-staff-btn-primary" : "dealer-storewide-btn"}
                style={{
                  minHeight: 44,
                  width: "100%",
                  fontWeight: 700,
                  backgroundColor: hideStaffDealerPrice ? "#001021" : "#e6e8eb",
                  color: hideStaffDealerPrice ? "#ffffff" : "#001021",
                }}
                onClick={() => handleToggleAllStaffPrices(hideStaffDealerPrice)}
                disabled={busy}
                id="toggleStorewidePriceBtn"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19 }}>
                  {hideStaffDealerPrice ? "visibility" : "visibility_off"}
                </span>
                <span>
                  {hideStaffDealerPrice ? "Make Rates Visible to All Staff" : "Hide Rates for All Staff"}
                </span>
              </button>
            </div>

            {/* 2. Team Member Permissions & Access Controls (Hold/Resume, Individual Rates) */}
            <div className="dealer-manage-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#001021", margin: 0 }}>
                    Team Member Permissions
                  </h4>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                    Manage counter staff access, hold accounts, and set rate visibility
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#31618f",
                    backgroundColor: "#eceef1",
                    padding: "2px 8px",
                    borderRadius: 9999,
                  }}
                >
                  {staff.length} {staff.length === 1 ? "Member" : "Members"}
                </span>
              </div>

              {staff.filter((m) => m.status !== "pending").length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 8px", background: "#ffffff", borderRadius: 10, border: "1px dashed #cbd5e1" }}>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                    No approved staff members yet.
                  </p>
                  <button
                    type="button"
                    className="dealer-manage-pill-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      setActiveModal("invite");
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                    <span>Invite Store Staff</span>
                  </button>
                </div>
              ) : (
                <div className="dealer-manage-staff-list">
                  {staff.filter((m) => m.status !== "pending").map((m) => {
                    const isStaffPriceOn = m.can_see_dealer_price !== false && !hideStaffDealerPrice;
                    const isHold = m.status === "hold";

                    return (
                      <div key={m.id} className="dealer-manage-staff-item">
                        <div className="dealer-manage-staff-row">
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#001021", display: "block" }}>
                              {m.full_name || "Staff Member"}
                            </span>
                            <span style={{ fontSize: 11.5, color: "#64748b" }}>
                              {m.phone || m.email || "No direct phone"}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span
                              style={{
                                padding: "1px 7px",
                                borderRadius: 9999,
                                fontSize: 10,
                                fontWeight: 700,
                                backgroundColor: isHold ? "#fff7ed" : "#f0fdf4",
                                color: isHold ? "#c2410c" : "#15803d",
                              }}
                            >
                              {isHold ? "On Hold" : "Active"}
                            </span>
                            <span
                              style={{
                                padding: "1px 7px",
                                borderRadius: 9999,
                                fontSize: 10,
                                fontWeight: 700,
                                backgroundColor: isStaffPriceOn ? "#eff6ff" : "#f1f5f9",
                                color: isStaffPriceOn ? "#1d4ed8" : "#64748b",
                              }}
                            >
                              {isStaffPriceOn ? "Rate Visible" : "Rate Hidden"}
                            </span>
                          </div>
                        </div>

                        <div className="dealer-manage-staff-btns">
                          {/* Hold / Resume Access */}
                          {m.status === "active" ? (
                            <button
                              type="button"
                              className="dealer-manage-pill-btn btn-hold"
                              disabled={busy}
                              onClick={() => act(staffHold, m.id, `⏸ Placed ${m.full_name || m.phone} on hold.`)}
                              title="Pause this team member's access"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>pause_circle</span>
                              <span>Put on Hold</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dealer-manage-pill-btn btn-active"
                              disabled={busy}
                              onClick={() => act(staffResume, m.id, `▶ Resumed access for ${m.full_name || m.phone}.`)}
                              title="Resume staff access"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>play_circle</span>
                              <span>Resume Access</span>
                            </button>
                          )}

                          {/* Individual Rate Visibility */}
                          <button
                            type="button"
                            className={`dealer-manage-pill-btn ${!isStaffPriceOn ? "btn-active" : ""}`}
                            disabled={busy}
                            onClick={() => handleToggleStaffPrice(m.id, !isStaffPriceOn, m.full_name || m.phone)}
                            title={isStaffPriceOn ? "Hide wholesale dealer rate" : "Show wholesale dealer rate"}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                              {isStaffPriceOn ? "visibility_off" : "visibility"}
                            </span>
                            <span>{isStaffPriceOn ? "Hide Rate" : "Show Rate"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                className="dealer-staff-btn-secondary"
                style={{ minHeight: 38, fontSize: 12.5 }}
                onClick={() => {
                  setActiveModal(null);
                  setActiveTab("staff");
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>badge</span>
                <span>Open Full Team Directory ({staff.length})</span>
              </button>
            </div>

            {/* 3. Official Store Code (Fixed & Read-Only) */}
            <div className="dealer-gst-box" style={{ padding: "12px 14px", backgroundColor: "#f2f4f7" }}>
              <div style={{ minWidth: 0 }}>
                <span className="dealer-gst-label">Official Store Code (Permanent)</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#001021", letterSpacing: "0.06em" }}>
                  {dealerCode}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  Linked with Zoho CRM Dealership • Cannot be altered
                </span>
              </div>
              <button
                type="button"
                className="dealer-copy-btn"
                onClick={() => copyDealerCode(dealerCode)}
                title="Copy Official Store Code"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {copiedDealerCode ? "check" : "content_copy"}
                </span>
                <span>{copiedDealerCode ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* Done / Close Button */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="dealer-staff-btn-primary"
                style={{ flex: 1 }}
                onClick={() => setActiveModal(null)}
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
