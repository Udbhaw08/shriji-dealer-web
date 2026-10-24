import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, revalidateSession } from "../data/session";
import { applyAsDealer, requestEmailOtp, verifyEmailOtp, requestPhoneOtp, verifyPhoneOtp } from "../data/auth";
import { GST_TREATMENT_OPTIONS } from "../data/loginCode";
import { isValidEmail, isValidPhone, isValidName, isValidGstin, isValidPincode } from "../data/validators";
import { Icon } from "../ui";

export default function DealerApply() {
  const session = useSession();
  const navigate = useNavigate();

  const isAuthenticated = session && session.role !== "guest";
  const isDealerRole = session?.role === "dealer" || session?.dealer;
  const isApprovedDealer = isDealerRole && session?.status === "approved";
  const isPendingDealer = isDealerRole && session?.status === "pending";

  // Form inputs
  const [form, setForm] = useState({
    business_name: "",
    person_name: session?.fullName || "",
    gst_treatment: "Registered Business - Regular",
    gst_number: "",
    address_line: "",
    city: "",
    pin: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Inline Contact Verification modal / state
  const [verifyingChannel, setVerifyingChannel] = useState(null); // null | 'email' | 'phone'
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyOtpCode, setVerifyOtpCode] = useState("");
  const [verifyOtpSent, setVerifyOtpSent] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [devCode, setDevCode] = useState("");

  // Redirect if already an approved dealer or pending
  useEffect(() => {
    if (isApprovedDealer) {
      navigate("/dealer", { replace: true });
    } else if (isPendingDealer) {
      navigate("/dealer/pending", { replace: true });
    }
  }, [isApprovedDealer, isPendingDealer, navigate]);

  const emailVerified = Boolean(session?.email_verified);
  const phoneVerified = Boolean(session?.phone_verified);
  const canSubmit = emailVerified && phoneVerified;

  const handleFieldChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "gst_number") {
        const val = value.toUpperCase().trim();
        next.gst_number = val;
        if (val.length > 2 && prev.gst_treatment === "Unregistered Business") {
          next.gst_treatment = "Registered Business - Regular";
        }
      }
      return next;
    });
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
    if (error) setError(null);
  };

  const validateForm = () => {
    const errs = {};
    if (!form.business_name.trim() || form.business_name.trim().length < 2) {
      errs.business_name = "Business / shop name is required (at least 2 characters).";
    }

    if (form.person_name.trim() && !isValidName(form.person_name.trim())) {
      errs.person_name = "Owner name should contain letters only (min 2 characters).";
    }

    const isRegistered = form.gst_treatment.includes("Registered");
    if (isRegistered) {
      if (!form.gst_number.trim()) {
        errs.gst_number = "GSTIN is required for registered businesses.";
      } else if (!isValidGstin(form.gst_number.trim())) {
        errs.gst_number = "Please enter a valid 15-character GSTIN (e.g. 27AABCR1234D1Z5).";
      }
    }

    if (form.pin.trim() && !isValidPincode(form.pin.trim())) {
      errs.pin = "Please enter a valid 6-digit Indian PIN code.";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/dealer/apply" } } });
      return;
    }

    if (!canSubmit) {
      setError("Both verified email and verified phone number are required before applying for dealer access.");
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    const addressParts = [
      form.address_line.trim(),
      form.city.trim(),
      form.pin.trim(),
    ].filter(Boolean);

    try {
      await applyAsDealer({
        business_name: form.business_name.trim(),
        person_name: form.person_name.trim() || undefined,
        gst_treatment: form.gst_treatment || undefined,
        gst_number: form.gst_number.trim() ? form.gst_number.trim().toUpperCase() : undefined,
        address: addressParts.join(" - ") || undefined,
      });

      await revalidateSession();
      navigate("/dealer/pending?applied=true", { replace: true });
    } catch (err) {
      setError(err.message || "Could not submit dealer application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Quick Inline Contact Verification Flow
  const startVerification = (channel) => {
    setVerifyingChannel(channel);
    setVerifyInput(channel === "email" ? (session?.email || "") : (session?.phone || ""));
    setVerifyOtpCode("");
    setVerifyOtpSent(false);
    setVerifyError("");
    setDevCode("");
  };

  const handleSendChannelOtp = async (e) => {
    e.preventDefault();
    setVerifyError("");
    setVerifyLoading(true);
    try {
      if (verifyingChannel === "email") {
        const clean = verifyInput.trim().toLowerCase();
        if (!clean || !isValidEmail(clean)) {
          throw new Error("Please enter a valid email address.");
        }
        const res = await requestEmailOtp(clean);
        setVerifyOtpSent(true);
        if (res.dev_code) setDevCode(res.dev_code);
      } else {
        const clean = verifyInput.replace(/\D/g, "");
        if (!isValidPhone(clean)) {
          throw new Error("Please enter a valid 10-digit Indian mobile number.");
        }
        const res = await requestPhoneOtp(clean);
        setVerifyOtpSent(true);
        if (res.dev_code) setDevCode(res.dev_code);
      }
    } catch (err) {
      setVerifyError(err.message || "Failed to send verification code.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyChannelOtp = async (e) => {
    e.preventDefault();
    setVerifyError("");
    setVerifyLoading(true);
    try {
      if (verifyingChannel === "email") {
        await verifyEmailOtp(verifyInput.trim().toLowerCase(), verifyOtpCode.trim());
      } else {
        await verifyPhoneOtp(verifyInput.replace(/\D/g, ""), verifyOtpCode.trim());
      }
      await revalidateSession();
      setVerifyingChannel(null);
    } catch (err) {
      setVerifyError(err.message || "Invalid or expired verification code.");
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <section className="sec" style={{ paddingTop: "clamp(var(--s4), 5vw, var(--s7))", minHeight: "85vh" }}>
      <div className="wrap" style={{ maxWidth: 620, margin: "0 auto", minWidth: 0, overflowX: "clip" }}>

        {/* Breadcrumb / Top Link */}
        <div style={{ marginBottom: 16 }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.88rem", color: "var(--tx-2)", textDecoration: "none", fontWeight: 600 }}>
            <Icon name="arrowsm" size={14} style={{ transform: "rotate(180deg)" }} />
            Back to Home
          </Link>
        </div>

        {/* Header Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, background: "var(--blue-50, #eff6ff)", color: "var(--blue-700, #1d4ed8)", fontSize: "0.82rem", fontWeight: 700, marginBottom: 12 }}>
            <Icon name="badge" size={15} />
            Official B2B Dealership Application
          </div>
          <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.1rem)", fontWeight: 800, margin: "0 0 10px", color: "var(--tx)", letterSpacing: "-0.02em" }}>
            Apply for Dealer Access
          </h1>
          <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.95rem", lineHeight: 1.55 }}>
            Register your appliance retail or distribution business. Once approved by our team via Zoho CRM, wholesale pricing tiers and staff management will unlock.
          </p>
        </div>

        {/* STEP A: CONTACT VERIFICATION PREREQUISITE CARD */}
        <div
          className="card pad"
          style={{
            marginBottom: 24,
            borderLeft: canSubmit ? "4px solid #16a34a" : "4px solid #d97706",
            background: canSubmit ? "var(--card)" : "var(--bg-2, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: canSubmit ? "#16a34a" : "#b45309" }}>
              Prerequisite 1: Contact Verification
            </span>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: canSubmit ? "#dcfce7" : "#fef3c7", color: canSubmit ? "#15803d" : "#b45309" }}>
              {canSubmit ? "✓ Ready to Apply" : "Action Required"}
            </span>
          </div>

          <p style={{ fontSize: "0.88rem", color: "var(--tx-2)", margin: "0 0 16px", lineHeight: 1.45 }}>
            To safeguard dealer pricing and synchronize with Zoho CRM, your account must have both a verified email address and verified WhatsApp phone number.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Phone Verification Status Box */}
            <div style={{ padding: "12px 14px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--line)", background: "#fff", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase" }}>Phone (WhatsApp)</span>
                {phoneVerified ? (
                  <span style={{ color: "#16a34a", fontSize: "0.78rem", fontWeight: 700 }}>✓ Verified</span>
                ) : (
                  <span style={{ color: "#dc2626", fontSize: "0.78rem", fontWeight: 700 }}>Unverified</span>
                )}
              </div>
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--tx)" }}>
                {session?.phone ? `+91 ${session.phone}` : "No phone added"}
              </span>
              {!phoneVerified && (
                <button
                  type="button"
                  className="btn btn-navy"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", marginTop: 4, justifySelf: "flex-start" }}
                  onClick={() => startVerification("phone")}
                >
                  Verify via WhatsApp
                </button>
              )}
            </div>

            {/* Email Verification Status Box */}
            <div style={{ padding: "12px 14px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--line)", background: "#fff", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--tx-3)", textTransform: "uppercase" }}>Email Address</span>
                {emailVerified ? (
                  <span style={{ color: "#16a34a", fontSize: "0.78rem", fontWeight: 700 }}>✓ Verified</span>
                ) : (
                  <span style={{ color: "#dc2626", fontSize: "0.78rem", fontWeight: 700 }}>Unverified</span>
                )}
              </div>
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--tx)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {session?.email || "No email added"}
              </span>
              {!emailVerified && (
                <button
                  type="button"
                  className="btn btn-navy"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", marginTop: 4, justifySelf: "flex-start" }}
                  onClick={() => startVerification("email")}
                >
                  Verify via Email
                </button>
              )}
            </div>
          </div>
        </div>

        {/* INLINE VERIFICATION MODAL / DRAWER */}
        {verifyingChannel && (
          <div
            style={{
              marginBottom: 24,
              padding: 20,
              borderRadius: "var(--r, 14px)",
              background: "#fff",
              border: "2px solid var(--blue-600, #2563eb)",
              boxShadow: "0 10px 30px -10px rgba(37,99,235,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--tx)" }}>
                {verifyingChannel === "email" ? "Verify Your Email Address" : "Verify Your WhatsApp Number"}
              </h3>
              <button
                type="button"
                onClick={() => setVerifyingChannel(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--tx-3)", padding: 4 }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {verifyError && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: "0.85rem", marginBottom: 14 }}>
                {verifyError}
              </div>
            )}

            {!verifyOtpSent ? (
              <form onSubmit={handleSendChannelOtp} style={{ display: "grid", gap: 14 }}>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--tx-2)" }}>
                  {verifyingChannel === "email"
                    ? "We will send a 6-digit confirmation code via Resend to verify ownership."
                    : "We will send a 6-digit OTP to your WhatsApp via Meta Cloud API."}
                </p>
                <div>
                  <label htmlFor="verify-channel-input" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 6 }}>
                    {verifyingChannel === "email" ? "Email Address" : "10-Digit Mobile Phone"}
                  </label>
                  <input
                    id="verify-channel-input"
                    type={verifyingChannel === "email" ? "email" : "tel"}
                    required
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                    placeholder={verifyingChannel === "email" ? "owner@business.com" : "98765 43210"}
                    style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line)", padding: "0 14px", fontSize: "0.95rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn btn-navy" disabled={verifyLoading} style={{ minHeight: 42 }}>
                    {verifyLoading ? "Sending OTP…" : "Send Verification Code"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setVerifyingChannel(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyChannelOtp} style={{ display: "grid", gap: 14 }}>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--tx-2)" }}>
                  Enter the 6-digit verification code sent to <strong>{verifyInput}</strong>:
                </p>
                {devCode && (
                  <div style={{ padding: "6px 10px", borderRadius: 6, background: "#f0fdf4", color: "#166534", fontSize: "0.8rem", fontWeight: 600 }}>
                    Dev Sandbox Code: <strong>{devCode}</strong>
                  </div>
                )}
                <div>
                  <label htmlFor="verify-code-input" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 6 }}>
                    6-Digit OTP Code
                  </label>
                  <input
                    id="verify-code-input"
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={verifyOtpCode}
                    onChange={(e) => setVerifyOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line)", padding: "0 14px", fontSize: "1.1rem", letterSpacing: "0.2em", fontWeight: 700, textAlign: "center" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="submit" className="btn btn-navy" disabled={verifyLoading || verifyOtpCode.length < 6} style={{ minHeight: 42 }}>
                    {verifyLoading ? "Confirming…" : "Verify & Save"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setVerifyOtpSent(false)}>
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP B: DEALER APPLICATION FORM */}
        <form onSubmit={handleSubmit} className="card pad" style={{ boxShadow: "var(--sh)", display: "grid", gap: 20 }}>

          {/* Form-Level Error Alert */}
          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: "var(--r-sm, 10px)",
                background: "var(--err-bg, #fde8e8)",
                border: "1px solid rgba(220, 69, 69, 0.2)",
                color: "var(--err, #dc4545)",
                fontSize: "0.88rem",
                lineHeight: 1.45,
              }}
            >
              <div style={{ marginTop: 2, flexShrink: 0 }}>
                <Icon name="flame" size={16} />
              </div>
              <div style={{ flex: 1 }}>{error}</div>
              <button
                type="button"
                onClick={() => setError(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", opacity: 0.7 }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

          {/* 1. Business / Shop Name */}
          <div>
            <label htmlFor="dealer-business-name" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
              Business / Shop Name <span style={{ color: "var(--err)" }}>*</span>
            </label>
            <input
              id="dealer-business-name"
              type="text"
              required
              disabled={loading}
              value={form.business_name}
              onChange={(e) => handleFieldChange("business_name", e.target.value)}
              placeholder="e.g. Sunshine Kitchen Appliances"
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--r-sm, 10px)",
                border: fieldErrors.business_name ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                padding: "0 14px",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
            {fieldErrors.business_name && (
              <span style={{ display: "block", color: "var(--err)", fontSize: "0.8rem", marginTop: 4 }}>
                {fieldErrors.business_name}
              </span>
            )}
          </div>

          {/* 2. Owner Full Name */}
          <div>
            <label htmlFor="dealer-owner-name" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
              Owner Full Name
            </label>
            <input
              id="dealer-owner-name"
              type="text"
              disabled={loading}
              value={form.person_name}
              onChange={(e) => handleFieldChange("person_name", e.target.value)}
              placeholder="e.g. Rajesh Sharma"
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--r-sm, 10px)",
                border: fieldErrors.person_name ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                padding: "0 14px",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
            {fieldErrors.person_name && (
              <span style={{ display: "block", color: "var(--err)", fontSize: "0.8rem", marginTop: 4 }}>
                {fieldErrors.person_name}
              </span>
            )}
          </div>

          {/* 3. GST Treatment Dropdown */}
          <div>
            <label htmlFor="dealer-gst-treatment" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
              GST Treatment <span style={{ color: "var(--err)" }}>*</span>
            </label>
            <select
              id="dealer-gst-treatment"
              disabled={loading}
              value={form.gst_treatment}
              onChange={(e) => handleFieldChange("gst_treatment", e.target.value)}
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--r-sm, 10px)",
                border: "1.5px solid var(--line)",
                padding: "0 14px",
                fontSize: "0.95rem",
                background: "#fff",
                fontWeight: 600,
                color: "var(--tx)",
              }}
            >
              {GST_TREATMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 4. GSTIN (Conditional Requirement) */}
          <div>
            <label htmlFor="dealer-gst-number" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
              GSTIN {form.gst_treatment.includes("Registered") ? <span style={{ color: "var(--err)" }}>*</span> : "(Optional)"}
            </label>
            <input
              id="dealer-gst-number"
              type="text"
              required={form.gst_treatment.includes("Registered")}
              disabled={loading}
              value={form.gst_number}
              onChange={(e) => handleFieldChange("gst_number", e.target.value)}
              placeholder="e.g. 27AABCR1234D1Z5"
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--r-sm, 10px)",
                border: fieldErrors.gst_number ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                padding: "0 14px",
                fontSize: "0.95rem",
                textTransform: "uppercase",
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            />
            {fieldErrors.gst_number && (
              <span style={{ display: "block", color: "var(--err)", fontSize: "0.8rem", marginTop: 4 }}>
                {fieldErrors.gst_number}
              </span>
            )}
          </div>

          {/* 5. Address Details (Street, City, PIN Code) */}
          <div>
            <label htmlFor="dealer-address" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
              Shop / Warehouse Address
            </label>
            <input
              id="dealer-address"
              type="text"
              disabled={loading}
              value={form.address_line}
              onChange={(e) => handleFieldChange("address_line", e.target.value)}
              placeholder="Shop No., Market / Road"
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--r-sm, 10px)",
                border: "1.5px solid var(--line)",
                padding: "0 14px",
                fontSize: "0.95rem",
                marginBottom: 10,
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label htmlFor="dealer-city" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--tx)", marginBottom: 4 }}>
                  City
                </label>
                <input
                  id="dealer-city"
                  type="text"
                  disabled={loading}
                  value={form.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  placeholder="e.g. Mumbai"
                  style={{
                    width: "100%",
                    height: 46,
                    borderRadius: "var(--r-sm, 10px)",
                    border: "1.5px solid var(--line)",
                    padding: "0 12px",
                    fontSize: "0.92rem",
                  }}
                />
              </div>

              <div>
                <label htmlFor="dealer-pin" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--tx)", marginBottom: 4 }}>
                  PIN Code
                </label>
                <input
                  id="dealer-pin"
                  type="text"
                  maxLength={6}
                  disabled={loading}
                  value={form.pin}
                  onChange={(e) => handleFieldChange("pin", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="400001"
                  style={{
                    width: "100%",
                    height: 46,
                    borderRadius: "var(--r-sm, 10px)",
                    border: fieldErrors.pin ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                    padding: "0 12px",
                    fontSize: "0.92rem",
                    fontFamily: "monospace",
                  }}
                />
              </div>
            </div>
            {fieldErrors.pin && (
              <span style={{ display: "block", color: "var(--err)", fontSize: "0.8rem", marginTop: 4 }}>
                {fieldErrors.pin}
              </span>
            )}
          </div>

          {/* Submit Action Button */}
          <div style={{ marginTop: 10 }}>
            <button
              type="submit"
              className="btn btn-navy btn-block"
              disabled={loading || !canSubmit}
              style={{
                minHeight: 50,
                fontSize: "1rem",
                fontWeight: 700,
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Submitting Application…" : "Submit Dealer Application"}
            </button>

            {!canSubmit && (
              <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: "0.82rem", color: "#b45309" }}>
                ⚠ Complete email and phone verification above to unlock application submission.
              </p>
            )}
          </div>
        </form>

      </div>
    </section>
  );
}
