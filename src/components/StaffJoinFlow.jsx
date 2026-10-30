import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { lookupStaffCode, requestDealerRegistrationOtp, verifyDealerRegistrationOtp, staffSignup } from "../data/auth";
import { useSession, revalidateSession } from "../data/session";
import { formatLoginCode } from "../data/loginCode";
import { isValidEmail, isValidPhone, isValidName } from "../data/validators";
import { Icon } from "../ui";
import OtpDispatchFeedback from "./OtpDispatchFeedback";

export default function StaffJoinFlow({
  initialCode = "",
  onSuccess,
  onSwitchToLogin,
}) {
  const navigate = useNavigate();
  const session = useSession();

  // Store Code State
  const [code, setCode] = useState(formatLoginCode(initialCode));
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [storeInfo, setStoreInfo] = useState(null);

  // Two-Channel Verification State
  const [flowId, setFlowId] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);

  // Phone Channel
  const [phoneInput, setPhoneInput] = useState(session?.phone || "");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(Boolean(session?.phone_verified && session?.phone));
  const [verifiedPhone, setVerifiedPhone] = useState(session?.phone_verified ? session.phone : "");
  const [phoneError, setPhoneError] = useState("");
  const [phoneDevCode, setPhoneDevCode] = useState("");
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Email Channel
  const [emailInput, setEmailInput] = useState(session?.email || "");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(Boolean(session?.email_verified && session?.email));
  const [verifiedEmail, setVerifiedEmail] = useState(session?.email_verified ? session.email : "");
  const [emailError, setEmailError] = useState("");
  const [emailDevCode, setEmailDevCode] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Account Creation Fields (Step 3)
  const [fullName, setFullName] = useState(session?.fullName || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Timers
  const phoneTimerRef = useRef(null);
  const emailTimerRef = useRef(null);
  const initialLookupAttempted = useRef(false);

  useEffect(() => {
    if (phoneCooldown > 0) {
      phoneTimerRef.current = setTimeout(() => setPhoneCooldown((c) => c - 1), 1000);
    }
    return () => {
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, [phoneCooldown]);

  useEffect(() => {
    if (emailCooldown > 0) {
      emailTimerRef.current = setTimeout(() => setEmailCooldown((c) => c - 1), 1000);
    }
    return () => {
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    };
  }, [emailCooldown]);

  // Lookup store code
  const handleLookup = async (codeToVerify) => {
    const raw = String(codeToVerify || code).trim();
    if (!raw) {
      setLookupError("Please enter your Store / Dealer Code");
      return;
    }
    setLookupError("");
    setLookupLoading(true);
    try {
      const res = await lookupStaffCode(raw);
      setStoreInfo(res);
      setLookupError("");
    } catch (err) {
      setStoreInfo(null);
      setLookupError(err.message || "Invalid or unrecognized Dealer / Business Code");
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode && !initialLookupAttempted.current) {
      initialLookupAttempted.current = true;
      handleLookup(initialCode);
    }
  }, [initialCode]);

  // Request WhatsApp Phone OTP
  const handleSendPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    setPhoneError("");
    setPhoneDevCode("");
    const clean = phoneInput.replace(/\D/g, "");
    if (!isValidPhone(clean)) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await requestDealerRegistrationOtp({
        flowId,
        channel: "phone",
        phone: clean,
        email: verifiedEmail || emailInput,
      });
      if (res.flowId) setFlowId(res.flowId);
      if (res.already_verified) {
        setPhoneVerified(true);
        setVerifiedPhone(clean);
        return;
      }
      setPhoneOtpSent(true);
      setPhoneCooldown(60);
      if (res.dev_code) setPhoneDevCode(res.dev_code);
    } catch (err) {
      setPhoneError(err.message || "Failed to send WhatsApp verification code");
    } finally {
      setPhoneLoading(false);
    }
  };

  // Verify WhatsApp Phone OTP
  const handleVerifyPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    setPhoneError("");
    const cleanPhone = phoneInput.replace(/\D/g, "");
    const codeVal = phoneOtpCode.trim();
    if (codeVal.length < 6) {
      setPhoneError("Please enter the complete 6-digit verification code");
      return;
    }

    setPhoneLoading(true);
    try {
      const res = await verifyDealerRegistrationOtp({
        flowId,
        channel: "phone",
        phone: cleanPhone,
        email: verifiedEmail || emailInput,
        code: codeVal,
      });
      setPhoneVerified(true);
      setVerifiedPhone(cleanPhone);
      if (res.verification_token) setVerificationToken(res.verification_token);
      if (res.email_verified) setEmailVerified(true);
    } catch (err) {
      setPhoneError(err.message || "Invalid or expired WhatsApp verification code");
    } finally {
      setPhoneLoading(false);
    }
  };

  // Request Work Email OTP
  const handleSendEmailOtp = async (e) => {
    if (e) e.preventDefault();
    setEmailError("");
    setEmailDevCode("");
    const clean = emailInput.trim().toLowerCase();
    if (!isValidEmail(clean)) {
      setEmailError("Please enter a valid work email address");
      return;
    }

    setEmailLoading(true);
    try {
      const res = await requestDealerRegistrationOtp({
        flowId,
        channel: "email",
        email: clean,
        phone: verifiedPhone || phoneInput,
      });
      if (res.flowId) setFlowId(res.flowId);
      if (res.already_verified) {
        setEmailVerified(true);
        setVerifiedEmail(clean);
        return;
      }
      setEmailOtpSent(true);
      setEmailCooldown(60);
      if (res.dev_code) setEmailDevCode(res.dev_code);
    } catch (err) {
      setEmailError(err.message || "Failed to send email verification code");
    } finally {
      setEmailLoading(false);
    }
  };

  // Verify Work Email OTP
  const handleVerifyEmailOtp = async (e) => {
    if (e) e.preventDefault();
    setEmailError("");
    const cleanEmail = emailInput.trim().toLowerCase();
    const codeVal = emailOtpCode.trim();
    if (codeVal.length < 6) {
      setEmailError("Please enter the complete 6-digit verification code");
      return;
    }

    setEmailLoading(true);
    try {
      const res = await verifyDealerRegistrationOtp({
        flowId,
        channel: "email",
        email: cleanEmail,
        phone: verifiedPhone || phoneInput,
        code: codeVal,
      });
      setEmailVerified(true);
      setVerifiedEmail(cleanEmail);
      if (res.verification_token) setVerificationToken(res.verification_token);
      if (res.phone_verified) setPhoneVerified(true);
    } catch (err) {
      setEmailError(err.message || "Invalid or expired email verification code");
    } finally {
      setEmailLoading(false);
    }
  };

  // Form validation for Account Creation
  const validateCreationForm = () => {
    const errs = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = "Please enter your full name (minimum 2 characters)";
    } else if (!isValidName(fullName)) {
      errs.fullName = "Name should contain letters only";
    }

    if (!password || password.length < 8) {
      errs.password = "Password must be at least 8 characters long";
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle final registration submission
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!storeInfo) return;
    if (!phoneVerified || !emailVerified || !verificationToken) {
      setSubmitError("Please verify both your Mobile Phone and Work Email before proceeding.");
      return;
    }
    if (!validateCreationForm()) return;

    setSubmitLoading(true);
    setSubmitError("");

    try {
      await staffSignup({
        dealer_code: storeInfo.dealer_code || code,
        invite_code: storeInfo.dealer_code || code,
        email: verifiedEmail,
        phone: verifiedPhone,
        password,
        full_name: fullName.trim(),
        flowId,
        verificationToken,
      });

      await revalidateSession(true).catch(() => {});
      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/dealer/pending?kind=staff", { replace: true });
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to complete staff registration. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const bothVerified = phoneVerified && emailVerified && Boolean(verificationToken);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* STEP 1: STORE / DEALER CODE */}
      {!storeInfo ? (
        <form onSubmit={(e) => { e.preventDefault(); handleLookup(); }} style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="staff-flow-code" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 6 }}>
              Store / Dealer Code
            </label>
            <input
              id="staff-flow-code"
              type="text"
              placeholder="e.g. SHR-12345 or DE-ABC-1234"
              value={code}
              onChange={(e) => {
                setCode(formatLoginCode(e.target.value));
                setLookupError("");
              }}
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--r-sm, 10px)",
                border: "1.5px solid var(--line, #cbd5e1)",
                padding: "0 14px",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxSizing: "border-box",
              }}
            />
          </div>

          {lookupError && (
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: "0.85rem" }}>
              {lookupError}
            </div>
          )}

          <button
            type="submit"
            disabled={lookupLoading || !code.trim()}
            className="btn btn-navy btn-block"
            style={{ height: 48, fontWeight: 700 }}
          >
            {lookupLoading ? "Verifying Code..." : "Verify Store Code →"}
          </button>

          {onSwitchToLogin && (
            <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.85rem", color: "var(--tx-2, #64748b)" }}>
              Already registered as staff?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--brand, #0f172a)",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Sign In here
              </button>
            </div>
          )}
        </form>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Verified Store Card */}
          <div style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "#f0fdf4",
            border: "1.5px solid #86efac",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <Icon name="check" size={13} />
                Verified Dealership Store
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--tx, #0f172a)", marginTop: 2 }}>
                {storeInfo.name || storeInfo.business_name || "Authorized Dealership"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--tx-2, #64748b)" }}>
                Code: <strong style={{ color: "var(--tx)" }}>{storeInfo.dealer_code || code}</strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setStoreInfo(null);
                setCode("");
                setFlowId(null);
                setVerificationToken(null);
                setPhoneVerified(false);
                setEmailVerified(false);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--tx-3, #94a3b8)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Change
            </button>
          </div>

          {/* Prerequisite Helper Banner */}
          <div style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "11px 14px",
            background: "rgba(37, 99, 235, 0.05)",
            border: "1px solid rgba(37, 99, 235, 0.16)",
            borderRadius: 10,
            fontSize: "0.84rem",
            color: "var(--tx-2, #475569)",
            lineHeight: 1.45,
          }}>
            <div style={{ color: "#2563eb", marginTop: 1, flexShrink: 0 }}>
              <Icon name="shield" size={15} />
            </div>
            <div>
              <strong style={{ color: "var(--tx, #0f172a)", display: "block", marginBottom: 2 }}>
                Two-Channel Verification Required
              </strong>
              Verify both your WhatsApp mobile number and work email to establish your verified staff credentials and CRM record.
            </div>
          </div>

          {/* CHANNEL 1: WHATSAPP MOBILE PHONE */}
          <div style={{
            padding: 16,
            borderRadius: 12,
            border: phoneVerified ? "1.5px solid #86efac" : "1.5px solid var(--line, #cbd5e1)",
            background: phoneVerified ? "#f0fdf4" : "#ffffff",
            transition: "all 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: phoneVerified ? "#166534" : "var(--tx, #0f172a)" }}>
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
                    setVerificationToken(null);
                  }}
                  style={{ background: "transparent", border: "none", color: "var(--tx-3)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
                >
                  Change Number
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {!phoneOtpSent ? (
                  <form onSubmit={handleSendPhoneOtp} style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", border: "1.5px solid var(--line, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ padding: "0 12px", height: 46, display: "flex", alignItems: "center", background: "var(--bg-2, #f1f5f9)", borderRight: "1.5px solid var(--line, #cbd5e1)", fontWeight: 700, fontSize: "0.92rem", color: "var(--navy, #10263a)" }}>
                        +91
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="98765 43210"
                        maxLength={10}
                        value={phoneInput}
                        onChange={(e) => {
                          setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10));
                          setPhoneError("");
                        }}
                        style={{ flex: 1, border: "none", outline: "none", padding: "0 12px", fontSize: "0.95rem" }}
                      />
                    </div>
                    {phoneError && (
                      <div style={{ fontSize: "0.82rem", color: "#dc2626" }}>{phoneError}</div>
                    )}
                    <button
                      type="submit"
                      disabled={phoneLoading || phoneInput.replace(/\D/g, "").length !== 10}
                      className="btn btn-navy"
                      style={{ height: 44, fontWeight: 700 }}
                    >
                      {phoneLoading ? "Sending OTP..." : "Get WhatsApp OTP →"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyPhoneOtp} style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: "0.84rem", color: "var(--tx-2, #64748b)" }}>
                      Enter 6-digit WhatsApp verification code sent to <strong>+91 {phoneInput}</strong>
                    </div>
                    {phoneDevCode && (
                      <OtpDispatchFeedback channel="phone" devCode={phoneDevCode} />
                    )}
                    <input
                      type="text"
                      required
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      value={phoneOtpCode}
                      onChange={(e) => {
                        setPhoneOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setPhoneError("");
                      }}
                      style={{ height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 12px", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.2em", textAlign: "center" }}
                    />
                    {phoneError && (
                      <div style={{ fontSize: "0.82rem", color: "#dc2626" }}>{phoneError}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        disabled={phoneLoading || phoneOtpCode.length !== 6}
                        className="btn btn-navy"
                        style={{ flex: 1, height: 44, fontWeight: 700 }}
                      >
                        {phoneLoading ? "Verifying..." : "Verify Mobile →"}
                      </button>
                      <button
                        type="button"
                        disabled={phoneCooldown > 0 || phoneLoading}
                        onClick={handleSendPhoneOtp}
                        className="btn btn-ghost"
                        style={{ height: 44, fontSize: "0.84rem" }}
                      >
                        {phoneCooldown > 0 ? `Resend (${phoneCooldown}s)` : "Resend"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* CHANNEL 2: WORK EMAIL */}
          <div style={{
            padding: 16,
            borderRadius: 12,
            border: emailVerified ? "1.5px solid #86efac" : "1.5px solid var(--line, #cbd5e1)",
            background: emailVerified ? "#f0fdf4" : "#ffffff",
            transition: "all 0.2s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: emailVerified ? "#166534" : "var(--tx, #0f172a)" }}>
                2. Work Email Address
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
                <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#166534" }}>
                  {verifiedEmail}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmailVerified(false);
                    setEmailOtpSent(false);
                    setEmailOtpCode("");
                    setVerificationToken(null);
                  }}
                  style={{ background: "transparent", border: "none", color: "var(--tx-3)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
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
                      required
                      placeholder="staff@dealership.com"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setEmailError("");
                      }}
                      style={{ height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 12px", fontSize: "0.95rem" }}
                    />
                    {emailError && (
                      <div style={{ fontSize: "0.82rem", color: "#dc2626" }}>{emailError}</div>
                    )}
                    <button
                      type="submit"
                      disabled={emailLoading || !isValidEmail(emailInput)}
                      className="btn btn-navy"
                      style={{ height: 44, fontWeight: 700 }}
                    >
                      {emailLoading ? "Sending OTP..." : "Get Email OTP →"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyEmailOtp} style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: "0.84rem", color: "var(--tx-2, #64748b)" }}>
                      Enter 6-digit verification code sent to <strong>{emailInput}</strong>
                    </div>
                    {emailDevCode && (
                      <OtpDispatchFeedback channel="email" devCode={emailDevCode} />
                    )}
                    <input
                      type="text"
                      required
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      value={emailOtpCode}
                      onChange={(e) => {
                        setEmailOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setEmailError("");
                      }}
                      style={{ height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 12px", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.2em", textAlign: "center" }}
                    />
                    {emailError && (
                      <div style={{ fontSize: "0.82rem", color: "#dc2626" }}>{emailError}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="submit"
                        disabled={emailLoading || emailOtpCode.length !== 6}
                        className="btn btn-navy"
                        style={{ flex: 1, height: 44, fontWeight: 700 }}
                      >
                        {emailLoading ? "Verifying..." : "Verify Email →"}
                      </button>
                      <button
                        type="button"
                        disabled={emailCooldown > 0 || emailLoading}
                        onClick={handleSendEmailOtp}
                        className="btn btn-ghost"
                        style={{ height: 44, fontSize: "0.84rem" }}
                      >
                        {emailCooldown > 0 ? `Resend (${emailCooldown}s)` : "Resend"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* STEP 3: ACCOUNT CREATION (Unlocked only when both channels verified) */}
          {bothVerified && (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, paddingTop: 10, borderTop: "1.5px dashed var(--line, #cbd5e1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: 800, color: "var(--navy, #10263a)" }}>
                <Icon name="badge" size={16} /> 3. Complete Staff Profile & Password
              </div>

              <div>
                <label htmlFor="staff-fullname-flow" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                  Full Name (letters only)
                </label>
                <input
                  id="staff-fullname-flow"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) setFieldErrors((f) => ({ ...f, fullName: null }));
                  }}
                  style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 12px", fontSize: "0.95rem", boxSizing: "border-box" }}
                />
                {fieldErrors.fullName && (
                  <div style={{ fontSize: "0.82rem", color: "#dc2626", marginTop: 4 }}>{fieldErrors.fullName}</div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label htmlFor="staff-pass-flow" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                    Password (8+ chars)
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="staff-pass-flow"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: null }));
                      }}
                      style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 36px 0 12px", fontSize: "0.95rem", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "var(--tx-3)", cursor: "pointer", padding: 4 }}
                    >
                      <Icon name={showPassword ? "eyeoff" : "eye"} size={15} />
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <div style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: 4 }}>{fieldErrors.password}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="staff-cpass-flow" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                    Confirm Password
                  </label>
                  <input
                    id="staff-cpass-flow"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((f) => ({ ...f, confirmPassword: null }));
                    }}
                    style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 12px", fontSize: "0.95rem", boxSizing: "border-box" }}
                  />
                  {fieldErrors.confirmPassword && (
                    <div style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: 4 }}>{fieldErrors.confirmPassword}</div>
                  )}
                </div>
              </div>

              {submitError && (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: "0.85rem" }}>
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitLoading}
                className="btn btn-navy btn-block"
                style={{ height: 48, fontWeight: 700, marginTop: 6 }}
              >
                {submitLoading ? "Completing Staff Registration..." : "Complete Staff Registration →"}
              </button>
            </form>
          )}

          {onSwitchToLogin && (
            <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.85rem", color: "var(--tx-2, #64748b)" }}>
              Already registered as staff?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--brand, #0f172a)",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Sign In here
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
