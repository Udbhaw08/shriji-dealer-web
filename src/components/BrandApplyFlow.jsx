import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, revalidateSession } from "../data/session";
import {
  finalizeDealerRegistration,
  requestDealerRegistrationOtp,
  verifyDealerRegistrationOtp,
} from "../data/auth";
import { GST_TREATMENT_OPTIONS } from "../data/loginCode";
import { isValidEmail, isValidPhone, isValidName, isValidGstin, isValidPincode } from "../data/validators";
import { Icon } from "../ui";

export default function BrandApplyFlow({ onBack }) {
  const session = useSession();
  const navigate = useNavigate();

  const isDealerRole = session?.role === "dealer" || session?.dealer;
  const isApprovedDealer = isDealerRole && session?.status === "approved";
  const isPendingDealer = isDealerRole && session?.status === "pending";

  useEffect(() => {
    if (isApprovedDealer) {
      navigate("/dealer", { replace: true });
    } else if (isPendingDealer) {
      navigate("/dealer/pending", { replace: true });
    }
  }, [isApprovedDealer, isPendingDealer, navigate]);

  // Stepper state: 1 = Contact Verification, 2 = Business Details, 3 = Store Location & Submit
  const [step, setStep] = useState(1);

  // Form fields
  const [form, setForm] = useState({
    business_name: "",
    person_name: session?.fullName || "",
    phone: session?.phone || "",
    email: session?.email || "",
    gst_treatment: "Registered Business - Regular",
    gst_number: "",
    address_line: "",
    city: "",
    pin: "",
  });

  // Verification state
  const [flowId, setFlowId] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);

  const [phoneVerified, setPhoneVerified] = useState(Boolean(session?.phone_verified));
  const [verifiedPhone, setVerifiedPhone] = useState(session?.phone_verified ? (session?.phone || "") : "");
  const [phoneInput, setPhoneInput] = useState(session?.phone || "");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneDevCode, setPhoneDevCode] = useState("");

  const [emailVerified, setEmailVerified] = useState(Boolean(session?.email_verified));
  const [verifiedEmail, setVerifiedEmail] = useState(session?.email_verified ? (session?.email || "") : "");
  const [emailInput, setEmailInput] = useState(session?.email || "");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailDevCode, setEmailDevCode] = useState("");

  // Step 2 & 3 errors
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Sync authenticated session details (e.g. from Google login)
  useEffect(() => {
    if (session?.email && session?.email_verified) {
      setEmailVerified(true);
      setVerifiedEmail(session.email);
      setEmailInput(session.email);
      setForm((prev) => ({ ...prev, email: session.email }));
    }
    if (session?.phone && session?.phone_verified) {
      setPhoneVerified(true);
      setVerifiedPhone(session.phone);
      setPhoneInput(session.phone);
      setForm((prev) => ({ ...prev, phone: session.phone }));
    }
    if (session?.fullName) {
      setForm((prev) => ({ ...prev, person_name: prev.person_name || session.fullName }));
    }
  }, [session?.email, session?.email_verified, session?.phone, session?.phone_verified, session?.fullName]);

  const canProceedToStep2 = phoneVerified && emailVerified;

  // Handle WhatsApp OTP Request
  const handleSendPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    setPhoneError("");
    setPhoneDevCode("");
    const clean = phoneInput.replace(/\D/g, "");
    if (!isValidPhone(clean)) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await requestDealerRegistrationOtp({
        flowId,
        channel: "phone",
        phone: clean,
      });
      if (res.flowId) setFlowId(res.flowId);
      if (res.already_verified) {
        setPhoneVerified(true);
        setVerifiedPhone(clean);
        setForm((prev) => ({ ...prev, phone: clean }));
        return;
      }
      setPhoneOtpSent(true);
      if (res.dev_code) setPhoneDevCode(res.dev_code);
    } catch (err) {
      setPhoneError(err.message || "Failed to send WhatsApp verification code.");
    } finally {
      setPhoneLoading(false);
    }
  };

  // Handle WhatsApp OTP Verify
  const handleVerifyPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    setPhoneError("");
    const cleanPhone = phoneInput.replace(/\D/g, "");
    const code = phoneOtpCode.trim();
    if (code.length < 6) {
      setPhoneError("Please enter the complete 6-digit verification code.");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await verifyDealerRegistrationOtp({
        flowId,
        channel: "phone",
        phone: cleanPhone,
        code,
      });
      setPhoneVerified(true);
      setVerifiedPhone(cleanPhone);
      setForm((prev) => ({ ...prev, phone: cleanPhone }));
      if (res.verification_token) setVerificationToken(res.verification_token);
      if (res.email_verified) setEmailVerified(true);
    } catch (err) {
      setPhoneError(err.message || "Invalid or expired WhatsApp verification code.");
    } finally {
      setPhoneLoading(false);
    }
  };

  // Handle Email OTP Request
  const handleSendEmailOtp = async (e) => {
    if (e) e.preventDefault();
    setEmailError("");
    setEmailDevCode("");
    const clean = emailInput.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setEmailError("Please enter a valid business email address.");
      return;
    }

    setEmailLoading(true);
    try {
      const res = await requestDealerRegistrationOtp({
        flowId,
        channel: "email",
        email: clean,
      });
      if (res.flowId) setFlowId(res.flowId);
      if (res.already_verified) {
        setEmailVerified(true);
        setVerifiedEmail(clean);
        setForm((prev) => ({ ...prev, email: clean }));
        return;
      }
      setEmailOtpSent(true);
      if (res.dev_code) setEmailDevCode(res.dev_code);
    } catch (err) {
      setEmailError(err.message || "Failed to send email verification code.");
    } finally {
      setEmailLoading(false);
    }
  };

  // Handle Email OTP Verify
  const handleVerifyEmailOtp = async (e) => {
    if (e) e.preventDefault();
    setEmailError("");
    const cleanEmail = emailInput.trim().toLowerCase();
    const code = emailOtpCode.trim();
    if (code.length < 6) {
      setEmailError("Please enter the complete 6-digit verification code.");
      return;
    }

    setEmailLoading(true);
    try {
      const res = await verifyDealerRegistrationOtp({
        flowId,
        channel: "email",
        email: cleanEmail,
        code,
      });
      setEmailVerified(true);
      setVerifiedEmail(cleanEmail);
      setForm((prev) => ({ ...prev, email: cleanEmail }));
      if (res.verification_token) setVerificationToken(res.verification_token);
      if (res.phone_verified) setPhoneVerified(true);
    } catch (err) {
      setEmailError(err.message || "Invalid or expired email verification code.");
    } finally {
      setEmailLoading(false);
    }
  };

  // Validate Step 2 fields
  const handleValidateStep2 = () => {
    const errs = {};
    if (!form.business_name.trim() || form.business_name.trim().length < 2) {
      errs.business_name = "Business / store name is required (min 2 characters).";
    }

    if (form.person_name.trim() && !isValidName(form.person_name.trim())) {
      errs.person_name = "Owner name should contain letters only (min 2 characters).";
    }

    if (form.gst_treatment.includes("Registered")) {
      const cleanGst = form.gst_number.trim().toUpperCase();
      if (!cleanGst) {
        errs.gst_number = "GSTIN is required for registered businesses.";
      } else if (!isValidGstin(cleanGst)) {
        errs.gst_number = "Please enter a valid 15-character GSTIN (e.g. 27AABCR1234D1Z5).";
      }
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length === 0) {
      setStep(3);
    }
  };

  // Validate Step 3 and Submit Application
  const handleSubmitApplication = async (e) => {
    if (e) e.preventDefault();
    setSubmitError("");

    const errs = {};
    if (form.pin.trim() && !isValidPincode(form.pin.trim())) {
      errs.pin = "Please enter a valid 6-digit Indian PIN code.";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitLoading(true);
    try {
      const fullAddress = [form.address_line, form.city, form.pin].filter(Boolean).join(", ");
      const payload = {
        business_name: form.business_name.trim(),
        person_name: form.person_name.trim() || undefined,
        phone: verifiedPhone.replace(/\D/g, "") || form.phone.replace(/\D/g, ""),
        email: verifiedEmail.trim().toLowerCase() || form.email.trim().toLowerCase(),
        gst_treatment: form.gst_treatment,
        gst_number: form.gst_number.trim() ? form.gst_number.toUpperCase().trim() : undefined,
        address: fullAddress || undefined,
        address_line: form.address_line.trim() || undefined,
        city: form.city.trim() || undefined,
        pin: form.pin.trim() || undefined,
        verification_token: verificationToken || undefined,
        verificationToken: verificationToken || undefined,
        flow_id: flowId || undefined,
        flowId: flowId || undefined,
      };

      await finalizeDealerRegistration(payload);
      await revalidateSession().catch(() => {});
      navigate("/dealer/pending", { replace: true });
    } catch (err) {
      setSubmitError(err.message || "Failed to submit dealership application. Please check your details.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", minWidth: 0, overflowX: "clip" }}>
      {/* Top Navigation Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "var(--navy-2, #174d7a)",
              padding: "6px 0",
            }}
          >
            ← Back to Options
          </button>
        ) : (
          <Link
            to="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "var(--navy-2, #174d7a)",
              textDecoration: "none",
              padding: "6px 0",
            }}
          >
            ← Back to Sign In
          </Link>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            background: "var(--blue-50, #eff6ff)",
            color: "var(--navy, #10263a)",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          <Icon name="badge" size={13} /> Dealership Onboarding
        </span>
      </div>

      {/* Main Card Container */}
      <div
        className="card pad"
        style={{
          boxShadow: "0 10px 30px -10px rgba(16, 38, 58, 0.12)",
          borderRadius: "var(--r-lg, 18px)",
          border: "1.5px solid var(--line, #dce4ed)",
        }}
      >
        {/* Header Block */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "var(--r, 14px)",
              background: "var(--navy, #10263a)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              boxShadow: "0 8px 20px -6px rgba(16, 38, 58, 0.35)",
            }}
          >
            <Icon name="shield" size={26} />
          </div>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 800, margin: "0 0 6px", color: "var(--tx)", letterSpacing: "-0.02em" }}>
            Apply as Brand / Dealer Partner
          </h1>
          <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.88rem", lineHeight: 1.5 }}>
            {step === 1 && "Step 1 of 3: Verify your WhatsApp and email to authenticate your business."}
            {step === 2 && "Step 2 of 3: Enter your business, store, and GST registration details."}
            {step === 3 && "Step 3 of 3: Confirm your showroom location and submit your application."}
          </p>
        </div>

        {/* Apple HIG 3-Step Progress Indicator */}
        <div
          role="navigation"
          aria-label="Application Progress"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 24,
            padding: "8px 10px",
            background: "var(--bg-2, #f0f5fc)",
            borderRadius: "var(--r, 14px)",
          }}
        >
          <div
            onClick={() => setStep(1)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 3,
              cursor: "pointer",
              padding: "6px 4px",
              borderRadius: "var(--r-sm, 10px)",
              background: step === 1 ? "#fff" : "transparent",
              boxShadow: step === 1 ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: phoneVerified && emailVerified ? "#16a34a" : step === 1 ? "var(--navy)" : "var(--line)",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {phoneVerified && emailVerified ? "✓" : "1"}
            </span>
            <span style={{ fontSize: "0.76rem", fontWeight: step === 1 ? 800 : 600, color: step === 1 ? "var(--tx)" : "var(--tx-3)" }}>
              1. Verification
            </span>
          </div>

          <div
            onClick={() => {
              if (canProceedToStep2) setStep(2);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 3,
              cursor: canProceedToStep2 ? "pointer" : "not-allowed",
              padding: "6px 4px",
              borderRadius: "var(--r-sm, 10px)",
              background: step === 2 ? "#fff" : "transparent",
              boxShadow: step === 2 ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
              opacity: canProceedToStep2 ? 1 : 0.55,
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: step === 2 ? "var(--navy)" : step > 2 ? "#16a34a" : "var(--line)",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {step > 2 ? "✓" : "2"}
            </span>
            <span style={{ fontSize: "0.76rem", fontWeight: step === 2 ? 800 : 600, color: step === 2 ? "var(--tx)" : "var(--tx-3)" }}>
              2. Business Info
            </span>
          </div>

          <div
            onClick={() => {
              if (canProceedToStep2 && form.business_name.trim().length >= 2) setStep(3);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 3,
              cursor: canProceedToStep2 && form.business_name.trim().length >= 2 ? "pointer" : "not-allowed",
              padding: "6px 4px",
              borderRadius: "var(--r-sm, 10px)",
              background: step === 3 ? "#fff" : "transparent",
              boxShadow: step === 3 ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
              opacity: canProceedToStep2 && form.business_name.trim().length >= 2 ? 1 : 0.55,
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: step === 3 ? "var(--navy)" : "var(--line)",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              3
            </span>
            <span style={{ fontSize: "0.76rem", fontWeight: step === 3 ? 800 : 600, color: step === 3 ? "var(--tx)" : "var(--tx-3)" }}>
              3. Location & Submit
            </span>
          </div>
        </div>

        {/* Global Error Notice if any */}
        {submitError && (
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
              fontSize: "0.86rem",
              marginBottom: 18,
              lineHeight: 1.45,
            }}
          >
            <Icon name="flame" size={16} />
            <div style={{ flex: 1 }}>{submitError}</div>
          </div>
        )}

        {/* ========================================================
            STEP 1: CONTACT VERIFICATION FIRST (Zero Clutter)
            ======================================================== */}
        {step === 1 && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Instruction helper */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "11px 14px",
                background: "rgba(37, 99, 235, 0.05)",
                border: "1px solid rgba(37, 99, 235, 0.16)",
                borderRadius: "var(--r-sm, 10px)",
                fontSize: "0.84rem",
                color: "var(--tx-2)",
                lineHeight: 1.45,
              }}
            >
              <div style={{ color: "#2563eb", marginTop: 1, flexShrink: 0 }}>
                <Icon name="shield" size={15} />
              </div>
              <div>
                <strong style={{ color: "var(--tx)", display: "block", marginBottom: 2 }}>
                  Prerequisite: Two-Channel Contact Verification
                </strong>
                Wholesale dealership status requires verifying both your <strong>WhatsApp Phone Number</strong> and <strong>Official Email</strong> before submitting your business profile.
              </div>
            </div>

            {/* Verification Tile 1: WhatsApp Mobile Phone */}
            <div
              style={{
                padding: 16,
                borderRadius: "var(--r, 14px)",
                border: phoneVerified ? "1.5px solid #86efac" : "1.5px solid var(--line, #dce4ed)",
                background: phoneVerified ? "#f0fdf4" : "#ffffff",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: phoneVerified ? "#166534" : "var(--tx)" }}>
                  1. WhatsApp Mobile Phone
                </span>
                {phoneVerified ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "3px 10px", borderRadius: 999 }}>
                    ✓ Phone Verified
                  </span>
                ) : (
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "3px 10px", borderRadius: 999 }}>
                    Verification Required
                  </span>
                )}
              </div>

              {phoneVerified ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#166534" }}>
                    +91 {verifiedPhone}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneVerified(false);
                      setPhoneOtpSent(false);
                      setPhoneOtpCode("");
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--tx-3)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Change Number
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {!phoneOtpSent ? (
                    <form onSubmit={handleSendPhoneOtp} style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", border: "1.5px solid var(--line)", borderRadius: "var(--r-sm, 10px)", overflow: "hidden", background: "#fff" }}>
                        <div style={{ padding: "0 12px", height: 48, display: "flex", alignItems: "center", background: "var(--bg-2)", borderRight: "1.5px solid var(--line)", fontWeight: 700, fontSize: "0.92rem", color: "var(--navy)" }}>
                          +91
                        </div>
                        <input
                          type="tel"
                          inputMode="tel"
                          placeholder="98765 43210"
                          value={phoneInput}
                          onChange={(e) => {
                            setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10));
                            setPhoneError("");
                          }}
                          disabled={phoneLoading}
                          style={{ flex: 1, height: 48, border: "none", outline: "none", padding: "0 12px", fontSize: "1rem", fontWeight: 600 }}
                        />
                      </div>

                      {phoneError && (
                        <span style={{ color: "var(--err)", fontSize: "0.8rem", fontWeight: 600 }}>{phoneError}</span>
                      )}

                      <button
                        type="submit"
                        disabled={phoneLoading || phoneInput.replace(/\D/g, "").length !== 10}
                        className="btn btn-navy btn-block"
                        style={{ height: 46, fontSize: "0.9rem", fontWeight: 700 }}
                      >
                        {phoneLoading ? "Sending OTP via WhatsApp..." : "Send WhatsApp OTP Code"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPhoneOtp} style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: "0.84rem", color: "var(--tx-2)" }}>
                        Enter 6-digit WhatsApp code sent to <strong>+91 {phoneInput}</strong>:
                      </div>

                      {phoneDevCode && (
                        <div style={{ padding: "4px 8px", borderRadius: 6, background: "#f0fdf4", color: "#166534", fontSize: "0.78rem", fontWeight: 600 }}>
                          Dev Test OTP: <strong>{phoneDevCode}</strong>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          autoFocus
                          placeholder="123456"
                          value={phoneOtpCode}
                          onChange={(e) => {
                            setPhoneOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setPhoneError("");
                          }}
                          style={{
                            flex: 1,
                            height: 48,
                            borderRadius: "var(--r-sm, 10px)",
                            border: "1.5px solid var(--navy)",
                            textAlign: "center",
                            fontSize: "1.2rem",
                            fontWeight: 800,
                            letterSpacing: "0.25em",
                          }}
                        />
                        <button
                          type="submit"
                          disabled={phoneLoading || phoneOtpCode.length !== 6}
                          className="btn btn-navy"
                          style={{ height: 48, padding: "0 18px", fontWeight: 700, fontSize: "0.9rem" }}
                        >
                          {phoneLoading ? "Verifying..." : "Verify Code"}
                        </button>
                      </div>

                      {phoneError && (
                        <span style={{ color: "var(--err)", fontSize: "0.8rem", fontWeight: 600 }}>{phoneError}</span>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <button
                          type="button"
                          onClick={() => setPhoneOtpSent(false)}
                          style={{ background: "transparent", border: "none", color: "var(--tx-3)", cursor: "pointer", textDecoration: "underline" }}
                        >
                          Change Number
                        </button>
                        <button
                          type="button"
                          onClick={handleSendPhoneOtp}
                          disabled={phoneLoading}
                          style={{ background: "transparent", border: "none", color: "var(--navy-2)", fontWeight: 700, cursor: "pointer" }}
                        >
                          Resend WhatsApp Code
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Verification Tile 2: Official Business Email */}
            <div
              style={{
                padding: 16,
                borderRadius: "var(--r, 14px)",
                border: emailVerified ? "1.5px solid #86efac" : "1.5px solid var(--line, #dce4ed)",
                background: emailVerified ? "#f0fdf4" : "#ffffff",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: emailVerified ? "#166534" : "var(--tx)" }}>
                  2. Official Business Email
                </span>
                {emailVerified ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.78rem", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "3px 10px", borderRadius: 999 }}>
                    ✓ Email Verified
                  </span>
                ) : (
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "3px 10px", borderRadius: 999 }}>
                    Verification Required
                  </span>
                )}
              </div>

              {emailVerified ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#166534", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {verifiedEmail}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailVerified(false);
                      setEmailOtpSent(false);
                      setEmailOtpCode("");
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--tx-3)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                      flexShrink: 0,
                    }}
                  >
                    Change Email
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {!emailOtpSent ? (
                    <form onSubmit={handleSendEmailOtp} style={{ display: "grid", gap: 10 }}>
                      <input
                        type="email"
                        inputMode="email"
                        placeholder="owner@yourbusiness.com"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          setEmailError("");
                        }}
                        disabled={emailLoading}
                        style={{
                          height: 48,
                          borderRadius: "var(--r-sm, 10px)",
                          border: "1.5px solid var(--line)",
                          outline: "none",
                          padding: "0 14px",
                          fontSize: "0.98rem",
                          fontWeight: 600,
                        }}
                      />

                      {emailError && (
                        <span style={{ color: "var(--err)", fontSize: "0.8rem", fontWeight: 600 }}>{emailError}</span>
                      )}

                      <button
                        type="submit"
                        disabled={emailLoading || !emailInput.includes("@")}
                        className="btn btn-navy btn-block"
                        style={{ height: 46, fontSize: "0.9rem", fontWeight: 700 }}
                      >
                        {emailLoading ? "Sending Email Code..." : "Send Email Verification OTP"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyEmailOtp} style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: "0.84rem", color: "var(--tx-2)" }}>
                        Enter 6-digit code sent to <strong>{emailInput}</strong>:
                      </div>

                      {emailDevCode && (
                        <div style={{ padding: "4px 8px", borderRadius: 6, background: "#f0fdf4", color: "#166534", fontSize: "0.78rem", fontWeight: 600 }}>
                          Dev Test OTP: <strong>{emailDevCode}</strong>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          autoFocus
                          placeholder="123456"
                          value={emailOtpCode}
                          onChange={(e) => {
                            setEmailOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setEmailError("");
                          }}
                          style={{
                            flex: 1,
                            height: 48,
                            borderRadius: "var(--r-sm, 10px)",
                            border: "1.5px solid var(--navy)",
                            textAlign: "center",
                            fontSize: "1.2rem",
                            fontWeight: 800,
                            letterSpacing: "0.25em",
                          }}
                        />
                        <button
                          type="submit"
                          disabled={emailLoading || emailOtpCode.length !== 6}
                          className="btn btn-navy"
                          style={{ height: 48, padding: "0 18px", fontWeight: 700, fontSize: "0.9rem" }}
                        >
                          {emailLoading ? "Verifying..." : "Verify Code"}
                        </button>
                      </div>

                      {emailError && (
                        <span style={{ color: "var(--err)", fontSize: "0.8rem", fontWeight: 600 }}>{emailError}</span>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                        <button
                          type="button"
                          onClick={() => setEmailOtpSent(false)}
                          style={{ background: "transparent", border: "none", color: "var(--tx-3)", cursor: "pointer", textDecoration: "underline" }}
                        >
                          Change Email
                        </button>
                        <button
                          type="button"
                          onClick={handleSendEmailOtp}
                          disabled={emailLoading}
                          style={{ background: "transparent", border: "none", color: "var(--navy-2)", fontWeight: 700, cursor: "pointer" }}
                        >
                          Resend Email Code
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Step 1 Continue Action Button */}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2}
                className="btn btn-navy btn-block"
                style={{
                  height: 52,
                  fontSize: "1rem",
                  fontWeight: 700,
                  opacity: canProceedToStep2 ? 1 : 0.6,
                  cursor: canProceedToStep2 ? "pointer" : "not-allowed",
                  boxShadow: canProceedToStep2 ? "0 8px 24px -6px rgba(16, 38, 58, 0.45)" : "none",
                }}
              >
                Continue to Business Details →
              </button>

              {!canProceedToStep2 && (
                <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: "0.8rem", color: "var(--tx-3)" }}>
                  Complete both WhatsApp and Email verifications above to unlock Step 2.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 2: BUSINESS & TAX PROFILE (Clear & High Contrast)
            ======================================================== */}
        {step === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleValidateStep2();
            }}
            style={{ display: "grid", gap: 16 }}
          >
            {/* Field: Business / Store Name */}
            <div>
              <label htmlFor="flow-business-name" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                Business / Store Name <span style={{ color: "var(--err)" }}>*</span>
              </label>
              <input
                id="flow-business-name"
                type="text"
                required
                placeholder="e.g. Sunshine Kitchen Appliances & Electronics"
                value={form.business_name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, business_name: e.target.value }));
                  setFieldErrors((fe) => ({ ...fe, business_name: null }));
                }}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: "var(--r-sm, 10px)",
                  border: fieldErrors.business_name ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                  padding: "0 14px",
                  fontSize: "0.96rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.business_name && (
                <span style={{ color: "var(--err)", fontSize: "0.8rem", marginTop: 4, display: "block" }}>
                  {fieldErrors.business_name}
                </span>
              )}
            </div>

            {/* Field: Owner / Authorized Person Name */}
            <div>
              <label htmlFor="flow-owner-name" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                Owner / Authorized Person Name
              </label>
              <input
                id="flow-owner-name"
                type="text"
                placeholder="e.g. Rajesh Sharma"
                value={form.person_name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, person_name: e.target.value }));
                  setFieldErrors((fe) => ({ ...fe, person_name: null }));
                }}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: "var(--r-sm, 10px)",
                  border: fieldErrors.person_name ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                  padding: "0 14px",
                  fontSize: "0.96rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.person_name && (
                <span style={{ color: "var(--err)", fontSize: "0.8rem", marginTop: 4, display: "block" }}>
                  {fieldErrors.person_name}
                </span>
              )}
            </div>

            {/* Field: GST Treatment */}
            <div>
              <label htmlFor="flow-gst-treatment" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                GST Treatment Category <span style={{ color: "var(--err)" }}>*</span>
              </label>
              <select
                id="flow-gst-treatment"
                value={form.gst_treatment}
                onChange={(e) => setForm((f) => ({ ...f, gst_treatment: e.target.value }))}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: "var(--r-sm, 10px)",
                  border: "1.5px solid var(--line)",
                  padding: "0 14px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  background: "#fff",
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

            {/* Field: GSTIN Number */}
            <div>
              <label htmlFor="flow-gst-number" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                GSTIN {form.gst_treatment.includes("Registered") ? <span style={{ color: "var(--err)" }}>*</span> : "(Optional)"}
              </label>
              <input
                id="flow-gst-number"
                type="text"
                placeholder="27AABCR1234D1Z5"
                value={form.gst_number}
                onChange={(e) => {
                  setForm((f) => ({ ...f, gst_number: e.target.value.toUpperCase().trim() }));
                  setFieldErrors((fe) => ({ ...fe, gst_number: null }));
                }}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: "var(--r-sm, 10px)",
                  border: fieldErrors.gst_number ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                  padding: "0 14px",
                  fontSize: "1rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.gst_number && (
                <span style={{ color: "var(--err)", fontSize: "0.8rem", marginTop: 4, display: "block" }}>
                  {fieldErrors.gst_number}
                </span>
              )}
            </div>

            {/* Step 2 Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-ghost"
                style={{ height: 50, fontWeight: 700 }}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="btn btn-navy"
                style={{ height: 50, fontWeight: 700 }}
              >
                Continue to Location →
              </button>
            </div>
          </form>
        )}

        {/* ========================================================
            STEP 3: LOCATION & FINAL APPLICATION SUBMISSION
            ======================================================== */}
        {step === 3 && (
          <form onSubmit={handleSubmitApplication} style={{ display: "grid", gap: 16 }}>
            {/* Field: Address */}
            <div>
              <label htmlFor="flow-address" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                Shop / Showroom Address
              </label>
              <input
                id="flow-address"
                type="text"
                placeholder="Shop No., Market / Commercial Road"
                value={form.address_line}
                onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: "var(--r-sm, 10px)",
                  border: "1.5px solid var(--line)",
                  padding: "0 14px",
                  fontSize: "0.96rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* City & PIN */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="flow-city" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                  City
                </label>
                <input
                  id="flow-city"
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: "var(--r-sm, 10px)",
                    border: "1.5px solid var(--line)",
                    padding: "0 14px",
                    fontSize: "0.96rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label htmlFor="flow-pin" style={{ display: "block", fontSize: "0.84rem", fontWeight: 700, color: "var(--tx)", marginBottom: 6 }}>
                  PIN Code
                </label>
                <input
                  id="flow-pin"
                  type="text"
                  maxLength={6}
                  placeholder="400001"
                  value={form.pin}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }));
                    setFieldErrors((fe) => ({ ...fe, pin: null }));
                  }}
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: "var(--r-sm, 10px)",
                    border: fieldErrors.pin ? "1.5px solid var(--err)" : "1.5px solid var(--line)",
                    padding: "0 14px",
                    fontSize: "0.96rem",
                    fontFamily: "monospace",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.pin && (
                  <span style={{ color: "var(--err)", fontSize: "0.78rem", marginTop: 4, display: "block" }}>
                    {fieldErrors.pin}
                  </span>
                )}
              </div>
            </div>

            {/* Review Summary Capsule */}
            <div
              style={{
                marginTop: 6,
                padding: "14px 16px",
                background: "var(--bg-2, #f0f5fc)",
                borderRadius: "var(--r-sm, 10px)",
                border: "1px solid var(--line)",
                fontSize: "0.84rem",
                color: "var(--tx-2)",
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontWeight: 800, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.76rem" }}>
                Application Summary Check
              </div>
              <div>
                <strong>Business:</strong> {form.business_name} {form.gst_number ? `(${form.gst_number})` : ""}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>✓ Phone: +91 {verifiedPhone}</span>
                <span>✓ Email: {verifiedEmail}</span>
              </div>
            </div>

            {/* Step 3 Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-ghost"
                disabled={submitLoading}
                style={{ height: 52, fontWeight: 700 }}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="btn btn-navy"
                style={{
                  height: 52,
                  fontWeight: 700,
                  fontSize: "0.96rem",
                  boxShadow: "0 8px 24px -6px rgba(16, 38, 58, 0.45)",
                }}
              >
                {submitLoading ? "Submitting Application..." : "Submit Application ✓"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
