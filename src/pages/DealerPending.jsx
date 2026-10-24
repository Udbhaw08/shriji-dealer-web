import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSession, revalidateSession, signOut } from "../data/session";

export default function DealerPending() {
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isStaffKind = searchParams.get("kind") === "staff" || session?.role === "dealer_staff";
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  const dealer = session?.dealer || null;
  const status = dealer?.status || session?.status || "pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isRevoked = status === "revoked";

  // Revalidate session once on mount to get freshest status from CRM/backend
  useEffect(() => {
    revalidateSession().catch(() => {});
  }, []);

  const handleCheckStatus = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMessage("");
    try {
      const updated = await revalidateSession();
      const newStatus = updated?.dealer?.status || updated?.status;
      if (newStatus === "approved") {
        setRefreshMessage("🎉 Congratulations! Your dealership access has been approved.");
      } else if (newStatus === "rejected") {
        setRefreshMessage("Your application status has been updated to rejected.");
      } else {
        setRefreshMessage("Your application is still under review. We will notify you once verified.");
      }
    } catch {
      setRefreshMessage("Could not refresh status right now. Please try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="dealer-pending-page" style={{
      maxWidth: 580,
      margin: "0 auto",
      padding: "24px 16px 64px",
      minHeight: "80vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      boxSizing: "border-box",
      overflowX: "clip",
    }}>
      {/* Back / Navigation Breadcrumb */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/products" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: ".88rem",
          color: "var(--tx-muted, #64748b)",
          textDecoration: "none",
          fontWeight: 500,
        }}>
          ← Back to Catalog
        </Link>
        <button
          onClick={handleSignOut}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--tx-muted, #64748b)",
            fontSize: ".86rem",
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Main Card */}
      <div style={{
        background: "var(--bg-card, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "var(--r-lg, 16px)",
        padding: "32px 24px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
        textAlign: "center",
      }}>

        {/* 1. APPROVED STATE */}
        {isApproved && (
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#16a34a",
              fontSize: "1.8rem",
              marginBottom: 16,
              border: "2px solid #86efac",
            }}>
              ✓
            </div>
            <h1 style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              margin: "0 0 8px",
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}>
              {isStaffKind ? "Staff Access Approved!" : "Dealership Approved!"}
            </h1>
            <p style={{
              fontSize: ".94rem",
              color: "#475569",
              margin: "0 0 24px",
              lineHeight: 1.5,
            }}>
              {isStaffKind
                ? "You now have full access to view wholesale dealer prices and share products."
                : "Your GST and business details have been verified in Zoho CRM. Wholesale pricing is unlocked."}
            </p>

            {/* Approved Features Checklist */}
            <div style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "var(--r-md, 12px)",
              padding: "16px 20px",
              textAlign: "left",
              marginBottom: 24,
            }}>
              <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#166534", marginBottom: 10 }}>
                Unlocked Privileges:
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#1e293b", fontSize: ".88rem", display: "grid", gap: 6 }}>
                <li>Wholesale dealer pricing enabled across catalog</li>
                <li>Access to 5+1 schemes & dealer rebates</li>
                {dealer?.dealer_code && <li>Official Dealer Code: <b>{dealer.dealer_code}</b></li>}
                <li>Staff invite & team management</li>
                <li>Customer quote sharing with retail MRP masking</li>
              </ul>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Link
                to="/products"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "14px 20px",
                  fontSize: "1rem",
                  fontWeight: 700,
                  borderRadius: "var(--r-md, 10px)",
                  background: "var(--brand-green, #16a34a)",
                  color: "#ffffff",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
                }}
              >
                Enter Wholesale Catalog →
              </Link>
              <Link
                to="/dealer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  fontSize: ".94rem",
                  fontWeight: 600,
                  borderRadius: "var(--r-md, 10px)",
                  background: "transparent",
                  color: "var(--tx-1, #0f172a)",
                  border: "1px solid var(--border, #cbd5e1)",
                  textDecoration: "none",
                }}
              >
                Go to Dealer Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* 2. REJECTED OR REVOKED STATE */}
        {(isRejected || isRevoked) && (
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#dc2626",
              fontSize: "1.8rem",
              marginBottom: 16,
              border: "2px solid #fca5a5",
            }}>
              ✕
            </div>
            <h1 style={{
              fontSize: "1.45rem",
              fontWeight: 800,
              margin: "0 0 8px",
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}>
              {isRevoked ? "Dealership Inactive" : "Application Not Approved"}
            </h1>
            <p style={{
              fontSize: ".92rem",
              color: "#64748b",
              margin: "0 0 20px",
              lineHeight: 1.5,
            }}>
              {dealer?.reject_reason ||
                "Your application could not be verified with the provided business details."}
            </p>

            <div style={{
              padding: "14px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              fontSize: ".86rem",
              color: "#991b1b",
              marginBottom: 24,
              lineHeight: 1.45,
            }}>
              If you believe this is an error or would like to provide updated GST documentation, please contact Shriji Sunshine Support at <b>info@sunshine.in</b> or call support.
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Link
                to="/dealer/apply"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "13px 20px",
                  fontSize: ".96rem",
                  fontWeight: 700,
                  borderRadius: "var(--r-md, 10px)",
                  background: "var(--brand, #0f172a)",
                  color: "#ffffff",
                  textDecoration: "none",
                }}
              >
                Submit New Application
              </Link>
              <Link
                to="/products"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  fontSize: ".92rem",
                  fontWeight: 600,
                  borderRadius: "var(--r-md, 10px)",
                  background: "transparent",
                  color: "var(--tx-1, #0f172a)",
                  border: "1px solid var(--border, #cbd5e1)",
                  textDecoration: "none",
                }}
              >
                Continue Browsing as Retail Customer
              </Link>
            </div>
          </div>
        )}

        {/* 3. PENDING STATE (Default) */}
        {!isApproved && !isRejected && !isRevoked && (
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fef3c7",
              color: "#d97706",
              fontSize: "1.8rem",
              marginBottom: 16,
              border: "2px solid #fcd34d",
            }}>
              ⏳
            </div>
            <h1 style={{
              fontSize: "1.45rem",
              fontWeight: 800,
              margin: "0 0 8px",
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}>
              {isStaffKind ? "Staff Request Pending Approval" : "Application Under Review"}
            </h1>
            <p style={{
              fontSize: ".92rem",
              color: "#64748b",
              margin: "0 0 24px",
              lineHeight: 1.5,
            }}>
              {isStaffKind
                ? "Your staff registration has been submitted and is awaiting confirmation from your shop owner."
                : "Our verification team is reviewing your GST registration and business profile in Zoho CRM."}
            </p>

            {/* Visual Milestones */}
            <div style={{
              background: "var(--bg-subtle, #f8fafc)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--r-md, 12px)",
              padding: "20px 18px",
              marginBottom: 24,
              textAlign: "left",
            }}>
              <div style={{ display: "grid", gap: 14 }}>
                {/* Milestone 1: Done */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#16a34a",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: ".82rem",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    ✓
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#0f172a" }}>
                      {isStaffKind ? "Staff Details Submitted" : "Application Received"}
                    </div>
                    <div style={{ fontSize: ".8rem", color: "#64748b", marginTop: 2 }}>
                      {isStaffKind ? "Linked to verified store code" : "Business information registered"}
                    </div>
                  </div>
                </div>

                {/* Milestone 2: Active */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#f59e0b",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: ".82rem",
                    fontWeight: 800,
                    flexShrink: 0,
                    animation: "pulse 2s infinite",
                  }}>
                    ⏳
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#0f172a" }}>
                      {isStaffKind ? "Shop Owner Authorization" : "GST & Business Verification"}
                    </div>
                    <div style={{ fontSize: ".8rem", color: "#64748b", marginTop: 2 }}>
                      {isStaffKind ? "Awaiting owner approval in dealer portal" : "Cross-referencing with Zoho CRM"}
                    </div>
                  </div>
                </div>

                {/* Milestone 3: Pending */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#cbd5e1",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: ".82rem",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    ○
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: ".9rem", color: "#64748b" }}>
                      Wholesale Pricing Unlocked
                    </div>
                    <div style={{ fontSize: ".8rem", color: "#94a3b8", marginTop: 2 }}>
                      Full access to dealer catalog & schemes
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Details Summary */}
            {dealer && (
              <div style={{
                background: "#f8fafc",
                border: "1px dashed var(--border, #cbd5e1)",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: ".85rem",
                color: "#475569",
                marginBottom: 20,
                textAlign: "left",
                display: "grid",
                gap: 6,
              }}>
                <div><b>Business Name:</b> {dealer.business_name || dealer.name}</div>
                {dealer.dealer_code && <div><b>Dealer Code:</b> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{dealer.dealer_code}</span></div>}
                {dealer.gst_number && <div><b>GSTIN:</b> <span style={{ fontFamily: "monospace" }}>{dealer.gst_number}</span></div>}
              </div>
            )}

            {refreshMessage && (
              <div style={{
                padding: "10px 14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                fontSize: ".86rem",
                color: "#166534",
                marginBottom: 16,
              }}>
                {refreshMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={refreshing}
                style={{
                  padding: "13px 20px",
                  fontSize: ".96rem",
                  fontWeight: 700,
                  borderRadius: "var(--r-md, 10px)",
                  background: "var(--brand, #0f172a)",
                  color: "#ffffff",
                  border: "none",
                  cursor: refreshing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {refreshing ? "Checking Status…" : "Check Status Now ↻"}
              </button>

              <Link
                to="/products"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                  fontSize: ".92rem",
                  fontWeight: 600,
                  borderRadius: "var(--r-md, 10px)",
                  background: "transparent",
                  color: "var(--tx-1, #0f172a)",
                  border: "1px solid var(--border, #cbd5e1)",
                  textDecoration: "none",
                }}
              >
                Browse Catalog as Retail Customer
              </Link>
            </div>

            <p style={{
              fontSize: ".8rem",
              color: "var(--tx-muted, #94a3b8)",
              margin: "18px 0 0",
              lineHeight: 1.45,
            }}>
              You can safely close this page. Once approved, wholesale dealer rates will automatically activate when you sign in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
