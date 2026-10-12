import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession, revalidateSession } from "../data/session";
import {
  staffInvite, staffList, staffApprove, staffHold, staffResume, staffRevoke, staffDelete,
  staffTogglePrice, staffTogglePriceAll,
  updateDealerCode, syncDealerWithCrm,
} from "../data/auth";
import { Icon } from "../ui";
import { generateLoginCode, formatLoginCode } from "../data/loginCode";

/* Dealer dashboard — invite codes, dealer code sync, and full staff access management.
 * Powers:
 * - Dealer Code sync to Zoho CRM (Accounts & Contacts)
 * - Live Pending Approval notifications & 1-click approvals
 * - Access control: Approve, Put on Hold (pause access), Resume, Revoke, Delete
 * - Toggle Wholesale Dealer Price for staff (hide/show trade prices from team)
 * - Displays complete staff details: Name, Mobile, Email, Request Date, CRM link
 */
export default function DealerDashboard() {
  const s = useSession();
  const [staff, setStaff] = useState([]);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedDealerCode, setCopiedDealerCode] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeSuccessMsg, setCodeSuccessMsg] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'pending' | 'active' | 'hold'

  const saveStoreCode = async (overrideCode) => {
    const raw = (overrideCode || codeDraft || "").trim();
    const finalCode = formatLoginCode(raw);
    setBusy(true);
    setError("");
    setCodeSuccessMsg("");
    try {
      const res = await updateDealerCode(finalCode);
      await revalidateSession();
      setEditingCode(false);
      setCodeDraft("");
      setCodeSuccessMsg(res.crm_synced ? "✓ Store Code saved & synced live to Zoho CRM (Accounts & Contacts)!" : "✓ Store Code saved!");
      setTimeout(() => setCodeSuccessMsg(""), 4500);
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
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
    } catch {
      /* clipboard blocked */
    }
  };

  const copyDealerCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedDealerCode(true);
      setTimeout(() => setCopiedDealerCode(false), 2200);
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

  return (
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap" style={{ maxWidth: 840 }}>
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="d2" style={{ marginBottom: 4 }}>Dealer Dashboard</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <p className="sub" style={{ margin: 0, fontWeight: 700 }}>{s.dealer?.name}</p>
              {s.dealer?.dealer_code && (
                <span className="badge badge-ok" style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em" }}>
                  Dealer Code: {s.dealer.dealer_code}
                </span>
              )}
              {s.dealer?.price_tier && (
                <span className="badge badge-blue" style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                  Price List: {s.dealer.price_tier}
                </span>
              )}
              {s.dealer?.gst_treatment && (
                <span className="badge badge-outline" style={{ fontSize: "0.82rem", fontWeight: 700 }} title="GST Treatment in Zoho CRM">
                  GST: {s.dealer.gst_treatment}
                </span>
              )}
              {s.dealer?.gst_number && (
                <span className="badge badge-ghost" style={{ fontSize: "0.82rem", fontWeight: 700 }} title="GSTIN in Zoho CRM">
                  GSTIN: {s.dealer.gst_number}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleCrmSync}
              disabled={busy}
              title="Sync latest Price List and account details from Zoho CRM"
            >
              🔄 Sync with CRM
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => loadStaff()} disabled={busy} title="Refresh team list">
              ↻ Refresh
            </button>
            <Link className="btn btn-ghost btn-sm" to="/products">
              <Icon name="stove" size={15} /> {s.dealer?.name ? "Back to products" : "Products"}
            </Link>
          </div>
        </div>

        {/* Global Notifications / Pending Requests Section */}
        {pendingStaff.length > 0 ? (
          <div style={{
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            border: "2px solid #f59e0b",
            borderRadius: "var(--r-md, 12px)",
            padding: "16px 20px",
            marginTop: "var(--s4)",
            boxShadow: "0 6px 18px rgba(245, 158, 11, 0.18)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "1.6rem" }}>🔔</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#92400e", fontWeight: 800 }}>
                    {pendingStaff.length} Pending Staff Approval Request{pendingStaff.length > 1 ? "s" : ""}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.84rem", color: "#b45309" }}>
                    New staff entered your Dealer Code <b>{s.dealer?.dealer_code}</b>. Review details and approve access below:
                  </p>
                </div>
              </div>
              <span className="badge badge-warn" style={{ fontSize: "0.82rem", fontWeight: 800, padding: "5px 12px" }}>
                Approval Required
              </span>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {pendingStaff.map((m) => (
                <div key={m.id} style={{
                  background: "#ffffff", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", background: "#fef3c7", color: "#b45309",
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.95rem"
                      }}>
                        {(m.full_name || m.phone || "S")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "1.02rem", color: "#1e293b" }}>
                          {m.full_name || "New Staff Member"}
                        </div>
                        <span className="badge badge-warn" style={{ fontSize: "0.72rem", padding: "1px 6px" }}>Pending Approval</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.84rem", color: "#475569", marginTop: 8 }}>
                      {m.phone && <span>📱 Mobile: <b>{m.phone}</b></span>}
                      {m.email && <span>✉️ Email: <b>{m.email}</b></span>}
                      <span>🕒 Requested: {new Date(m.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-navy btn-sm" disabled={busy}
                            onClick={() => act(staffApprove, m.id, `✓ Approved access for ${m.full_name || m.phone}! Wholesale pricing unlocked.`)}>
                      <Icon name="check" size={14} /> Approve Access
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(staffHold, m.id, `⏸ Placed ${m.full_name || m.phone} on hold.`)}
                            style={{ color: "#d97706", borderColor: "#fde68a" }}>
                      Put on Hold
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={busy}
                            onClick={() => act(staffRevoke, m.id, `✕ Rejected registration for ${m.full_name || m.phone}.`)}
                            style={{ color: "#dc2626" }}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            background: "var(--teal-50, #f0fdf4)", border: "1px solid #bbf7d0",
            borderRadius: "var(--r-md, 10px)", padding: "10px 16px", marginTop: "var(--s4)",
            display: "flex", alignItems: "center", gap: 10, fontSize: "0.86rem", color: "#166534"
          }}>
            <span>✓</span> All team registration requests are up to date. No pending approvals.
          </div>
        )}

        {/* Global Action Success Toast */}
        {actionSuccessMsg && (
          <div style={{
            background: "var(--teal-50, #f0fdf4)", border: "1.5px solid #86efac",
            color: "#15803d", padding: "12px 16px", borderRadius: 8, marginTop: 14,
            fontSize: "0.92rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 2px 8px rgba(34, 197, 94, 0.15)"
          }}>
            <span>✓</span> {actionSuccessMsg}
          </div>
        )}

        {/* Team Onboarding via Dealer Code */}
        <div className="authcard" style={{ marginTop: "var(--s4)", borderTop: "4px solid var(--blue-600, #2563eb)" }}>
          <div className="authcard-head">
            <h2>Store Team Onboarding & Code Sync</h2>
            <p>Your shop staff joins by entering this Dealer Code during registration. You have full control to approve, put on hold, or revoke access.</p>
          </div>
          <div className="authcard-body">
            {codeSuccessMsg && (
              <div style={{
                background: "var(--teal-50, #f0fdf4)", border: "1px solid #86efac",
                color: "#15803d", padding: "10px 14px", borderRadius: 8, marginBottom: 12,
                fontSize: "0.88rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 8
              }}>
                {codeSuccessMsg}
              </div>
            )}

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
              padding: "16px 18px", background: "var(--bg-subtle, #f8fafc)",
              border: "1px solid var(--blue-200, #bfdbfe)", borderRadius: "var(--r-md)",
            }}>
              <div style={{ flex: "1 1 auto", minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--blue-700, #1d4ed8)", letterSpacing: "0.06em" }}>
                    YOUR OFFICIAL STORE / DEALER CODE
                  </span>
                  {s.dealer?.dealer_code && (
                    <span className="badge badge-ok" style={{ fontSize: "0.72rem" }}>Synced to Zoho CRM</span>
                  )}
                </div>

                {!editingCode && s.dealer?.dealer_code ? (
                  <>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "0.12em", color: "var(--tx-1)", margin: "3px 0" }}>
                      {s.dealer.dealer_code}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--tx-3)" }}>
                      Saved in Zoho CRM under <b>Store Code</b> (Accounts & Contacts). Share this code with your staff to let them register.
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        value={codeDraft}
                        onChange={(e) => setCodeDraft(formatLoginCode(e.target.value))}
                        placeholder={s.dealer?.dealer_code || "e.g. DE-ABC-1234"}
                        style={{
                          padding: "8px 12px", fontSize: "1.1rem", fontWeight: 700,
                          letterSpacing: "0.08em", maxWidth: 195, textTransform: "uppercase",
                          border: "1.5px solid var(--blue-400, #60a5fa)", borderRadius: 6
                        }}
                      />
                      <button
                        className="btn btn-navy btn-sm"
                        disabled={busy || (!codeDraft.trim() && !s.dealer?.dealer_code)}
                        onClick={() => saveStoreCode(codeDraft)}
                      >
                        {busy ? "Saving…" : "Save & Sync to CRM"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => {
                          const gen = generateLoginCode("DE");
                          setCodeDraft(gen);
                          saveStoreCode(gen);
                        }}
                      >
                        ⚡ Auto-Generate
                      </button>
                      {editingCode && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingCode(false)}>
                          Cancel
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--tx-3)", marginTop: 6 }}>
                      Standard Format: <b>DE-ABC-1234</b> (2-letter prefix, 3 letters, 4 digits). Automatically updates <b>Store Code</b> in Zoho CRM Accounts and Contacts.
                    </div>
                  </div>
                )}
              </div>

              {!editingCode && s.dealer?.dealer_code && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn-navy btn-sm" onClick={() => copyDealerCode(s.dealer.dealer_code)}>
                    {copiedDealerCode ? "Copied!" : "Copy Code"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setCodeDraft(s.dealer.dealer_code); setEditingCode(true); }}>
                    Edit Code
                  </button>
                </div>
              )}
            </div>

            {/* Optional Temporary 7-Day Single-Use Invite */}
            <div style={{ marginTop: 14, borderTop: "1px dashed var(--line)", paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Temporary 7-Day Invite Code</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--tx-3)" }}>Single-use backup invite code for external contractors</div>
                </div>
                {!invite ? (
                  <button className="btn btn-ghost btn-sm" onClick={generateInvite} disabled={busy}>
                    <Icon name="bolt" size={14} /> Generate 7-day invite
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, letterSpacing: "0.1em", fontSize: "1.1rem" }}>{invite.code}</span>
                    <button className="btn btn-ghost btn-sm" onClick={copyCode}>Copy</button>
                    <button className="btn btn-white btn-sm" onClick={generateInvite} disabled={busy}>New</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: "var(--s3)", padding: "10px 14px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: "0.88rem" }}>
            {error}
          </div>
        )}

        {/* Staff Team Management Section */}
        <div className="authcard" style={{ marginTop: "var(--s4)" }}>
          <div className="authcard-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ margin: 0 }}>Team Members ({staff.length})</h2>
              <p style={{ margin: "4px 0 0" }}>Manage access, view contact details, put on hold, or remove members from your store.</p>
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn btn-sm ${filter === "all" ? "btn-navy" : "btn-ghost"}`}
                onClick={() => setFilter("all")}
                style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              >
                All ({staff.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filter === "pending" ? "btn-navy" : "btn-ghost"}`}
                onClick={() => setFilter("pending")}
                style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              >
                Pending ({pendingStaff.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filter === "active" ? "btn-navy" : "btn-ghost"}`}
                onClick={() => setFilter("active")}
                style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              >
                Active ({activeStaff.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filter === "hold" ? "btn-navy" : "btn-ghost"}`}
                onClick={() => setFilter("hold")}
                style={{ padding: "4px 10px", fontSize: "0.8rem" }}
              >
                On Hold ({holdStaffList.length})
              </button>
            </div>
          </div>

          {/* Storewide Staff Wholesale Pricing Toggle */}
          {staff.length > 0 && (
            <div style={{
              margin: "12px 18px 0",
              padding: "12px 16px",
              background: s.dealer?.hide_staff_dealer_price ? "#fffbeb" : "var(--bg-subtle, #f8fafc)",
              border: s.dealer?.hide_staff_dealer_price ? "1.5px solid #fde68a" : "1px solid var(--blue-200, #bfdbfe)",
              borderRadius: "var(--r-md, 10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 280px" }}>
                <span style={{ fontSize: "1.3rem" }}>
                  {s.dealer?.hide_staff_dealer_price ? "🔒" : "👁️"}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "var(--tx-1)" }}>
                    Storewide Staff Dealer Pricing:{" "}
                    <span style={{ color: s.dealer?.hide_staff_dealer_price ? "#d97706" : "#15803d" }}>
                      {s.dealer?.hide_staff_dealer_price ? "Hidden for All Staff (Retail MRP Mode)" : "Visible"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--tx-3)" }}>
                    {s.dealer?.hide_staff_dealer_price
                      ? "Wholesale prices are temporarily hidden for your staff. Staff can show products and assist customers at retail MRP without seeing wholesale rates."
                      : "Staff can view dealer wholesale rates. You can hide prices storewide or for individual staff members anytime."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm ${s.dealer?.hide_staff_dealer_price ? "btn-navy" : "btn-ghost"}`}
                disabled={busy}
                onClick={() => handleToggleAllStaffPrices(Boolean(s.dealer?.hide_staff_dealer_price))}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  borderColor: s.dealer?.hide_staff_dealer_price ? undefined : "#cbd5e1",
                }}
                title={s.dealer?.hide_staff_dealer_price ? "Turn on dealer pricing for all store staff" : "Hide dealer wholesale rates from all store staff"}
              >
                {s.dealer?.hide_staff_dealer_price ? "👁️ Turn On for All Staff" : "🔒 Hide for All Staff"}
              </button>
            </div>
          )}

          <div className="authcard-body">
            {filteredStaff.length === 0 ? (
              <p className="note" style={{ margin: 0, textAlign: "center", padding: "16px 0" }}>
                {filter === "all"
                  ? "No team members yet. Share your Store Code with your staff so they can register."
                  : `No team members with status "${filter}".`}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {filteredStaff.map((m) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
                    padding: "16px 18px", border: "1px solid var(--line)", borderRadius: "var(--r-md)",
                    background: m.status === "pending" ? "var(--amber-50, #fffbeb)" : "var(--bg, #fff)",
                    borderLeft: m.status === "pending" ? "4px solid #f59e0b" : m.status === "active" ? "4px solid #22c55e" : m.status === "hold" ? "4px solid #f97316" : "4px solid #94a3b8"
                  }}>
                    {/* Staff Details */}
                    <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: m.status === "active" ? "#dcfce7" : m.status === "hold" ? "#ffedd5" : "#f1f5f9",
                          color: m.status === "active" ? "#15803d" : m.status === "hold" ? "#c2410c" : "#475569",
                          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem"
                        }}>
                          {(m.full_name || m.phone || "S")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--tx-1)" }}>
                            {m.full_name || "Staff Member"}
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                            <StatusBadge status={m.status} />
                            {m.status === "active" && (
                              <span
                                className={`badge ${m.can_see_dealer_price !== false && !s.dealer?.hide_staff_dealer_price ? "badge-ok" : "badge-warn"}`}
                                style={{ fontSize: "0.72rem", fontWeight: 700 }}
                                title={m.can_see_dealer_price !== false && !s.dealer?.hide_staff_dealer_price ? "Dealer wholesale price visible to this member" : "Dealer wholesale price hidden from this member"}
                              >
                                {m.can_see_dealer_price !== false && !s.dealer?.hide_staff_dealer_price ? "👁️ Price: On" : "🔒 Price: Hidden"}
                              </span>
                            )}
                            {m.zoho_contact_id && (
                              <span style={{ fontSize: "0.72rem", color: "var(--blue-600)", fontWeight: 600 }}>
                                🔗 Synced to CRM
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6, marginTop: 10, fontSize: "0.85rem", color: "var(--tx-2)" }}>
                        {m.phone && (
                          <div>
                            <span style={{ color: "var(--tx-3)" }}>Mobile:</span> <b>{m.phone}</b>
                          </div>
                        )}
                        {m.email && (
                          <div style={{ overflowWrap: "anywhere" }}>
                            <span style={{ color: "var(--tx-3)" }}>Email:</span> {m.email}
                          </div>
                        )}
                        <div>
                          <span style={{ color: "var(--tx-3)" }}>Joined:</span> {new Date(m.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {/* Approve button for pending */}
                      {m.status === "pending" && (
                        <button className="btn btn-navy btn-sm" disabled={busy}
                                onClick={() => act(staffApprove, m.id, `✓ Approved access for ${m.full_name || m.phone}`)}>
                          <Icon name="check" size={14} /> Approve Access
                        </button>
                      )}

                      {/* Toggle Dealer Price On / Off for this active member */}
                      {m.status === "active" && (
                        <button
                          type="button"
                          className={`btn btn-sm ${m.can_see_dealer_price === false ? "btn-navy" : "btn-ghost"}`}
                          disabled={busy}
                          onClick={() => handleToggleStaffPrice(m.id, m.can_see_dealer_price === false, m.full_name || m.phone)}
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: m.can_see_dealer_price === false ? undefined : "#b45309",
                            borderColor: m.can_see_dealer_price === false ? undefined : "#fde68a",
                          }}
                          title={m.can_see_dealer_price === false ? "Turn on wholesale dealer prices for this member" : "Hide wholesale dealer prices for this member"}
                        >
                          {m.can_see_dealer_price === false ? "👁️ Turn On Price" : "🔒 Hide Price"}
                        </button>
                      )}

                      {/* Hold / Suspend button for active */}
                      {m.status === "active" && (
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => act(staffHold, m.id, `⏸ Placed ${m.full_name || m.phone} on hold. Portal access paused.`)}
                                style={{ color: "#d97706", borderColor: "#fcd34d" }}
                                title="Temporarily pauses staff member's store portal access">
                          ⏸ Put on Hold
                        </button>
                      )}

                      {/* Resume button for hold */}
                      {m.status === "hold" && (
                        <button className="btn btn-navy btn-sm" disabled={busy}
                                onClick={() => act(staffResume, m.id, `▶ Resumed access for ${m.full_name || m.phone}. Access restored.`)}
                                style={{ background: "#15803d" }}
                                title="Un-hold staff member and restore access">
                          ▶ Resume Access
                        </button>
                      )}

                      {/* Re-approve / Re-activate if revoked or inactive */}
                      {(m.status === "revoked" || m.status === "inactive") && (
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => act(staffApprove, m.id, `✓ Re-activated access for ${m.full_name || m.phone}`)}>
                          ✓ Re-Activate
                        </button>
                      )}

                      {/* Revoke button */}
                      {(m.status === "active" || m.status === "pending" || m.status === "hold") && (
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => act(staffRevoke, m.id, `✕ Revoked access for ${m.full_name || m.phone}`)}
                                style={{ color: "var(--red-600, #dc2626)" }}>
                          Revoke Access
                        </button>
                      )}

                      {/* Soft Deactivate button (no deletion) */}
                      {m.status !== "inactive" && (
                        <button className="btn btn-ghost btn-sm" disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to deactivate ${m.full_name || m.phone || "this member"}? They will be marked Inactive and lose access to dealer rates.`)) {
                                    act(staffDelete, m.id, `✕ Marked ${m.full_name || m.phone} as Inactive.`);
                                  }
                                }}
                                style={{ color: "#94a3b8", fontSize: "0.78rem" }}
                                title="Deactivate member (marks inactive in CRM & store, preserves records)">
                          ✕ Inactivate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="note" style={{ textAlign: "center", marginTop: "var(--s4)" }}>
          Approved staff can see wholesale dealer pricing by default, or you can toggle it off anytime using the <b>Hide Price</b> button so staff only see retail MRP while using the catalog with customers. Customer links always show retail MRP.
        </p>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { cls: "badge-warn", label: "⏳ Pending Approval" },
    active: { cls: "badge-ok", label: "✓ Active" },
    hold: { cls: "badge-warn", label: "⏸ On Hold" },
    revoked: { cls: "badge", label: "✕ Revoked" },
    inactive: { cls: "badge", label: "✕ Inactive" },
    rejected: { cls: "badge", label: "✕ Rejected" },
  };
  const it = map[status] || { cls: "badge", label: status };
  return <span className={`badge ${it.cls}`} style={{ fontSize: "0.78rem", fontWeight: 700 }}>{it.label}</span>;
}
