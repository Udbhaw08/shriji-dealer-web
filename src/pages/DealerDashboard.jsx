import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession, revalidateSession } from "../data/session";
import {
  staffInvite, staffList, staffApprove, staffHold, staffResume, staffRevoke, staffDelete,
  staffTogglePrice, staffTogglePriceAll,
  updateDealerCode, syncDealerWithCrm,
} from "../data/auth";
import { generateLoginCode, formatLoginCode } from "../data/loginCode";

/* Dealer dashboard — Workspace modules, 2x2 Hub menu buttons, store identity,
 * live Zoho CRM sync, and comprehensive staff permissions management.
 */
export default function DealerDashboard() {
  const s = useSession();
  const [staff, setStaff] = useState([]);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedDealerCode, setCopiedDealerCode] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [copiedInviteCode, setCopiedInviteCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeSuccessMsg, setCodeSuccessMsg] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState("workspace"); // 'workspace' | 'staff'
  const [filter, setFilter] = useState("all"); // 'all' | 'pending' | 'active' | 'hold'
  const [activeModal, setActiveModal] = useState(null); // null | 'invite' | 'details' | 'manage'
  const [crmSyncing, setCrmSyncing] = useState(false);

  const saveStoreCode = async (overrideCode) => {
    const raw = (overrideCode || codeDraft || "").trim();
    const finalCode = formatLoginCode(raw);
    setBusy(true);
    setError("");
    setCodeSuccessMsg("");
    try {
      const res = await updateDealerCode(finalCode);
      await revalidateSession();
      setCodeDraft("");
      setCodeSuccessMsg(res.crm_synced ? "✓ Store Code saved & synced live to Zoho CRM (Accounts & Contacts)!" : "✓ Store Code saved!");
      setTimeout(() => setCodeSuccessMsg(""), 4500);
      setActiveModal(null);
    } catch (err) {
      setError(err.message || "Failed to save Store Code");
    } finally {
      setBusy(false);
    }
  };

  const loadStaff = async (silent = false) => {
    try {
      const list = await staffList();
      setStaff(list);
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

  const generateInvite = async () => {
    setBusy(true);
    setError("");
    try {
      setInvite(await staffInvite());
      await loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

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
    try {
      await staffTogglePrice(userId, enablePrice);
      await revalidateSession();
      await loadStaff();
      const actionText = enablePrice
        ? `✓ Wholesale dealer price unlocked for ${staffName || "staff member"}.`
        : `✓ Wholesale dealer price hidden for ${staffName || "staff member"}. They will now only see retail MRP.`;
      setActionSuccessMsg(actionText);
      setTimeout(() => setActionSuccessMsg(""), 4500);
    } catch (err) {
      setError(err.message || "Failed to update staff wholesale price visibility");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleAllStaffPrices = async (enablePrice) => {
    setBusy(true);
    setError("");
    setActionSuccessMsg("");
    try {
      await staffTogglePriceAll(enablePrice);
      await revalidateSession();
      await loadStaff();
      const actionText = enablePrice
        ? "✓ Wholesale dealer pricing unlocked for all store staff members."
        : "✓ Wholesale dealer pricing hidden for all store staff. Staff now see retail MRP.";
      setActionSuccessMsg(actionText);
      setTimeout(() => setActionSuccessMsg(""), 4500);
    } catch (err) {
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

  const copyCode = async () => {
    if (!invite?.code) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopiedInviteCode(true);
      setTimeout(() => setCopiedInviteCode(false), 2000);
    } catch {
      /* clipboard blocked */
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

  const copyDirectInviteLink = async () => {
    const code = s.dealer?.dealer_code || "";
    const link = `${window.location.origin}/login?code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteLink(true);
      setTimeout(() => setCopiedInviteLink(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  if (s.role !== "dealer" || s.status !== "approved" || s.authRole === "dealer_staff") {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 className="d2">Dealer Dashboard</h1>
          <p className="sub">
            {s.authRole === "dealer_staff"
              ? "This dashboard is reserved for dealership owners."
              : "This area is for approved dealers only."}
          </p>
          <Link className="btn btn-navy" to={s.authRole === "dealer_staff" ? "/products" : "/login?needAuth=true"}>
            {s.authRole === "dealer_staff" ? "Browse products" : "Sign in"}
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
  const directLink = `${window.location.origin}/login?code=${encodeURIComponent(dealerCode)}`;

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
            >
              {storeInitial}
            </div>
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
                  {s.dealer?.city || s.dealer?.state || "Andheri, Mumbai"}
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
                  <p className="dealer-hub-stat">Instant Passes</p>
                  <p className="dealer-hub-desc">Onboarding passes &amp; link</p>
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

              {/* Button 4: Store Management */}
              <button
                type="button"
                className="dealer-hub-card"
                onClick={() => {
                  setCodeDraft(dealerCode);
                  setActiveModal("manage");
                }}
                aria-label="Store Management"
              >
                <div className="dealer-hub-top-row">
                  <div className="dealer-hub-icon-tile manage-tile">
                    <span className="material-symbols-outlined">manage_accounts</span>
                  </div>
                  <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
                </div>
                <div className="dealer-hub-body">
                  <h4 className="dealer-hub-title">Store Management</h4>
                  <p className="dealer-hub-stat">Tokens &amp; Controls</p>
                  <p className="dealer-hub-desc">Registration keys &amp; limits</p>
                </div>
              </button>
            </div>

            {/* Storewide Dealer Rates Permission Toggle Card */}
            <section className="dealer-storewide-card">
              <div className="dealer-storewide-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div className="dealer-storewide-icon">
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>storefront</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#001021", margin: 0 }}>
                      Storewide Dealer Rates
                    </p>
                    <p style={{ fontSize: 13, color: "#43474c", margin: "2px 0 0" }}>
                      {s.dealer?.hide_staff_dealer_price ? "Hidden for staff (Retail MRP)" : "Visible to authorized staff"}
                    </p>
                  </div>
                </div>
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: s.dealer?.hide_staff_dealer_price ? "#fef3c7" : "#eceef1",
                    color: s.dealer?.hide_staff_dealer_price ? "#b45309" : "#31618f",
                    flexShrink: 0,
                  }}
                >
                  {s.dealer?.hide_staff_dealer_price ? "Hidden" : "Active"}
                </span>
              </div>

              <p style={{ fontSize: 13, lineHeight: "19px", color: "#43474c", margin: 0 }}>
                Staff view wholesale bulk quotes during catalog browsing. Toggle off to limit non-admin screens to retail MRP when interacting with counter walk-ins.
              </p>

              <button
                type="button"
                className="dealer-storewide-btn"
                onClick={() => handleToggleAllStaffPrices(!s.dealer?.hide_staff_dealer_price)}
                disabled={busy}
                id="toggleStorewidePriceBtn"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} id="toggleLockIcon">
                  {s.dealer?.hide_staff_dealer_price ? "visibility" : "visibility_off"}
                </span>
                <span id="toggleLockLabel">
                  {s.dealer?.hide_staff_dealer_price ? "Show to All Staff" : "Hide for All Staff"}
                </span>
              </button>
            </section>

            {/* Temporary 7-Day Invite Code Backup card */}
            <section className="dealer-temp-invite-card">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "#eceef1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#001021",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>timer</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: "#001021", margin: 0 }}>
                    Temporary 7-Day Invite
                  </h4>
                  <p style={{ fontSize: 13, color: "#43474c", margin: "2px 0 0" }}>
                    {invite?.code ? `Pass Code: ${invite.code}` : "For provisional counter relief staff"}
                  </p>
                </div>
              </div>

              {!invite ? (
                <button
                  type="button"
                  className="dealer-temp-btn"
                  onClick={generateInvite}
                  disabled={busy}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span>
                  <span>Generate</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="dealer-temp-btn"
                  onClick={copyCode}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {copiedInviteCode ? "check" : "content_copy"}
                  </span>
                  <span>{copiedInviteCode ? "Copied" : "Copy"}</span>
                </button>
              )}
            </section>
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
                    <span>Send Invite Link</span>
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
                            <button
                              type="button"
                              className="dealer-staff-btn-primary"
                              disabled={busy}
                              onClick={() => handleToggleStaffPrice(m.id, m.can_see_dealer_price === false, m.full_name || m.phone)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                {m.can_see_dealer_price === false ? "visibility" : "visibility_off"}
                              </span>
                              <span>{m.can_see_dealer_price === false ? "Turn On Price" : "Hide Price"}</span>
                            </button>
                            <button
                              type="button"
                              className="dealer-staff-btn-secondary"
                              onClick={() => setActiveModal("manage")}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>admin_panel_settings</span>
                              <span>Manage Access</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Sub-actions Row (Put on Hold, Inactivate) */}
                      {m.status !== "pending" && (
                        <div className="dealer-staff-footer-row">
                          {m.status === "active" ? (
                            <button
                              type="button"
                              className="dealer-staff-footer-btn"
                              disabled={busy}
                              onClick={() => act(staffHold, m.id, `⏸ Placed ${m.full_name || m.phone} on hold.`)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>pause_circle</span>
                              <span>Put on Hold</span>
                            </button>
                          ) : m.status === "hold" ? (
                            <button
                              type="button"
                              className="dealer-staff-footer-btn"
                              disabled={busy}
                              onClick={() => act(staffResume, m.id, `▶ Resumed access for ${m.full_name || m.phone}.`)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>play_circle</span>
                              <span>Resume Access</span>
                            </button>
                          ) : null}

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

      {/* Dealer Priority Floating Call Bar */}
      <aside className="dealer-floating-call-aside">
        <div className="dealer-floating-call-container">
          <div className="dealer-floating-call-card">
            <a className="dealer-floating-call-link" href="tel:+917738369367">
              <div className="dealer-call-icon-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>call</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>
                  +91 77383 69367
                </span>
                <span style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#cfe5ff", letterSpacing: "0.05em" }}>
                  Dealer Priority Desk
                </span>
              </div>
            </a>

            <a className="dealer-call-action-btn" href="tel:+917738369367">
              <span>Call Desk</span>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </a>
          </div>
        </div>
      </aside>

      {/* MODAL 1: INVITE STAFF MODAL */}
      {activeModal === "invite" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">Invite Store Staff</h3>
                <p className="dealer-modal-subtitle">
                  Share your official Store Code or direct onboarding link with your sales team.
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

            {/* Direct Link Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#43474c", textTransform: "uppercase" }}>
                Direct Registration Link
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={directLink}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #c4c6cd",
                    fontSize: 13,
                    backgroundColor: "#f2f4f7",
                    color: "#001021",
                  }}
                />
                <button
                  type="button"
                  className="dealer-copy-btn"
                  onClick={copyDirectInviteLink}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {copiedInviteLink ? "check" : "content_copy"}
                  </span>
                  <span>{copiedInviteLink ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* WhatsApp Share Button */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Join our store team on ReSTOR B2B. Use Store Code: ${dealerCode} or register directly: ${directLink}`)}`}
              target="_blank"
              rel="noreferrer"
              className="dealer-staff-btn-primary"
              style={{ backgroundColor: "#25D366", color: "#ffffff", textDecoration: "none" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>share</span>
              <span>Share via WhatsApp</span>
            </a>

            {/* Temporary 7-Day Single-Use Pass */}
            <div style={{ borderTop: "1px solid #eceef1", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "#001021", margin: 0 }}>
                    Temporary 7-Day Pass
                  </h4>
                  <p style={{ fontSize: 12, color: "#43474c", margin: "2px 0 0" }}>
                    Single-use code for temporary relief staff
                  </p>
                </div>
                {!invite ? (
                  <button
                    type="button"
                    className="dealer-temp-btn"
                    onClick={generateInvite}
                    disabled={busy}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
                    <span>Generate</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="dealer-temp-btn"
                    onClick={copyCode}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {copiedInviteCode ? "check" : "content_copy"}
                    </span>
                    <span>{copiedInviteCode ? "Copied" : invite.code}</span>
                  </button>
                )}
              </div>
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

      {/* MODAL 3: STORE MANAGEMENT MODAL */}
      {activeModal === "manage" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">Store Management</h3>
                <p className="dealer-modal-subtitle">
                  Configure store registration codes, tokens, and staff access limits.
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

            {codeSuccessMsg && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  color: "#15803d",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {codeSuccessMsg}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#43474c", textTransform: "uppercase" }}>
                Official Dealer Registration Code
              </label>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(formatLoginCode(e.target.value))}
                  placeholder="e.g. DE-BKV-8180"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #31618f",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                />
                <button
                  type="button"
                  className="dealer-temp-btn"
                  onClick={() => {
                    const gen = generateLoginCode("DE");
                    setCodeDraft(gen);
                  }}
                  title="Generate new unique store code"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_fix_high</span>
                  <span>Generate</span>
                </button>
              </div>

              <p style={{ fontSize: 12, color: "#74777d", margin: 0 }}>
                Standard format: <b>DE-XXX-0000</b>. Saving this code updates your Store Code in Zoho CRM Accounts and Contacts immediately.
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="dealer-staff-btn-primary"
                style={{ flex: 1 }}
                disabled={busy || !codeDraft.trim()}
                onClick={() => saveStoreCode(codeDraft)}
              >
                <span>{busy ? "Saving…" : "Save & Sync to CRM"}</span>
              </button>
              <button
                type="button"
                className="dealer-staff-btn-secondary"
                onClick={() => setActiveModal(null)}
              >
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
