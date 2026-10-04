import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../data/session";
import { staffInvite, staffList, staffApprove, staffRevoke } from "../data/auth";
import { Icon } from "../ui";

/* Dealer dashboard — invite codes and staff management.
 * Powers: dealer generates a code → staff registers with it → dealer approves
 * or revokes. Everything goes through the backend; this page never talks to Zoho.
 */
export default function DealerDashboard() {
  const s = useSession();
  const [staff, setStaff] = useState([]);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStaff = async () => {
    try {
      setStaff(await staffList());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadStaff();
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

  const act = async (fn, userId) => {
    setBusy(true);
    setError("");
    try {
      await fn(userId);
      await loadStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  };

  if (s.role !== "dealer" || s.status !== "approved") {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 className="d2">Dealer Dashboard</h1>
          <p className="sub">This area is for approved dealers only.</p>
          <Link className="btn btn-navy" to="/login?needAuth=true">Sign in</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="d2" style={{ marginBottom: 4 }}>Dealer Dashboard</h1>
            <p className="sub" style={{ margin: 0 }}>{s.dealer?.name}</p>
          </div>
          <Link className="btn btn-ghost btn-sm" to="/products">
            <Icon name="stove" size={15} /> {s.dealer?.name ? "Back to products" : "Products"}
          </Link>
        </div>

        {/* Staff invites */}
        <div className="authcard" style={{ marginTop: "var(--s4)", borderTop: "4px solid var(--blue-600, #2563eb)" }}>
          <div className="authcard-head">
            <h2>Staff access</h2>
            <p>Generate an invite code, share it with your staff. They register here; you approve them below. Revoking cuts their access instantly.</p>
          </div>
          <div className="authcard-body">
            {!invite ? (
              <button className="btn btn-navy btn-block" onClick={generateInvite} disabled={busy} style={{ padding: "12px", fontSize: "1rem" }}>
                <Icon name="bolt" size={16} /> Generate invite code
              </button>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                padding: "14px 16px", background: "var(--bg-subtle, #f8fafc)",
                border: "1px dashed var(--blue-300, #93c5fd)", borderRadius: "var(--r-md)",
              }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--tx-3)", letterSpacing: "0.06em" }}>INVITE CODE</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "0.14em", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
                    {invite.code}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--tx-3)" }}>
                    Expires {new Date(invite.expires_at).toLocaleString()} · single use
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={copyCode}>Copy</button>
                <button className="btn btn-white btn-sm" onClick={generateInvite} disabled={busy}>New code</button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: "var(--s3)", padding: "10px 14px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: "0.88rem" }}>
            {error}
          </div>
        )}

        {/* Staff list */}
        <div className="authcard" style={{ marginTop: "var(--s3)" }}>
          <div className="authcard-head">
            <h2>Your team ({staff.length})</h2>
          </div>
          <div className="authcard-body">
            {staff.length === 0 ? (
              <p className="note" style={{ margin: 0 }}>No staff yet — generate an invite code above.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {staff.map((m) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    padding: "12px 14px", border: "1px solid var(--line)", borderRadius: "var(--r-md)",
                    background: "var(--bg, #fff)",
                  }}>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{m.email}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--tx-3)" }}>
                        Joined {new Date(m.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                    {m.status === "pending" && (
                      <button className="btn btn-navy btn-sm" disabled={busy} onClick={() => act(staffApprove, m.id)}>
                        <Icon name="check" size={14} /> Approve
                      </button>
                    )}
                    {(m.status === "active" || m.status === "pending") && (
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(staffRevoke, m.id)} style={{ color: "var(--red-600, #dc2626)" }}>
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="note" style={{ textAlign: "center", marginTop: "var(--s4)" }}>
          Staff see the same wholesale rates you do. Any customer link you share always opens retail MRP.
        </p>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { cls: "badge-warn", label: "Pending" },
    active: { cls: "badge-ok", label: "Active" },
    revoked: { cls: "badge", label: "Revoked" },
    rejected: { cls: "badge", label: "Rejected" },
  };
  const it = map[status] || { cls: "badge", label: status };
  return <span className={`badge ${it.cls}`}>{it.label}</span>;
}
