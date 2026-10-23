import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useSession, signOut, switchToDealerSession, switchToViewerSession } from "../data/session";
import { isDealer } from "../data/dealer";
import { requestOtp, verifyOtp, signup, login, googleLogin } from "../data/auth";
import { revalidateSession } from "../data/session";
import { Icon } from "../ui";
import { isValidEmail, isValidName } from "../data/validators";

const RESEND_COOLDOWN_SECONDS = 30;

export default function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation target from protected route redirection (or default)
  const fromPath = location.state?.from?.pathname || (session?.role === "dealer" ? "/products" : "/products");

  // Primary authentication method: "whatsapp" (default) | "email"
  const [authMethod, setAuthMethod] = useState("whatsapp");

  // WhatsApp states (preserved 100%)
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);

  // Email & Password states
  const [emailMode, setEmailMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Shared states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const otpInputRefs = useRef([]);
  const cooldownTimerRef = useRef(null);
  const googleBtnRef = useRef(null);

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

  // Initialize official Google Identity Services (GSI) button
  useEffect(() => {
    if (isAuthenticated) return;
    const googleClientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    let checkInterval = null;

    const renderGoogleButton = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response) => {
              if (!response?.credential) return;
              setLoading(true);
              setError(null);
              try {
                await googleLogin(response.credential);
                await revalidateSession();
                navigate(fromPath !== "/login" ? fromPath : "/products", { replace: true });
              } catch (err) {
                setError(err.message || "Google sign-in failed. Please try again.");
              } finally {
                setLoading(false);
              }
            },
          });

          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            shape: "rectangular",
            text: "continue_with",
            logo_alignment: "left",
            width: 360,
          });

          if (checkInterval) clearInterval(checkInterval);
          return true;
        } catch (e) {
          console.warn("[GSI] render error:", e);
        }
      }
      return false;
    };

    if (!renderGoogleButton()) {
      checkInterval = setInterval(() => {
        if (renderGoogleButton()) {
          clearInterval(checkInterval);
        }
      }, 250);
      const timeout = setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
      }, 5000);
      return () => {
        if (checkInterval) clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [isAuthenticated, fromPath, navigate, authMethod, emailMode]);

  /* ---- WhatsApp Flow Handlers ---- */

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
      await revalidateSession();
      navigate(fromPath !== "/login" ? fromPath : "/products", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid verification code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---- Email & Password Flow Handlers ---- */

  const handleEmailAuthSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (emailMode === "signup") {
      const cleanName = fullName.trim();
      if (!cleanName || !isValidName(cleanName)) {
        setError("Please enter your full name (letters only, at least 2 characters).");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (emailMode === "signup") {
        await signup({
          email: cleanEmail,
          password,
          full_name: fullName.trim(),
        });
      } else {
        await login({
          email: cleanEmail,
          password,
        });
      }

      await revalidateSession();
      navigate(fromPath !== "/login" ? fromPath : "/products", { replace: true });
    } catch (err) {
      setError(err.message || (emailMode === "signup" ? "Account creation failed." : "Invalid email or password."));
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
              background: isAuthenticated
                ? "var(--navy, #10263a)"
                : authMethod === "whatsapp"
                ? "#25D366"
                : "var(--navy, #10263a)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: authMethod === "whatsapp" && !isAuthenticated
                ? "0 8px 24px -6px rgba(37, 211, 102, 0.45)"
                : "0 8px 24px -6px rgba(16, 38, 58, 0.35)",
              marginBottom: 14,
              transition: "background-color 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            {isAuthenticated ? (
              <Icon name="shield" size={26} />
            ) : authMethod === "whatsapp" ? (
              <Icon name="wa" size={28} />
            ) : (
              <Icon name="mail" size={26} />
            )}
          </div>

          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 8px", color: "var(--tx)", letterSpacing: "-0.02em" }}>
            {isAuthenticated
              ? "Your Account"
              : authMethod === "whatsapp"
              ? step === "phone"
                ? "Sign In with WhatsApp"
                : "Verify Your Number"
              : emailMode === "login"
              ? "Sign In with Email"
              : "Create an Account"}
          </h1>

          <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.92rem", lineHeight: 1.5 }}>
            {isAuthenticated
              ? "You are currently authenticated in the Shriji Dealer Portal."
              : authMethod === "whatsapp"
              ? step === "phone"
                ? "Enter your WhatsApp mobile number to receive a secure 6-digit one-time password."
                : `Enter the 6-digit code sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}`
              : emailMode === "login"
              ? "Enter your registered email address and password to sign in."
              : "Create a customer account to browse retail prices and manage saved items."}
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
              {session.fullName || (session.phone ? `+91 ${session.phone}` : session.email || "Signed In User")}
            </div>

            {session.phone && (
              <div style={{ fontSize: "0.86rem", color: "var(--tx-2)", marginBottom: session.email ? 4 : 16 }}>
                Phone: +91 {session.phone}
              </div>
            )}

            {session.email && (
              <div style={{ fontSize: "0.86rem", color: "var(--tx-2)", marginBottom: 16 }}>
                Email: {session.email} {session.email_verified ? "✓ (Verified)" : "(Pending Verification)"}
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
                  setEmail("");
                  setPassword("");
                }}
                style={{ color: "var(--err)", borderColor: "var(--line)", minHeight: 46 }}
              >
                Log Out / Switch Account
              </button>
            </div>
          </div>
        )}

        {/* UNAUTHENTICATED MULTI-METHOD LOGIN CARD */}
        {!isAuthenticated && (
          <div className="card pad" style={{ boxShadow: "var(--sh)" }}>

            {/* SEGMENTED TAB SELECTOR (Apple HIG Style) */}
            <div
              role="tablist"
              aria-label="Login options"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                padding: 4,
                background: "var(--bg-2, #f0f5fc)",
                borderRadius: "var(--r, 14px)",
                marginBottom: 22,
              }}
            >
              <button
                type="button"
                role="tab"
                id="tab-whatsapp"
                aria-selected={authMethod === "whatsapp"}
                aria-controls="panel-whatsapp"
                onClick={() => {
                  setAuthMethod("whatsapp");
                  setError(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 44,
                  border: "none",
                  borderRadius: "var(--r-sm, 10px)",
                  background: authMethod === "whatsapp" ? "#fff" : "transparent",
                  color: authMethod === "whatsapp" ? "var(--tx)" : "var(--tx-2)",
                  fontWeight: authMethod === "whatsapp" ? 700 : 600,
                  fontSize: "0.88rem",
                  boxShadow: authMethod === "whatsapp" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ color: authMethod === "whatsapp" ? "#25D366" : "inherit", display: "flex" }}>
                  <Icon name="wa" size={16} />
                </span>
                WhatsApp OTP
              </button>

              <button
                type="button"
                role="tab"
                id="tab-email"
                aria-selected={authMethod === "email"}
                aria-controls="panel-email"
                onClick={() => {
                  setAuthMethod("email");
                  setError(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 44,
                  border: "none",
                  borderRadius: "var(--r-sm, 10px)",
                  background: authMethod === "email" ? "#fff" : "transparent",
                  color: authMethod === "email" ? "var(--tx)" : "var(--tx-2)",
                  fontWeight: authMethod === "email" ? 700 : 600,
                  fontSize: "0.88rem",
                  boxShadow: authMethod === "email" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ color: authMethod === "email" ? "var(--navy)" : "inherit", display: "flex" }}>
                  <Icon name="mail" size={16} />
                </span>
                Email & Password
              </button>
            </div>

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

            {/* TAB PANEL 1: WHATSAPP OTP */}
            {authMethod === "whatsapp" && (
              <div id="panel-whatsapp" role="tabpanel" aria-labelledby="tab-whatsapp">
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
                        marginTop: 2,
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

            {/* TAB PANEL 2: EMAIL & PASSWORD */}
            {authMethod === "email" && (
              <div id="panel-email" role="tabpanel" aria-labelledby="tab-email">
                <form onSubmit={handleEmailAuthSubmit} style={{ display: "grid", gap: 16 }}>
                  {/* Full Name field (Only in Signup mode) */}
                  {emailMode === "signup" && (
                    <div>
                      <label
                        htmlFor="email-fullname-input"
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "var(--tx)",
                          marginBottom: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Full Name
                      </label>
                      <input
                        id="email-fullname-input"
                        type="text"
                        autoComplete="name"
                        placeholder="e.g. Rajesh Sharma"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (error) setError(null);
                        }}
                        disabled={loading}
                        style={{
                          width: "100%",
                          height: 50,
                          border: "1.5px solid var(--line, #dce4ed)",
                          borderRadius: "var(--r, 14px)",
                          padding: "0 14px",
                          fontSize: "1rem",
                          color: "var(--tx)",
                          background: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}

                  {/* Email address field */}
                  <div>
                    <label
                      htmlFor="email-address-input"
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "var(--tx)",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Email Address
                    </label>
                    <input
                      id="email-address-input"
                      type="email"
                      inputMode="email"
                      autoComplete="username email"
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      disabled={loading}
                      style={{
                        width: "100%",
                        height: 50,
                        border: "1.5px solid var(--line, #dce4ed)",
                        borderRadius: "var(--r, 14px)",
                        padding: "0 14px",
                        fontSize: "1rem",
                        color: "var(--tx)",
                        background: "#fff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Password field with toggle visibility */}
                  <div>
                    <label
                      htmlFor="email-password-input"
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "var(--tx)",
                        marginBottom: 6,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Password
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1.5px solid var(--line, #dce4ed)",
                        borderRadius: "var(--r, 14px)",
                        background: "#fff",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        id="email-password-input"
                        type={showPassword ? "text" : "password"}
                        autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
                        placeholder={emailMode === "signup" ? "At least 8 characters" : "Enter your password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError(null);
                        }}
                        disabled={loading}
                        style={{
                          flex: 1,
                          height: 50,
                          border: "none",
                          padding: "0 14px",
                          fontSize: "1rem",
                          color: "var(--tx)",
                          outline: "none",
                          background: "transparent",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "0 14px",
                          cursor: "pointer",
                          color: "var(--tx-3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: 50,
                        }}
                      >
                        <Icon name={showPassword ? "eyeoff" : "eye"} size={18} />
                      </button>
                    </div>
                    {emailMode === "signup" && (
                      <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "var(--tx-3)" }}>
                        Must be at least 8 characters.
                      </p>
                    )}
                  </div>

                  {/* Email submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-navy btn-block"
                    style={{
                      height: 50,
                      fontSize: "0.98rem",
                      fontWeight: 700,
                      marginTop: 4,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? (
                      <span>{emailMode === "signup" ? "Creating Account..." : "Signing In..."}</span>
                    ) : (
                      <>
                        <Icon name={emailMode === "signup" ? "user" : "mail"} size={18} />
                        {emailMode === "signup" ? "Create Account" : "Sign In with Email"}
                      </>
                    )}
                  </button>

                  {/* Toggle between Login and Signup modes */}
                  <div style={{ textAlign: "center", fontSize: "0.88rem", color: "var(--tx-2)", marginTop: 4 }}>
                    {emailMode === "login" ? (
                      <>
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setEmailMode("signup");
                            setError(null);
                          }}
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
                          Create one now
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setEmailMode("login");
                            setError(null);
                          }}
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
                          Sign in here
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* GOOGLE SIGN-IN INTEGRATION (Visible under both WhatsApp and Email tabs) */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1.5px solid var(--line, #e2e8f0)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ flex: 1, height: 1, background: "var(--line, #e2e8f0)" }} />
                <span
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    color: "var(--tx-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Or continue with
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--line, #e2e8f0)" }} />
              </div>

              {/* Google Identity Services Render Container */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  minHeight: 46,
                  width: "100%",
                }}
              >
                <div
                  ref={googleBtnRef}
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    display: "flex",
                    justifyContent: "center",
                    minHeight: 44,
                  }}
                />
              </div>

              <div
                style={{
                  textAlign: "center",
                  marginTop: 10,
                  fontSize: "0.78rem",
                  color: "var(--tx-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon name="shield" size={13} /> Official Google Identity Services · Instant 1-Click Access
              </div>
            </div>
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
