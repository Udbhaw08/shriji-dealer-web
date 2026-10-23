import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSession, signOut, switchToDealerSession, switchToViewerSession } from "../data/session";
import { isDealer } from "../data/dealer";
import { requestOtp, verifyOtp } from "../data/auth";
import { revalidateSession } from "../data/session";
import { Icon } from "../ui";

const RESEND_COOLDOWN_SECONDS = 30;

export default function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation target from protected route redirection (or default)
  const fromPath = location.state?.from?.pathname || (session?.role === "dealer" ? "/products" : "/products");

  // Form states
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRefs = useRef([]);
  const cooldownTimerRef = useRef(null);

  const isAuthenticated = session && session.role !== "guest";
  const dealerActive = isDealer(session);

  // Clean phone input (digits only, max 10)
  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (error) setError(null);
  };

  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setCooldown((c) => c - 1);
      }, 1000);
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [cooldown]);

  // Auto-focus first OTP input on switching to OTP step
  useEffect(() => {
    if (step === "otp" && otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Request WhatsApp OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!isPhoneValid || loading) return;

    setLoading(true);
    setError(null);

    try {
      await requestOtp(phone);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err.message || "Failed to send WhatsApp verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    await handleSendOtp();
  };

  // OTP digit entry handling
  const handleOtpDigitChange = (index, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (error) setError(null);

    // Auto-advance
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit on 6th digit if complete
    if (digit && index === 5) {
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  // OTP Keydown handling for backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // OTP Paste handling (distributes 6 digits across inputs)
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);
    if (error) setError(null);

    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otp.join("");
    if (code.length !== 6 || loading) return;

    setLoading(true);
    setError(null);

    try {
      await verifyOtp(phone, code);
      // Refresh active session from /api/auth/me
      const freshSession = await revalidateSession();

      // Navigate based on user role and state
      if (freshSession?.role === "dealer") {
        navigate(fromPath !== "/login" ? fromPath : "/products", { replace: true });
      } else {
        navigate(fromPath !== "/login" ? fromPath : "/products", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Invalid verification code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="sec" style={{ paddingTop: "clamp(var(--s4), 5vw, var(--s7))", minHeight: "80vh" }}>
      <div className="wrap" style={{ maxWidth: 460, margin: "0 auto", minWidth: 0, overflowX: "clip" }}>

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "var(--s5)" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "var(--r, 14px)",
              background: "#25D366",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px -6px rgba(37, 211, 102, 0.45)",
              marginBottom: 14,
            }}
          >
            <Icon name="wa" size={28} />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 8px", color: "var(--tx)", letterSpacing: "-0.02em" }}>
            {isAuthenticated ? "Your Account" : step === "phone" ? "Sign In with WhatsApp" : "Verify Your Number"}
          </h1>
          <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.92rem", lineHeight: 1.5 }}>
            {isAuthenticated
              ? "You are currently authenticated in the Shriji Dealer Portal."
              : step === "phone"
              ? "Enter your WhatsApp mobile number to receive a secure 6-digit one-time password."
              : `Enter the 6-digit code sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}`}
          </p>
        </div>

        {/* ALREADY AUTHENTICATED CARD */}
        {isAuthenticated && (
          <div className="card pad" style={{ marginBottom: 24, boxShadow: "var(--sh)", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: dealerActive ? "var(--ok-bg)" : "var(--blue-50)", color: dealerActive ? "var(--ok-tx)" : "var(--navy-2)", fontSize: "0.82rem", fontWeight: 700, marginBottom: 16 }}>
              <Icon name={dealerActive ? "shield" : "user"} size={14} />
              {dealerActive ? (session.dealer?.name || "Verified Dealer") : "Customer / Viewer"}
            </div>

            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--tx)", marginBottom: 4 }}>
              {session.fullName || (session.phone ? `+91 ${session.phone}` : "Signed In User")}
            </div>
            {session.phone && (
              <div style={{ fontSize: "0.86rem", color: "var(--tx-2)", marginBottom: 16 }}>
                Phone: +91 {session.phone}
              </div>
            )}

            {dealerActive && session.dealer?.dealer_code && (
              <div style={{ fontSize: "0.82rem", color: "var(--tx-3)", marginBottom: 20 }}>
                Dealer Code: <strong>{session.dealer.dealer_code}</strong> · Price Tier: {session.dealer.price_tier || "Standard"}
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              <Link to="/products" className="btn btn-navy btn-block" style={{ minHeight: 46 }}>
                <Icon name="grid" size={16} /> Continue to Product Catalog
              </Link>
              {dealerActive && (
                <Link to="/dealer" className="btn btn-ghost btn-block" style={{ minHeight: 46 }}>
                  <Icon name="user" size={16} /> Team & Pricing Dashboard
                </Link>
              )}
              <button
                className="btn btn-ghost btn-block"
                onClick={async () => {
                  await signOut();
                  setStep("phone");
                  setPhone("");
                  setOtp(["", "", "", "", "", ""]);
                }}
                style={{ color: "var(--err)", borderColor: "var(--line)", minHeight: 46 }}
              >
                Log Out / Switch Account
              </button>
            </div>
          </div>
        )}

        {/* UNAUTHENTICATED LOGIN FLOW */}
        {!isAuthenticated && (
          <div className="card pad" style={{ boxShadow: "var(--sh)" }}>

            {/* Error Message Alert */}
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
                  marginBottom: 18,
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
                  aria-label="Dismiss error"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "inherit",
                    opacity: 0.7,
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            )}

            {/* STEP 1: PHONE NUMBER INPUT */}
            {step === "phone" && (
              <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 18 }}>
                <div>
                  <label
                    htmlFor="whatsapp-phone-input"
                    style={{
                      display: "block",
                      fontSize: "0.84rem",
                      fontWeight: 700,
                      color: "var(--tx)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Mobile Phone Number
                  </label>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1.5px solid var(--line, #dce4ed)",
                      borderRadius: "var(--r, 14px)",
                      background: "#fff",
                      transition: "border-color 0.15s ease",
                      overflow: "hidden",
                    }}
                  >
                    {/* Country Code Prefix */}
                    <div
                      style={{
                        padding: "0 14px",
                        height: 50,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "var(--bg-2, #f0f5fc)",
                        borderRight: "1.5px solid var(--line, #dce4ed)",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "var(--navy)",
                        userSelect: "none",
                      }}
                    >
                      <span aria-hidden="true">🇮🇳</span> +91
                    </div>

                    {/* 10-digit Input */}
                    <input
                      id="whatsapp-phone-input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={handlePhoneChange}
                      disabled={loading}
                      style={{
                        flex: 1,
                        height: 50,
                        border: "none",
                        outline: "none",
                        padding: "0 14px",
                        fontSize: "1.08rem",
                        fontWeight: 600,
                        letterSpacing: "0.03em",
                        color: "var(--tx)",
                        background: "transparent",
                      }}
                    />

                    {phone && (
                      <button
                        type="button"
                        onClick={() => setPhone("")}
                        aria-label="Clear phone number"
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "0 14px",
                          cursor: "pointer",
                          color: "var(--tx-3)",
                        }}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>

                  <p style={{ margin: "7px 0 0", fontSize: "0.8rem", color: "var(--tx-3)" }}>
                    Must be a 10-digit Indian mobile number registered with WhatsApp.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!isPhoneValid || loading}
                  className="btn btn-navy btn-block"
                  style={{
                    height: 50,
                    fontSize: "0.98rem",
                    fontWeight: 700,
                    cursor: !isPhoneValid || loading ? "not-allowed" : "pointer",
                    opacity: !isPhoneValid || loading ? 0.65 : 1,
                  }}
                >
                  {loading ? (
                    <span>Sending Code...</span>
                  ) : (
                    <>
                      <Icon name="wa" size={18} /> Send Code via WhatsApp
                    </>
                  )}
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: "0.78rem",
                    color: "var(--tx-3)",
                    marginTop: 4,
                  }}
                >
                  <Icon name="shield" size={14} /> Official Meta WhatsApp Cloud Service · No Password Needed
                </div>
              </form>
            )}

            {/* STEP 2: 6-DIGIT OTP VERIFICATION */}
            {step === "otp" && (
              <div style={{ display: "grid", gap: 20 }}>
                {/* Back / Edit number header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--tx-2)" }}>
                    Recipient: <strong>+91 {phone}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setError(null);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--blue-ink, #174d7a)",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                    }}
                  >
                    Change Number
                  </button>
                </div>

                {/* 6 Digit Input Boxes */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "var(--tx)",
                      marginBottom: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      textAlign: "center",
                    }}
                  >
                    Enter 6-Digit WhatsApp Code
                  </label>

                  <div
                    onPaste={handleOtpPaste}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: 8,
                      maxWidth: 340,
                      margin: "0 auto",
                    }}
                  >
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        disabled={loading}
                        aria-label={`Digit ${idx + 1}`}
                        style={{
                          width: "100%",
                          height: 52,
                          textAlign: "center",
                          fontSize: "1.35rem",
                          fontWeight: 800,
                          borderRadius: "var(--r-sm, 10px)",
                          border: digit
                            ? "2px solid var(--navy, #10263a)"
                            : "1.5px solid var(--line, #dce4ed)",
                          background: digit ? "var(--blue-50, #f0f5fc)" : "#fff",
                          color: "var(--tx)",
                          outline: "none",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Verify Submit Button */}
                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={otp.join("").length !== 6 || loading}
                  className="btn btn-navy btn-block"
                  style={{
                    height: 50,
                    fontSize: "0.98rem",
                    fontWeight: 700,
                    cursor: otp.join("").length !== 6 || loading ? "not-allowed" : "pointer",
                    opacity: otp.join("").length !== 6 || loading ? 0.65 : 1,
                  }}
                >
                  {loading ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <Icon name="check" size={18} /> Verify & Sign In
                    </>
                  )}
                </button>

                {/* Resend Cooldown Section */}
                <div style={{ textAlign: "center", fontSize: "0.88rem", color: "var(--tx-2)" }}>
                  {cooldown > 0 ? (
                    <span style={{ color: "var(--tx-3)" }}>
                      Resend code in <strong>{cooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--blue-ink, #174d7a)",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                        padding: 0,
                      }}
                    >
                      Resend Code via WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESTRICTED LOCAL DEVELOPMENT SWITCHER (DEV ONLY) */}
        {import.meta.env.DEV && (
          <div
            style={{
              marginTop: 32,
              padding: "16px 20px",
              background: "var(--card-2, #f8fafc)",
              borderRadius: "var(--r, 14px)",
              border: "1.5px dashed var(--line, #dce4ed)",
            }}
          >
            <details>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--tx-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  userSelect: "none",
                }}
              >
                🛠️ Developer Test Workspaces (Local Dev Only)
              </summary>
              <p style={{ fontSize: "0.8rem", color: "var(--tx-3)", margin: "8px 0 14px" }}>
                Restricted to local development. Allows testing CRM-linked dealer wholesale views or customer retail views without live Meta WhatsApp credentials.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    switchToDealerSession();
                    navigate("/products");
                  }}
                  style={{ justifyContent: "center" }}
                >
                  <Icon name="shield" size={14} /> Dev: Dealer
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    switchToViewerSession();
                    navigate("/products");
                  }}
                  style={{ justifyContent: "center" }}
                >
                  <Icon name="grid" size={14} /> Dev: Customer
                </button>
              </div>
            </details>
          </div>
        )}

        {/* Quick Nav Footer */}
        <nav
          aria-label="Quick navigation"
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 24,
            padding: "12px 16px",
          }}
        >
          <Link to="/products" className="btn btn-sm btn-ghost">
            <Icon name="grid" size={14} /> Catalog
          </Link>
          <Link to="/" className="btn btn-sm btn-ghost">
            <Icon name="home" size={14} /> Home
          </Link>
        </nav>
      </div>
    </section>
  );
}
