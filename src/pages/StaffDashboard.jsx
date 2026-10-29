import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, revalidateSession, signOut } from "../data/session";
import { hasSession } from "../data/auth";
import { updateUserProfile, requestEmailOtp, verifyEmailOtp } from "../data/auth";
import { isValidEmail, isValidName } from "../data/validators";
import { useFavorites } from "../data/favoritesStore";

/* Staff Workspace & Dashboard
 * Dedicated portal for authorized dealership staff.
 * Displays personal credentials, employer dealership info,
 * wholesale pricing permissions, quick catalog modules, and counter sharing tools.
 */
export default function StaffDashboard() {
  const navigate = useNavigate();
  const session = useSession();
  const { count: favCount } = useFavorites();

  const [refreshing, setRefreshing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Modals: null | "editName" | "verifyEmail" | "storeInfo"
  const [activeModal, setActiveModal] = useState(null);

  // Edit Name State
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState("");

  // Email Verification State
  const [emailDraft, setEmailDraft] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailStep, setEmailStep] = useState("input"); // 'input' | 'otp'
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailDevCode, setEmailDevCode] = useState("");

  // Clipboard copy state
  const [copiedStoreCode, setCopiedStoreCode] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Revalidate session on initial mount to ensure fresh status
  useEffect(() => {
    revalidateSession().catch(() => {});
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setErrorMsg("");
    try {
      await revalidateSession();
      setSuccessMsg("✓ Workspace updated with latest store settings.");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch {
      setErrorMsg("Could not refresh right now. Please check your network connection.");
      setTimeout(() => setErrorMsg(""), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  const copyToClipboard = async (text, setCopiedFn) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFn(true);
      setTimeout(() => setCopiedFn(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedFn(true);
      setTimeout(() => setCopiedFn(false), 2000);
    }
  };

  const openEditNameModal = () => {
    setNameDraft(session.fullName || "");
    setNameError("");
    setActiveModal("editName");
  };

  const handleSaveName = async (e) => {
    e?.preventDefault();
    const clean = nameDraft.trim();
    if (!clean || clean.length < 2) {
      setNameError("Please enter your full name (minimum 2 characters)");
      return;
    }
    if (!isValidName(clean)) {
      setNameError("Please enter a valid name using letters only");
      return;
    }
    setNameBusy(true);
    setNameError("");
    try {
      await updateUserProfile({ full_name: clean });
      await revalidateSession();
      setActiveModal(null);
      setSuccessMsg("✓ Your name has been updated successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setNameError(err.message || "Failed to update name");
    } finally {
      setNameBusy(false);
    }
  };

  const openVerifyEmailModal = () => {
    setEmailDraft(session.email || "");
    setEmailOtp("");
    setEmailError("");
    setEmailStep("input");
    setEmailDevCode("");
    setActiveModal("verifyEmail");
  };

  const handleRequestEmailOtp = async (e) => {
    e?.preventDefault();
    const clean = emailDraft.trim().toLowerCase();
    if (!clean || !isValidEmail(clean)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    try {
      const res = await requestEmailOtp(clean);
      setEmailStep("otp");
      if (res?.dev_code) setEmailDevCode(res.dev_code);
    } catch (err) {
      setEmailError(err.message || "Failed to send verification code");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e?.preventDefault();
    const cleanOtp = emailOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setEmailError("Please enter the 6-digit code sent to your email");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    try {
      await verifyEmailOtp(emailDraft.trim().toLowerCase(), cleanOtp);
      await revalidateSession();
      setActiveModal(null);
      setSuccessMsg("✓ Email verified successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setEmailError(err.message || "Invalid or expired verification code");
    } finally {
      setEmailBusy(false);
    }
  };

  // If user has active session tokens in browser, show smooth loading state while hydrating
  if (hasSession() && (!session || session.role === "guest")) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ margin: "0 auto 16px", width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#1d4ed8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#64748b", fontSize: "0.95rem", fontWeight: 600 }}>Loading Staff Workspace…</p>
        </div>
      </div>
    );
  }

  // If user is unauthenticated, prompt to log in
  if (!session || session.role === "guest") {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 className="d2">Staff Portal</h1>
          <p className="sub">Please sign in to access your store staff workspace.</p>
          <Link className="btn btn-navy" to="/login?needAuth=true&role=staff">
            Sign In to Staff Account
          </Link>
        </div>
      </section>
    );
  }

  // Handle pending or hold status
  if (session.status === "pending" || session.staffPending) {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 540, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fffbeb",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>pending</span>
          </div>
          <h1 className="d2" style={{ fontSize: "1.6rem" }}>Access Pending Authorization</h1>
          <p className="sub" style={{ margin: "8px 0 20px" }}>
            Your staff account has been submitted and is currently awaiting approval from dealership owner <b>{session.dealer?.name || "Store Owner"}</b>.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-navy" onClick={handleRefresh} disabled={refreshing}>
              <span className={`material-symbols-outlined ${refreshing ? "rotate-180" : ""}`} style={{ fontSize: 18, marginRight: 6 }}>
                refresh
              </span>
              <span>{refreshing ? "Checking Status…" : "Refresh Approval Status"}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </section>
    );
  }

  const staffName = session.fullName || (session.phone ? `Staff (+91 ${session.phone})` : "Store Staff");
  const staffInitial = staffName.charAt(0).toUpperCase();
  const dealerName = session.dealer?.name || "Dealership Partner";
  const dealerCode = session.dealer?.dealer_code || "STORE-CODE";
  const customerShareLink = `${window.location.origin}/products?from=${encodeURIComponent(dealerCode)}`;
  const isOwner = session.role === "dealer" && session.authRole !== "dealer_staff";

  return (
    <div className="dealer-ws-page">
      {/* Top Sticky Header Bar */}
      <header className="dealer-ws-header">
        <div className="dealer-ws-header-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link to="/products" className="dealer-ws-back-btn" aria-label="Go to Products">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back_ios_new</span>
            </Link>
            <h1 className="dealer-ws-header-title">Staff Workspace</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="dealer-ws-back-btn"
              onClick={handleRefresh}
              title="Refresh store permissions and profile"
              disabled={refreshing}
              aria-label="Refresh Workspace"
            >
              <span className={`material-symbols-outlined ${refreshing ? "rotate-180" : ""}`} style={{ fontSize: 20 }}>
                refresh
              </span>
            </button>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                backgroundColor: "#1d4ed8",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 1px 4px rgba(29, 78, 216, 0.25)",
              }}
              title={`Staff: ${staffName}`}
            >
              {staffInitial}
            </div>

            <button
              type="button"
              className="dealer-ws-back-btn"
              onClick={async () => {
                await signOut();
                navigate("/login");
              }}
              title="Log Out of Staff Account"
              aria-label="Log Out"
              style={{
                color: "var(--err, #dc2626)",
                border: "1px solid rgba(220, 38, 38, 0.25)",
                background: "#fef2f2",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="dealer-ws-content">
        {/* Dealership Owner View Alert if owner is inspecting this screen */}
        {isOwner && (
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span className="material-symbols-outlined" style={{ color: "#1d4ed8", fontSize: 20 }}>
                storefront
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e3a8a" }}>
                  Dealership Owner Mode
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#3b82f6" }}>
                  You have full ownership privileges for {dealerName}.
                </p>
              </div>
            </div>
            <Link
              to="/dealer"
              style={{
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 700,
                color: "#ffffff",
                background: "#1d4ed8",
                padding: "6px 12px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              Open Dealer Workspace →
            </Link>
          </div>
        )}

        {/* Global Toast / Feedback Messages */}
        {successMsg && (
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
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
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
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Staff Identity & Status Card */}
        <section className="dealer-ws-card">
          <div className="dealer-identity-profile">
            <div className="dealer-identity-avatar-wrap">
              <div
                className="dealer-identity-avatar"
                style={{
                  backgroundColor: "#1d4ed8",
                  borderColor: "#dbeafe",
                }}
              >
                <span>{staffInitial}</span>
              </div>
              <span
                className="dealer-identity-verified-badge"
                title="Verified Store Staff"
                style={{ backgroundColor: "#ffffff" }}
              >
                <span className="material-symbols-outlined fill-1" style={{ fontSize: 16, color: "#1d4ed8" }}>
                  verified
                </span>
              </span>
            </div>

            <div className="dealer-identity-info">
              <div className="dealer-identity-name-row">
                <h2 className="dealer-identity-name">{staffName}</h2>
                <button
                  type="button"
                  onClick={openEditNameModal}
                  title="Edit Display Name"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 4px",
                    color: "#475569",
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 4,
                  }}
                  aria-label="Edit Name"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "#dbeafe",
                    color: "#1d4ed8",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>badge</span>
                  Store Staff
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "#f0fdf4",
                    color: "#166534",
                  }}
                >
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: 13 }}>check_circle</span>
                  Active Access
                </span>
              </div>

              <div className="dealer-contact-meta" style={{ marginTop: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, color: "#1e293b" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, color: "#2563eb" }}>store</span>
                  {dealerName}
                </span>
              </div>
            </div>
          </div>

          {/* Dealership Store Code Strip with 1-Click Copy */}
          <div className="dealer-code-strip">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div className="dealer-code-icon-wrap" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>storefront</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="dealer-code-sublabel">Store Code</span>
                <span className="dealer-code-val">{dealerCode}</span>
              </div>
            </div>

            <button
              type="button"
              className="dealer-copy-btn"
              onClick={() => copyToClipboard(dealerCode, setCopiedStoreCode)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {copiedStoreCode ? "check" : "content_copy"}
              </span>
              <span>{copiedStoreCode ? "Copied!" : "Copy Code"}</span>
            </button>
          </div>
        </section>

        {/* 2. Staff Personal Profile & Credentials Card */}
        <section className="dealer-ws-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#001021", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              My Profile &amp; Contact Credentials
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>Staff ID: {session.userId ? String(session.userId).slice(0, 8) : "Active"}</span>
          </div>

          {/* Credential Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* WhatsApp Mobile */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "#f0fdf4",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    WhatsApp Phone Number
                  </span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {session.phone ? `+91 ${session.phone}` : "No phone linked"}
                  </span>
                </div>
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: session.phone_verified ? "#dcfce7" : "#fee2e2",
                  color: session.phone_verified ? "#15803d" : "#b91c1c",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined fill-1" style={{ fontSize: 12 }}>
                  {session.phone_verified ? "check_circle" : "cancel"}
                </span>
                {session.phone_verified ? "Verified" : "Unverified"}
              </span>
            </div>

            {/* Official Email */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>mail</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Email Address
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.email || "No email linked"}
                  </span>
                </div>
              </div>

              {session.email_verified ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "#dcfce7",
                    color: "#15803d",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined fill-1" style={{ fontSize: 12 }}>check_circle</span>
                  Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={openVerifyEmailModal}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: "#fef3c7",
                    color: "#b45309",
                    border: "1px solid #fde68a",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>verified</span>
                  Verify Now
                </button>
              )}
            </div>

            {/* Store Role & Designation */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "#f3e8ff",
                    color: "#7e22ce",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>badge</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
                    Account Role
                  </span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    Authorized Store Staff &amp; Sales Desk
                  </span>
                </div>
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  flexShrink: 0,
                }}
              >
                Active
              </span>
            </div>
          </div>
        </section>

        {/* 3. Wholesale Pricing Permissions Card */}
        <section
          className="dealer-ws-card"
          style={{
            borderLeft: session.canSeeDealerPrice ? "4px solid #16a34a" : "4px solid #f59e0b",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: session.canSeeDealerPrice ? "#dcfce7" : "#fef3c7",
                  color: session.canSeeDealerPrice ? "#15803d" : "#b45309",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {session.canSeeDealerPrice ? "price_check" : "visibility_off"}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#001021", margin: 0 }}>
                  {session.canSeeDealerPrice
                    ? "Wholesale Dealer Rates: Unlocked"
                    : "Counter Walk-In Mode: Retail MRP Only"}
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                  {session.canSeeDealerPrice
                    ? "Trade pricing & rebate calculator are visible across the catalog."
                    : "Wholesale trade pricing is masked to protect margin during customer walk-ins."}
                </p>
              </div>
            </div>

            <span
              style={{
                padding: "3px 10px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 700,
                backgroundColor: session.canSeeDealerPrice ? "#dcfce7" : "#fef3c7",
                color: session.canSeeDealerPrice ? "#15803d" : "#b45309",
                flexShrink: 0,
              }}
            >
              {session.canSeeDealerPrice ? "Wholesale Active" : "MRP Protected"}
            </span>
          </div>

          <p style={{ fontSize: 12, lineHeight: "17px", color: "#475569", margin: "4px 0 0" }}>
            {session.canSeeDealerPrice
              ? "You can view trade purchase rates, volume pricebooks, and tier margins. If you need counter walk-in mode, ask your dealership owner."
              : "When assisting retail customers at the sales counter, only maximum retail prices (MRP) are displayed. To request wholesale view access, contact your store owner."}
          </p>
        </section>

        {/* 4. Dealership Business Information */}
        <section className="dealer-ws-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#001021", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Dealership Store Details
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: "#f1f5f9",
                color: "#475569",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              Verified Partner
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <span className="dealer-gst-label">Business Name</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", display: "block", marginTop: 2 }}>
                {dealerName}
              </span>
            </div>

            <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <span className="dealer-gst-label">Store Location</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", display: "block", marginTop: 2 }}>
                {[session.dealer?.city, session.dealer?.state].filter(Boolean).join(", ") || "Registered Store"}
              </span>
            </div>

            {session.dealer?.gst_number && (
              <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <span className="dealer-gst-label">GST Identification</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", display: "block", marginTop: 2 }}>
                  {session.dealer.gst_number}
                </span>
              </div>
            )}

            {session.dealer?.phone && (
              <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <span className="dealer-gst-label">Store Helpline</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", display: "block", marginTop: 2 }}>
                  {session.dealer.phone}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 5. 2x2 Hub Modules Grid (Matching Dealer Workspace style) */}
        <div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            Quick Workflows
          </h3>

          <div className="dealer-hub-grid">
            {/* Button 1: Browse Products */}
            <Link to="/products" className="dealer-hub-card" style={{ textDecoration: "none" }}>
              <div className="dealer-hub-top-row">
                <div
                  className="dealer-hub-icon-tile"
                  style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
                >
                  <span className="material-symbols-outlined">grid_view</span>
                </div>
                <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
              </div>
              <div className="dealer-hub-body">
                <h4 className="dealer-hub-title">Product Catalog</h4>
                <p className="dealer-hub-stat" style={{ color: "#1e40af" }}>Live Zoho Inventory</p>
                <p className="dealer-hub-desc">Stoves, hobs &amp; chimneys</p>
              </div>
            </Link>

            {/* Button 2: Saved Quotes & Favorites */}
            <Link to="/favorites" className="dealer-hub-card" style={{ textDecoration: "none" }}>
              <div className="dealer-hub-top-row">
                <div
                  className="dealer-hub-icon-tile"
                  style={{ backgroundColor: "#fce7f3", color: "#be185d" }}
                >
                  <span className="material-symbols-outlined">favorite</span>
                </div>
                <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
              </div>
              <div className="dealer-hub-body">
                <h4 className="dealer-hub-title">Saved Items</h4>
                <p className="dealer-hub-stat" style={{ color: "#be185d" }}>{favCount} Saved Quotes</p>
                <p className="dealer-hub-desc">Customer shortlists</p>
              </div>
            </Link>

            {/* Button 3: Dealer Schemes */}
            <Link to="/schemes" className="dealer-hub-card" style={{ textDecoration: "none" }}>
              <div className="dealer-hub-top-row">
                <div
                  className="dealer-hub-icon-tile"
                  style={{ backgroundColor: "#fef3c7", color: "#b45309" }}
                >
                  <span className="material-symbols-outlined">campaign</span>
                </div>
                <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
              </div>
              <div className="dealer-hub-body">
                <h4 className="dealer-hub-title">Store Schemes</h4>
                <p className="dealer-hub-stat" style={{ color: "#b45309" }}>5+1 &amp; Slabs</p>
                <p className="dealer-hub-desc">Current brand offers</p>
              </div>
            </Link>

            {/* Button 4: Help & Support Priority Desk */}
            <Link to="/support" className="dealer-hub-card" style={{ textDecoration: "none" }}>
              <div className="dealer-hub-top-row">
                <div
                  className="dealer-hub-icon-tile"
                  style={{ backgroundColor: "#dcfce7", color: "#15803d" }}
                >
                  <span className="material-symbols-outlined">headset_mic</span>
                </div>
                <span className="material-symbols-outlined dealer-hub-arrow">arrow_forward</span>
              </div>
              <div className="dealer-hub-body">
                <h4 className="dealer-hub-title">Dealer Support</h4>
                <p className="dealer-hub-stat" style={{ color: "#15803d" }}>Priority Helpline</p>
                <p className="dealer-hub-desc">Order &amp; dispatch assistance</p>
              </div>
            </Link>
          </div>
        </div>

        {/* 6. Counter Customer Share Link Tool */}
        <section className="dealer-ws-card" style={{ backgroundColor: "#f8fafc", border: "1.5px dashed #cbd5e1" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "#f3e8ff",
                color: "#7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>share</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#001021", margin: 0 }}>
                Customer Catalog Link (Retail Protected)
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 8px" }}>
                Send this link to counter customers on WhatsApp. The link locks out wholesale dealer rates and displays only Retail MRP with your store contact.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#ffffff",
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: "#334155",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    fontFamily: "monospace",
                  }}
                >
                  {customerShareLink}
                </span>

                <button
                  type="button"
                  className="dealer-copy-btn"
                  onClick={() => copyToClipboard(customerShareLink, setCopiedShareLink)}
                  style={{ minHeight: 32, padding: "0 10px" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                    {copiedShareLink ? "check" : "content_copy"}
                  </span>
                  <span>{copiedShareLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* MODAL 1: EDIT NAME */}
      {activeModal === "editName" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">Edit Your Name</h3>
                <p className="dealer-modal-subtitle">
                  Update your full name displayed on quotes and receipts.
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

            {nameError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fca5a5",
                  color: "#b91c1c",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {nameError}
              </div>
            )}

            <form onSubmit={handleSaveName} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Enter your name (e.g. Ramesh Sharma)"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  type="submit"
                  className="dealer-staff-btn-primary"
                  style={{ flex: 1, backgroundColor: "#1d4ed8" }}
                  disabled={nameBusy || !nameDraft.trim()}
                >
                  <span>{nameBusy ? "Saving…" : "Save Name"}</span>
                </button>
                <button
                  type="button"
                  className="dealer-staff-btn-secondary"
                  onClick={() => setActiveModal(null)}
                  disabled={nameBusy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VERIFY EMAIL */}
      {activeModal === "verifyEmail" && (
        <div className="dealer-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="dealer-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="dealer-modal-header">
              <div>
                <h3 className="dealer-modal-title">
                  {emailStep === "input" ? "Verify Email Address" : "Enter Verification Code"}
                </h3>
                <p className="dealer-modal-subtitle">
                  {emailStep === "input"
                    ? "We will send a 6-digit verification code to your email."
                    : `Enter the 6-digit code sent to ${emailDraft}.`}
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

            {emailError && (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fca5a5",
                  color: "#b91c1c",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {emailError}
              </div>
            )}

            {emailDevCode && (
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  color: "#166534",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Dev Code: <b>{emailDevCode}</b>
              </div>
            )}

            {emailStep === "input" ? (
              <form onSubmit={handleRequestEmailOtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="name@dealership.com"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #cbd5e1",
                      fontSize: 15,
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    type="submit"
                    className="dealer-staff-btn-primary"
                    style={{ flex: 1, backgroundColor: "#1d4ed8" }}
                    disabled={emailBusy || !emailDraft.trim()}
                  >
                    <span>{emailBusy ? "Sending Code…" : "Send Verification Code"}</span>
                  </button>
                  <button
                    type="button"
                    className="dealer-staff-btn-secondary"
                    onClick={() => setActiveModal(null)}
                    disabled={emailBusy}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                    6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1.5px solid #cbd5e1",
                      fontSize: 20,
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textAlign: "center",
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    type="submit"
                    className="dealer-staff-btn-primary"
                    style={{ flex: 1, backgroundColor: "#1d4ed8" }}
                    disabled={emailBusy || emailOtp.length !== 6}
                  >
                    <span>{emailBusy ? "Verifying…" : "Confirm Verification"}</span>
                  </button>
                  <button
                    type="button"
                    className="dealer-staff-btn-secondary"
                    onClick={() => setEmailStep("input")}
                    disabled={emailBusy}
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

