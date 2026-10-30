import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useSession, signOut, revalidateSession } from "../data/session";
import { isDealer } from "../data/dealer";
import {
  requestOtp,
  verifyOtp,
  signup,
  login,
  googleLogin,
  lookupStaffCode,
  staffSignup,
} from "../data/auth";
import { formatLoginCode } from "../data/loginCode";
import { isValidEmail, isValidName, isValidPhone } from "../data/validators";
import { Icon } from "../ui";
import OtpDispatchFeedback from "../components/OtpDispatchFeedback";
import StaffJoinFlow from "../components/StaffJoinFlow";

const RESEND_COOLDOWN_SECONDS = 30;

export default function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation target from protected route redirection
  const fromPath = location.state?.from?.pathname || "/products";

  // Role Selection Gateway: null | "dealer" | "staff" (Customer & Brand are disabled/faded out)
  const urlRole = searchParams.get("role");
  const [selectedRole, setSelectedRole] = useState(
    urlRole && ["dealer", "staff"].includes(urlRole) ? urlRole : null
  );

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    if (role) {
      setSearchParams({ role });
    } else {
      setSearchParams({});
    }
    setError(null);
    setStaffSubmitError("");
    setStep("phone");
    setOtp(["", "", "", "", "", ""]);
  };

  useEffect(() => {
    if (urlRole && ["dealer", "staff"].includes(urlRole)) {
      setSelectedRole(urlRole);
    }
  }, [urlRole]);

  // Dealer Sign-In sub-method: "whatsapp" (default) | "email"
  const [authMethod, setAuthMethod] = useState("whatsapp");

  // WhatsApp states
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

  // Staff Gateway states
  const [staffMode, setStaffMode] = useState("login"); // "login" | "join"
  const [staffLoginEmail, setStaffLoginEmail] = useState("");
  const [staffLoginPassword, setStaffLoginPassword] = useState("");
  const [staffShowPassword, setStaffShowPassword] = useState(false);
  const [staffCode, setStaffCode] = useState("");
  const [staffStoreInfo, setStaffStoreInfo] = useState(null);
  const [staffLookupLoading, setStaffLookupLoading] = useState(false);
  const [staffLookupError, setStaffLookupError] = useState("");
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [staffSubmitLoading, setStaffSubmitLoading] = useState(false);
  const [staffSubmitError, setStaffSubmitError] = useState("");

  // Shared states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleNotice, setGoogleNotice] = useState(null);

  const otpInputRefs = useRef([]);
  const cooldownTimerRef = useRef(null);
  const googleBtnRef = useRef(null);

  const isAuthenticated = session && session.role !== "guest";
  const dealerActive = isDealer(session);
  const isStaffActive = Boolean(session && session.authRole === "dealer_staff");
  const isDealerOwnerActive = Boolean(dealerActive && !isStaffActive);

  // Localhost check for Google Identity Services
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local"));

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

  // Initialize official Google Identity Services (GSI) button safely in production (Email mode only)
  useEffect(() => {
    if (isAuthenticated || selectedRole !== "dealer" || authMethod !== "email") return;
    // On localhost, Google returns 403 Origin Not Allowed unless added in Google Console.
    // We suppress the GSI iframe on localhost to avoid polluting the console.
    if (isLocalhost) return;

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
                const fresh = await revalidateSession(true);
                navigateAfterAuth(fresh, fromPath);
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
            width: 320,
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
      }, 4000);
      return () => {
        if (checkInterval) clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [isAuthenticated, fromPath, navigate, selectedRole, authMethod, isLocalhost]);

  // Intelligent post-authentication router
  const navigateAfterAuth = (freshSession, targetFrom) => {
    const hasSpecificTarget = targetFrom && targetFrom !== "/login" && targetFrom !== "/products";

    if (freshSession?.authRole === "dealer_staff" || freshSession?.role === "dealer_staff") {
      if (freshSession?.userStatus === "pending" || freshSession?.status === "pending") {
        navigate("/dealer/pending?kind=staff", { replace: true });
      } else {
        navigate(hasSpecificTarget ? targetFrom : "/staff", { replace: true });
      }
      return;
    }

    const isDealerApproved =
      freshSession?.role === "dealer" &&
      (freshSession?.status === "approved" || freshSession?.dealer?.status === "approved");
    const isDealerPending =
      (freshSession?.role === "dealer" || Boolean(freshSession?.dealer)) &&
      (freshSession?.status === "pending" || freshSession?.dealer?.status === "pending");
    const isDealerRejected =
      (freshSession?.role === "dealer" || Boolean(freshSession?.dealer)) &&
      (freshSession?.status === "rejected" || freshSession?.dealer?.status === "rejected");

    if (isDealerApproved) {
      navigate(hasSpecificTarget ? targetFrom : "/dealer", { replace: true });
    } else if (isDealerPending || isDealerRejected) {
      navigate("/dealer/pending", { replace: true });
    } else if (selectedRole === "dealer" && freshSession?.role === "customer") {
      // User signed in via Dealer gateway, but doesn't have a dealer application yet
      navigate("/dealer/apply", { replace: true });
    } else if (selectedRole === "staff" && freshSession?.role === "customer") {
      // User signed in via Staff gateway, but hasn't linked to a showroom yet
      navigate("/dealer/join", { replace: true });
    } else {
      navigate(hasSpecificTarget ? targetFrom : "/products", { replace: true });
    }
  };

  /* ---- WhatsApp Flow Handlers ---- */
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
      let msg = err.message;
      if (msg === "rate_limited") {
        msg = "Too many requests. Please wait a few moments before requesting a new OTP code.";
      } else if (msg === "Failed to fetch") {
        msg = "Unable to connect to the authentication service. Please check your connection and try again.";
      } else if (!msg) {
        msg = "Failed to send WhatsApp verification code. Please try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    await handleSendOtp();
  };

  const handleOtpDigitChange = (index, val) => {
    const raw = val.replace(/\D/g, "");
    if (!raw) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    // MULTI-DIGIT PASTE / AUTOFILL (keyboard autofill or pasted string)
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split("");
      const newOtp = [...otp];
      const startIdx = raw.length >= 6 ? 0 : index;
      for (let i = 0; i < 6; i++) {
        if (i >= startIdx && digits[i - startIdx] !== undefined) {
          newOtp[i] = digits[i - startIdx];
        }
      }
      setOtp(newOtp);
      if (error) setError(null);

      const nextFocus = Math.min(startIdx + digits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();

      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
      return;
    }

    // SINGLE DIGIT ENTRY
    const newOtp = [...otp];
    newOtp[index] = raw;
    setOtp(newOtp);
    if (error) setError(null);

    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    } else if (index === 5) {
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        handleVerifyOtp(fullCode);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const clip = e.clipboardData || window.clipboardData;
    const pasted = (clip ? clip.getData("text") : "").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const digits = pasted.split("");
    const newOtp = ["", "", "", "", "", ""];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = digits[i] || "";
    }
    setOtp(newOtp);
    if (error) setError(null);

    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otp.join("");
    if (code.length !== 6 || loading) return;

    setLoading(true);
    setError(null);

    try {
      await verifyOtp(phone, code);
      const fresh = await revalidateSession(true);
      navigateAfterAuth(fresh, fromPath);
    } catch (err) {
      setError(err.message || "Invalid verification code. Please check and try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---- Email Flow Handlers ---- */
  const handleEmailAuthSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (emailMode === "signup") {
      const cleanName = fullName.trim();
      if (!cleanName || !isValidName(cleanName)) {
        setError("Please enter your full name (letters only, min 2 characters).");
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

      const fresh = await revalidateSession(true);
      navigateAfterAuth(fresh, fromPath);
    } catch (err) {
      setError(err.message || (emailMode === "signup" ? "Account creation failed." : "Invalid email or password."));
    } finally {
      setLoading(false);
    }
  };

  /* ---- Staff Code Lookup & Join Handlers ---- */
  const handleStaffLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    const cleanEmail = staffLoginEmail.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setStaffSubmitError("Please enter a valid work email address.");
      return;
    }
    if (!staffLoginPassword) {
      setStaffSubmitError("Please enter your password.");
      return;
    }

    setStaffSubmitLoading(true);
    setStaffSubmitError("");

    try {
      await login({
        email: cleanEmail,
        password: staffLoginPassword,
      });

      const fresh = await revalidateSession(true);
      navigateAfterAuth(fresh, fromPath);
    } catch (err) {
      setStaffSubmitError(err.message || "Invalid work email or password. Please check your credentials.");
    } finally {
      setStaffSubmitLoading(false);
    }
  };

  const handleStaffLookup = async (e) => {
    if (e) e.preventDefault();
    const raw = staffCode.trim();
    if (!raw) {
      setStaffLookupError("Please enter your Store / Dealer Code.");
      return;
    }

    setStaffLookupError("");
    setStaffLookupLoading(true);
    try {
      const res = await lookupStaffCode(raw);
      setStaffStoreInfo(res);
      setStaffLookupError("");
    } catch (err) {
      setStaffStoreInfo(null);
      setStaffLookupError(err.message || "Unrecognized Dealer / Business Code. Please check with your store owner.");
    } finally {
      setStaffLookupLoading(false);
    }
  };

  const handleStaffSignupSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!staffStoreInfo) return;

    if (!staffForm.fullName.trim() || !isValidName(staffForm.fullName)) {
      setStaffSubmitError("Please enter your full name (letters only).");
      return;
    }
    if (!staffForm.email.trim() || !isValidEmail(staffForm.email)) {
      setStaffSubmitError("Please enter a valid work email address.");
      return;
    }
    const cleanPhone = staffForm.phone.replace(/\D/g, "").slice(-10);
    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      setStaffSubmitError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!staffForm.password || staffForm.password.length < 8) {
      setStaffSubmitError("Password must be at least 8 characters long.");
      return;
    }
    if (staffForm.password !== staffForm.confirmPassword) {
      setStaffSubmitError("Passwords do not match.");
      return;
    }

    setStaffSubmitLoading(true);
    setStaffSubmitError("");

    try {
      await staffSignup({
        dealer_code: staffStoreInfo.dealer_code || staffCode,
        invite_code: staffStoreInfo.dealer_code || staffCode,
        email: staffForm.email.trim(),
        phone: cleanPhone,
        password: staffForm.password,
        full_name: staffForm.fullName.trim(),
      });

      await revalidateSession().catch(() => {});
      navigate("/dealer/pending?kind=staff", { replace: true });
    } catch (err) {
      setStaffSubmitError(err.message || "Failed to submit staff registration.");
    } finally {
      setStaffSubmitLoading(false);
    }
  };

  return (
    <section className="sec" style={{ paddingTop: "clamp(var(--s4), 3.5vw, var(--s6))", minHeight: "85vh" }}>
      <div className="wrap" style={{ maxWidth: 980, margin: "0 auto", minWidth: 0, overflowX: "clip" }}>

        {/* ALREADY AUTHENTICATED STATE */}
        {isAuthenticated && (() => {
          const isPending = session.status === "pending" || session.dealer?.status === "pending";
          const isRejected = session.status === "rejected" || session.dealer?.status === "rejected";

          return (
            <div
              className="card pad"
              style={{
                maxWidth: 480,
                margin: "0 auto 24px",
                boxShadow: "0 10px 30px -10px rgba(16, 38, 58, 0.12)",
                textAlign: "center",
                borderRadius: "var(--r-lg, 18px)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  borderRadius: 999,
                  background: isRejected ? "#fee2e2" : isPending ? "var(--amber-50, #fffbeb)" : dealerActive ? "var(--ok-bg)" : "var(--blue-50)",
                  color: isRejected ? "#b91c1c" : isPending ? "var(--amber-700, #b45309)" : dealerActive ? "var(--ok-tx)" : "var(--navy-2)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  marginBottom: 16,
                  border: isRejected ? "1px solid #fca5a5" : isPending ? "1px solid #fde68a" : "none",
                }}
              >
                <Icon name={dealerActive ? "shield" : isRejected ? "close" : isPending ? "clock" : "user"} size={14} />
                {isRejected
                  ? "Dealership Application Not Approved"
                  : isPending
                  ? "Dealership Application Under Review"
                  : isStaffActive
                  ? `Authorized Store Staff · ${session.dealer?.name || "Dealership"}`
                  : dealerActive
                  ? (session.dealer?.name || "Verified Dealer")
                  : "Customer / Retail Account"}
              </div>

              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--tx)", marginBottom: 4 }}>
                {session.fullName || (session.phone ? `+91 ${session.phone}` : session.email || "Signed In User")}
              </div>

              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 20 }}>
                {session.phone && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, fontSize: ".78rem", fontWeight: 600, background: session.phone_verified ? "#f0fdf4" : "#fef2f2", color: session.phone_verified ? "#166534" : "#991b1b" }}>
                    <Icon name={session.phone_verified ? "check" : "close"} size={12} />
                    {session.phone_verified ? "WhatsApp Phone Verified" : "Phone Not Verified"}
                  </span>
                )}
                {session.email && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, fontSize: ".78rem", fontWeight: 600, background: session.email_verified ? "#f0fdf4" : "#fef2f2", color: session.email_verified ? "#166534" : "#991b1b" }}>
                    <Icon name={session.email_verified ? "check" : "close"} size={12} />
                    {session.email_verified ? "Email Verified" : "Email Not Verified"}
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {/* Upgrade / Apply for Dealership prompt for retail/customer sessions */}
                {!dealerActive && !isPending && !isRejected && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, rgba(23, 77, 122, 0.05), rgba(30, 64, 175, 0.08))",
                      border: "1.5px solid var(--blue-ink, #1a73e8)",
                      borderRadius: "var(--r, 14px)",
                      padding: "16px",
                      textAlign: "left",
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: "var(--navy, #10263a)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="badge" size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.96rem", fontWeight: 800, color: "var(--navy, #10263a)" }}>
                          Register as Verified Dealer
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--tx-2)" }}>
                          Unlock trade wholesale rates, volume schemes & CRM approval
                        </div>
                      </div>
                    </div>
                    <Link
                      to="/dealer/apply"
                      className="btn btn-navy btn-block"
                      style={{
                        minHeight: 44,
                        background: "var(--navy, #10263a)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        fontWeight: 700,
                        marginTop: 10,
                      }}
                    >
                      <Icon name="edit" size={16} /> Complete Dealership Application →
                    </Link>
                  </div>
                )}

                {isRejected && (
                  <Link to="/dealer/pending" className="btn btn-navy btn-block" style={{ minHeight: 48, background: "#dc2626", borderColor: "#dc2626" }}>
                    <Icon name="close" size={16} /> View Application Status & Details
                  </Link>
                )}

                {isPending && (
                  <Link to="/dealer/pending" className="btn btn-navy btn-block" style={{ minHeight: 48, background: "var(--amber-600, #d97706)", borderColor: "var(--amber-600, #d97706)" }}>
                    <Icon name="clock" size={16} /> View Application Status
                  </Link>
                )}

                <Link to="/products" className="btn btn-navy btn-block" style={{ minHeight: 48 }}>
                  <Icon name="grid" size={16} /> Continue to Product Catalog
                </Link>

                {isStaffActive && (
                  <Link to="/staff" className="btn btn-ghost btn-block" style={{ minHeight: 48, borderColor: "var(--blue-ink, #1d4ed8)", color: "#1d4ed8", fontWeight: 700 }}>
                    <Icon name="badge" size={16} /> Staff Workspace & Profile
                  </Link>
                )}

                {isDealerOwnerActive && (
                  <Link to="/dealer" className="btn btn-ghost btn-block" style={{ minHeight: 48 }}>
                    <Icon name="user" size={16} /> Dealership Dashboard
                  </Link>
                )}

                <button
                  className="btn btn-ghost btn-block"
                  onClick={async () => {
                    await signOut();
                    handleSelectRole(null);
                    setStep("phone");
                    setPhone("");
                    setOtp(["", "", "", "", "", ""]);
                    setEmail("");
                    setPassword("");
                  }}
                  style={{
                    color: "var(--err, #dc4545)",
                    borderColor: "rgba(220, 69, 69, 0.3)",
                    background: "#fef2f2",
                    minHeight: 48,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Icon name="logout" size={16} />
                  <span>Log Out / Switch Account</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* UNAUTHENTICATED EXECUTIVE WORKSPACE (Clean Apple HIG Centered Gateway matching image23) */}
        {!isAuthenticated && (
          <div
            style={{
              maxWidth: 520,
              margin: "0 auto",
              width: "100%",
            }}
          >
            {/* VIEW A: THE 2-PATHWAY ROLE GATEWAY (Matches Sheet 2 image23) */}
            {!selectedRole && (
              <div
                className="card pad"
                style={{
                  boxShadow: "0 12px 36px -10px rgba(16, 38, 58, 0.08)",
                  borderRadius: "24px",
                  border: "1.5px solid var(--line, #dce4ed)",
                  padding: "clamp(24px, 4vw, 36px)",
                  background: "#ffffff",
                }}
              >
                {/* Header with ReSTOR logo & user icon */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 900, color: "#1d4ed8", letterSpacing: "-0.03em" }}>
                    ReSTOR
                  </span>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "rgba(16, 38, 58, 0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--navy, #10263a)",
                    }}
                  >
                    <Icon name="user" size={18} />
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h1 style={{ fontSize: "clamp(1.65rem, 3.2vw, 2.1rem)", fontWeight: 900, margin: "0 0 4px", color: "#0b1a2b", letterSpacing: "-0.03em" }}>
                    Welcome to ReSTOR
                  </h1>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1d4ed8", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                    Reimagine Retail.
                  </h2>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem", lineHeight: 1.5 }}>
                    Choose how you'd like to access your account.
                  </p>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  {/* OPTION 1: LOGIN AS DEALER */}
                  <button
                    type="button"
                    onClick={() => handleSelectRole("dealer")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "18px 20px",
                      borderRadius: "18px",
                      border: "1.5px solid #dce4ed",
                      background: "#ffffff",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 8px rgba(16, 38, 58, 0.03)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#1d4ed8";
                      e.currentTarget.style.boxShadow = "0 6px 20px -4px rgba(29, 78, 216, 0.12)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#dce4ed";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 38, 58, 0.03)";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "14px",
                          background: "#0f172a",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="stove" size={22} />
                      </div>
                      <div>
                        <span style={{ fontSize: "1.08rem", fontWeight: 800, color: "#0f172a", display: "block", marginBottom: 3 }}>
                          Login as Dealer
                        </span>
                        <span style={{ fontSize: "0.86rem", color: "#64748b", display: "block", lineHeight: 1.4 }}>
                          Access your dealer account and product pricing.
                        </span>
                      </div>
                    </div>
                    <span style={{ color: "#0f172a", fontSize: "1.2rem", fontWeight: 700, marginLeft: 12 }}>→</span>
                  </button>

                  {/* OPTION 2: CONTINUE AS STAFF */}
                  <button
                    type="button"
                    onClick={() => handleSelectRole("staff")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "18px 20px",
                      borderRadius: "18px",
                      border: "1.5px solid #dce4ed",
                      background: "#ffffff",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 8px rgba(16, 38, 58, 0.03)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#1d4ed8";
                      e.currentTarget.style.boxShadow = "0 6px 20px -4px rgba(29, 78, 216, 0.12)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#dce4ed";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 38, 58, 0.03)";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "14px",
                          background: "#e0e7ff",
                          color: "#3730a3",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="user" size={22} />
                      </div>
                      <div>
                        <span style={{ fontSize: "1.08rem", fontWeight: 800, color: "#0f172a", display: "block", marginBottom: 3 }}>
                          Continue as Staff
                        </span>
                        <span style={{ fontSize: "0.86rem", color: "#64748b", display: "block", lineHeight: 1.4 }}>
                          Enter your assigned Store Code to continue.
                        </span>
                      </div>
                    </div>
                    <span style={{ color: "#0f172a", fontSize: "1.2rem", fontWeight: 700, marginLeft: 12 }}>→</span>
                  </button>
                </div>

                {/* Apply for Dealership link at bottom */}
                <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    New showroom or retailer?{" "}
                    <Link to="/dealer/apply" style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "none" }}>
                      Apply for Dealership
                    </Link>
                  </span>
                </div>
              </div>
            )}

              {/* VIEW B: ACTIVE ROLE WORKFLOWS (DEALER OR STAFF) */}
              {selectedRole && (
                <div>
                  {/* ROLE NAVIGATION & SEGMENTED SWITCHER (Apple HIG Style) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectRole(null)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "none",
                        color: "var(--navy-2, #174d7a)",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "6px 0",
                      }}
                    >
                      ← All Options
                    </button>

                    {/* Segmented Capsule: Only Active Roles (Dealer & Staff) */}
                    <div
                      role="tablist"
                      aria-label="Role selector"
                      style={{
                        display: "inline-flex",
                        background: "var(--bg-2, #f0f5fc)",
                        borderRadius: 999,
                        padding: 3,
                        gap: 2,
                      }}
                    >
                      {[
                        { id: "dealer", label: "Dealer" },
                        { id: "staff", label: "Staff" },
                      ].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          role="tab"
                          aria-selected={selectedRole === r.id}
                          onClick={() => handleSelectRole(r.id)}
                          style={{
                            border: "none",
                            borderRadius: 999,
                            padding: "6px 16px",
                            fontSize: "0.82rem",
                            fontWeight: selectedRole === r.id ? 800 : 600,
                            background: selectedRole === r.id ? "var(--navy, #10263a)" : "transparent",
                            color: selectedRole === r.id ? "#ffffff" : "var(--tx-2)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ACTIVE ROLE 1: DEALER SIGN-IN */}
                  {selectedRole === "dealer" && (
                    <div
                      className="card pad"
                      style={{
                        boxShadow: "0 10px 30px -10px rgba(16, 38, 58, 0.1)",
                        borderRadius: "var(--r-xl, 20px)",
                        border: "1.5px solid var(--line, #dce4ed)",
                        padding: "clamp(20px, 3.5vw, 32px)",
                      }}
                    >
                      <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "var(--r, 14px)",
                            background: "var(--navy, #10263a)",
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 10,
                          }}
                        >
                          <Icon name="shield" size={24} />
                        </div>
                        <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 4px", color: "var(--tx)" }}>
                          Dealer Sign-In
                        </h2>
                        <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.86rem" }}>
                          Sign in with your registered WhatsApp number or Google Account.
                        </p>
                      </div>

                      {/* Method Selector Tabs */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 6,
                          padding: 4,
                          background: "var(--bg-2, #f0f5fc)",
                          borderRadius: "var(--r, 14px)",
                          marginBottom: 18,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setAuthMethod("whatsapp")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            minHeight: 42,
                            border: "none",
                            borderRadius: "var(--r-sm, 10px)",
                            background: authMethod === "whatsapp" ? "#fff" : "transparent",
                            fontWeight: authMethod === "whatsapp" ? 700 : 600,
                            fontSize: "0.86rem",
                            boxShadow: authMethod === "whatsapp" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ color: "#25D366", display: "flex" }}>
                            <Icon name="wa" size={16} />
                          </span>
                          WhatsApp OTP
                        </button>

                        <button
                          type="button"
                          onClick={() => setAuthMethod("email")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            minHeight: 42,
                            border: "none",
                            borderRadius: "var(--r-sm, 10px)",
                            background: authMethod === "email" ? "#fff" : "transparent",
                            fontWeight: authMethod === "email" ? 700 : 600,
                            fontSize: "0.86rem",
                            boxShadow: authMethod === "email" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                            cursor: "pointer",
                          }}
                        >
                          <Icon name="mail" size={16} />
                          Email Password
                        </button>
                      </div>

                      {error && (
                        <div
                          role="alert"
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "var(--err-bg, #fde8e8)",
                            color: "var(--err, #dc4545)",
                            fontSize: "0.85rem",
                            marginBottom: 16,
                          }}
                        >
                          <Icon name="flame" size={16} />
                          <div style={{ flex: 1 }}>{error}</div>
                        </div>
                      )}

                      {/* WhatsApp OTP Form */}
                      {authMethod === "whatsapp" && (
                        <div>
                          {step === "phone" ? (
                            <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 14 }}>
                              <div>
                                <label htmlFor="dealer-phone-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 6 }}>
                                  Registered WhatsApp Number
                                </label>
                                <div style={{ display: "flex", border: "1.5px solid var(--line)", borderRadius: "var(--r-sm, 10px)", overflow: "hidden", background: "#fff" }}>
                                  <div style={{ padding: "0 14px", height: 48, display: "flex", alignItems: "center", background: "var(--bg-2)", borderRight: "1.5px solid var(--line)", fontWeight: 700, color: "var(--navy)", fontSize: "0.95rem" }}>
                                    +91
                                  </div>
                                  <input
                                    id="dealer-phone-in"
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="98765 43210"
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    disabled={loading}
                                    style={{ flex: 1, height: 48, border: "none", outline: "none", padding: "0 12px", fontSize: "1rem", fontWeight: 600 }}
                                  />
                                </div>
                              </div>

                              <OtpDispatchFeedback loading={loading} channel="whatsapp" destination={phone} />

                              <button
                                type="submit"
                                disabled={!isPhoneValid || loading}
                                className="btn btn-navy btn-block"
                                style={{ height: 48, fontSize: "0.95rem", fontWeight: 700 }}
                              >
                                {loading ? (
                                  <>
                                    <span className="otp-btn-spinner" aria-hidden="true" />
                                    <span>Sending WhatsApp OTP...</span>
                                  </>
                                ) : (
                                  "Send WhatsApp OTP"
                                )}
                              </button>
                            </form>
                          ) : (
                            <div style={{ display: "grid", gap: 16 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.84rem" }}>
                                <span>Sent to: <strong>+91 {phone}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => setStep("phone")}
                                  style={{ background: "transparent", border: "none", color: "var(--blue-ink)", fontWeight: 700, cursor: "pointer" }}
                                >
                                  Change
                                </button>
                              </div>

                              <div
                                onPaste={handleOtpPaste}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                                  gap: "clamp(6px, 1.8vw, 10px)",
                                  width: "100%",
                                  maxWidth: 340,
                                  margin: "0 auto",
                                  boxSizing: "border-box",
                                }}
                              >
                                {otp.map((digit, idx) => (
                                  <input
                                    key={idx}
                                    ref={(el) => (otpInputRefs.current[idx] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                                    value={digit}
                                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                    onPaste={handleOtpPaste}
                                    disabled={loading}
                                    style={{
                                      width: "100%",
                                      minWidth: 0,
                                      maxWidth: "100%",
                                      boxSizing: "border-box",
                                      height: 52,
                                      padding: 0,
                                      textAlign: "center",
                                      fontSize: "1.3rem",
                                      fontWeight: 800,
                                      borderRadius: 10,
                                      border: digit ? "2px solid var(--navy, #10263a)" : "1.5px solid var(--line, #dce4ed)",
                                      background: digit ? "var(--blue-50, #f0f7ff)" : "#fff",
                                      color: "var(--navy, #10263a)",
                                      outline: "none",
                                      boxShadow: digit ? "0 2px 8px rgba(16, 38, 58, 0.08)" : "none",
                                      transition: "all 0.15s ease",
                                    }}
                                  />
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleVerifyOtp()}
                                disabled={otp.join("").length !== 6 || loading}
                                className="btn btn-navy btn-block"
                                style={{ height: 48, fontWeight: 700 }}
                              >
                                {loading ? "Verifying..." : "Verify & Sign In"}
                              </button>

                              <div style={{ textAlign: "center", fontSize: "0.84rem" }}>
                                {cooldown > 0 ? (
                                  <span style={{ color: "var(--tx-3)" }}>Resend code in {cooldown}s</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    style={{ background: "transparent", border: "none", color: "var(--blue-ink)", fontWeight: 700, cursor: "pointer" }}
                                  >
                                    Resend WhatsApp Code
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Email Password Form */}
                      {authMethod === "email" && (
                        <form onSubmit={handleEmailAuthSubmit} style={{ display: "grid", gap: 14 }}>
                          {/* Segmented Mode Switcher: Sign In vs Create Account */}
                          <div
                            role="tablist"
                            style={{
                              display: "flex",
                              background: "var(--bg-2, #f0f5fc)",
                              borderRadius: "var(--r-sm, 10px)",
                              padding: 3,
                              gap: 3,
                            }}
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={emailMode === "login"}
                              onClick={() => { setEmailMode("login"); setError(null); }}
                              style={{
                                flex: 1,
                                border: "none",
                                borderRadius: "calc(var(--r-sm, 10px) - 2px)",
                                padding: "8px 12px",
                                fontSize: "0.84rem",
                                fontWeight: emailMode === "login" ? 800 : 600,
                                background: emailMode === "login" ? "#ffffff" : "transparent",
                                color: emailMode === "login" ? "var(--navy, #10263a)" : "var(--tx-2)",
                                boxShadow: emailMode === "login" ? "0 2px 6px rgba(16, 38, 58, 0.08)" : "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              Sign In
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={emailMode === "signup"}
                              onClick={() => { setEmailMode("signup"); setError(null); }}
                              style={{
                                flex: 1,
                                border: "none",
                                borderRadius: "calc(var(--r-sm, 10px) - 2px)",
                                padding: "8px 12px",
                                fontSize: "0.84rem",
                                fontWeight: emailMode === "signup" ? 800 : 600,
                                background: emailMode === "signup" ? "#ffffff" : "transparent",
                                color: emailMode === "signup" ? "var(--navy, #10263a)" : "var(--tx-2)",
                                boxShadow: emailMode === "signup" ? "0 2px 6px rgba(16, 38, 58, 0.08)" : "none",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              Create Account
                            </button>
                          </div>

                          {emailMode === "signup" && (
                            <div>
                              <label htmlFor="dealer-fullname-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                                Full Name
                              </label>
                              <input
                                id="dealer-fullname-in"
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Your full name"
                                style={{ width: "100%", height: 48, borderRadius: "var(--r-sm, 10px)", border: "1.5px solid var(--line)", padding: "0 12px" }}
                              />
                            </div>
                          )}

                          <div>
                            <label htmlFor="dealer-email-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                              Email Address
                            </label>
                            <input
                              id="dealer-email-in"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@dealership.com"
                              style={{ width: "100%", height: 48, borderRadius: "var(--r-sm, 10px)", border: "1.5px solid var(--line)", padding: "0 12px" }}
                            />
                          </div>

                          <div>
                            <label htmlFor="dealer-pass-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                              Password
                            </label>
                            <div style={{ display: "flex", border: "1.5px solid var(--line)", borderRadius: "var(--r-sm, 10px)", overflow: "hidden" }}>
                              <input
                                id="dealer-pass-in"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ flex: 1, height: 48, border: "none", outline: "none", padding: "0 12px" }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                style={{ background: "transparent", border: "none", padding: "0 12px", cursor: "pointer", color: "var(--tx-3)" }}
                              >
                                <Icon name={showPassword ? "eyeoff" : "eye"} size={16} />
                              </button>
                            </div>
                          </div>

                          <button type="submit" disabled={loading} className="btn btn-navy btn-block" style={{ height: 48, fontWeight: 700 }}>
                            {loading
                              ? (emailMode === "signup" ? "Creating Account..." : "Signing In...")
                              : (emailMode === "signup" ? "Create Account & Sign In" : "Sign In with Email")}
                          </button>

                          <div style={{ textAlign: "center", fontSize: "0.82rem" }}>
                            {emailMode === "login" ? (
                              <span style={{ color: "var(--tx-2)" }}>
                                Need a new account?{" "}
                                <button
                                  type="button"
                                  onClick={() => { setEmailMode("signup"); setError(null); }}
                                  style={{ background: "transparent", border: "none", color: "var(--blue-ink, #1a73e8)", fontWeight: 700, cursor: "pointer", padding: 0 }}
                                >
                                  Create an Account
                                </button>
                              </span>
                            ) : (
                              <span style={{ color: "var(--tx-2)" }}>
                                Already have an account?{" "}
                                <button
                                  type="button"
                                  onClick={() => { setEmailMode("login"); setError(null); }}
                                  style={{ background: "transparent", border: "none", color: "var(--blue-ink, #1a73e8)", fontWeight: 700, cursor: "pointer", padding: 0 }}
                                >
                                  Sign In here
                                </button>
                              </span>
                            )}
                          </div>

                          {/* Clean Google Sign-In Integration for Email Accounts */}
                          <div style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                            <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--tx-3)", marginBottom: 12 }}>
                              — or continue with Google —
                            </div>
                            {isLocalhost ? (
                              <div style={{ display: "grid", gap: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGoogleNotice(
                                      "Google 1-Click Access is active for registered domains in Google Cloud Console. On localhost, please sign in with WhatsApp or Email above."
                                    );
                                  }}
                                  className="btn btn-ghost btn-block"
                                  style={{
                                    height: 46,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 10,
                                    border: "1px solid var(--line, #dce4ed)",
                                    background: "#fff",
                                    color: "var(--tx)",
                                    fontWeight: 600,
                                    fontSize: "0.9rem",
                                  }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 18 18">
                                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/>
                                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                                    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
                                  </svg>
                                  Continue with Google
                                </button>
                                {googleNotice && (
                                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--tx-3)", textAlign: "center", lineHeight: 1.4 }}>
                                    {googleNotice}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "center", minHeight: 44 }}>
                                <div ref={googleBtnRef} style={{ width: "100%", maxWidth: 320, display: "flex", justifyContent: "center" }} />
                              </div>
                            )}

                            {/* Direct Dealership application link */}
                            <div style={{ textAlign: "center", marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
                              <span style={{ fontSize: "0.82rem", color: "var(--tx-2)" }}>
                                New showroom or store owner?{" "}
                                <Link to="/dealer/apply" style={{ color: "var(--navy-2, #174d7a)", fontWeight: 700, textDecoration: "underline" }}>
                                  Apply for Dealership →
                                </Link>
                              </span>
                            </div>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* ACTIVE ROLE 2: STAFF ACCESS */}
                  {selectedRole === "staff" && (
                    <div
                      className="card pad"
                      style={{
                        boxShadow: "0 10px 30px -10px rgba(16, 38, 58, 0.1)",
                        borderRadius: "var(--r-xl, 20px)",
                        border: "1.5px solid var(--line, #dce4ed)",
                        padding: "clamp(20px, 3.5vw, 32px)",
                      }}
                    >
                      <div style={{ textAlign: "center", marginBottom: 18 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: "var(--r, 14px)",
                            background: "#e0e7ff",
                            color: "#3730a3",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 10,
                          }}
                        >
                          <Icon name="user" size={24} />
                        </div>
                        <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 4px", color: "var(--tx)" }}>
                          {staffMode === "login" ? "Staff Sign In" : "Join Store as Staff"}
                        </h2>
                        <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.86rem" }}>
                          {staffMode === "login"
                            ? "Sign in with your registered WhatsApp number or work email to access your showroom."
                            : "Enter your store's Dealer / Business Code to join your showroom workspace."}
                        </p>
                      </div>

                      {/* Segmented Mode Switcher: Sign In vs Join */}
                      <div
                        role="tablist"
                        style={{
                          display: "flex",
                          background: "var(--bg-2, #f0f5fc)",
                          borderRadius: "var(--r-sm, 10px)",
                          padding: 3,
                          gap: 3,
                          marginBottom: 18,
                        }}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={staffMode === "login"}
                          onClick={() => { setStaffMode("login"); setStaffSubmitError(""); setStaffLookupError(""); setError(null); }}
                          style={{
                            flex: 1,
                            border: "none",
                            background: staffMode === "login" ? "#fff" : "transparent",
                            fontWeight: staffMode === "login" ? 700 : 500,
                            color: staffMode === "login" ? "var(--tx, #0f172a)" : "var(--tx-2, #64748b)",
                            boxShadow: staffMode === "login" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                            borderRadius: "var(--r-xs, 7px)",
                            padding: "8px 12px",
                            fontSize: "0.86rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <Icon name="key" size={14} />
                          Sign In
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={staffMode === "join"}
                          onClick={() => { setStaffMode("join"); setStaffSubmitError(""); setStaffLookupError(""); setError(null); }}
                          style={{
                            flex: 1,
                            border: "none",
                            background: staffMode === "join" ? "#fff" : "transparent",
                            fontWeight: staffMode === "join" ? 700 : 500,
                            color: staffMode === "join" ? "var(--tx, #0f172a)" : "var(--tx-2, #64748b)",
                            boxShadow: staffMode === "join" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                            borderRadius: "var(--r-xs, 7px)",
                            padding: "8px 12px",
                            fontSize: "0.86rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          <Icon name="users" size={14} />
                          Join with Code
                        </button>
                      </div>

                      {/* MODE 1: STAFF SIGN IN (DUAL-METHOD: WHATSAPP OTP OR EMAIL PASSWORD) */}
                      {staffMode === "login" && (
                        <div>
                          {/* Method Selector Tabs: WhatsApp OTP vs Email Password */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 6,
                              padding: 4,
                              background: "var(--bg-2, #f0f5fc)",
                              borderRadius: "var(--r, 14px)",
                              marginBottom: 18,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => { setAuthMethod("whatsapp"); setError(null); setStaffSubmitError(""); }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                minHeight: 42,
                                border: "none",
                                borderRadius: "var(--r-sm, 10px)",
                                background: authMethod === "whatsapp" ? "#fff" : "transparent",
                                fontWeight: authMethod === "whatsapp" ? 700 : 600,
                                fontSize: "0.86rem",
                                boxShadow: authMethod === "whatsapp" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                                cursor: "pointer",
                              }}
                            >
                              <span style={{ color: "#25D366", display: "flex" }}>
                                <Icon name="wa" size={16} />
                              </span>
                              WhatsApp OTP
                            </button>

                            <button
                              type="button"
                              onClick={() => { setAuthMethod("email"); setError(null); setStaffSubmitError(""); }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                minHeight: 42,
                                border: "none",
                                borderRadius: "var(--r-sm, 10px)",
                                background: authMethod === "email" ? "#fff" : "transparent",
                                fontWeight: authMethod === "email" ? 700 : 600,
                                fontSize: "0.86rem",
                                boxShadow: authMethod === "email" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                                cursor: "pointer",
                              }}
                            >
                              <Icon name="mail" size={16} />
                              Email Password
                            </button>
                          </div>

                          {(error || staffSubmitError) && (
                            <div
                              role="alert"
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: "10px 12px",
                                borderRadius: 8,
                                background: "var(--err-bg, #fde8e8)",
                                color: "var(--err, #dc4545)",
                                fontSize: "0.85rem",
                                marginBottom: 16,
                              }}
                            >
                              <Icon name="flame" size={16} />
                              <div style={{ flex: 1 }}>{error || staffSubmitError}</div>
                            </div>
                          )}

                          {/* SUB-METHOD A: STAFF WHATSAPP OTP */}
                          {authMethod === "whatsapp" && (
                            <div>
                              {step === "phone" ? (
                                <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 14 }}>
                                  <div>
                                    <label htmlFor="staff-phone-otp-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 6 }}>
                                      Registered Staff WhatsApp Number
                                    </label>
                                    <div style={{ display: "flex", border: "1.5px solid var(--line, #cbd5e1)", borderRadius: "var(--r-sm, 10px)", overflow: "hidden", background: "#fff" }}>
                                      <div style={{ padding: "0 14px", height: 48, display: "flex", alignItems: "center", background: "var(--bg-2, #f1f5f9)", borderRight: "1.5px solid var(--line, #cbd5e1)", fontWeight: 700, color: "var(--navy, #10263a)", fontSize: "0.95rem" }}>
                                        +91
                                      </div>
                                      <input
                                        id="staff-phone-otp-in"
                                        type="tel"
                                        inputMode="tel"
                                        placeholder="98765 43210"
                                        value={phone}
                                        onChange={handlePhoneChange}
                                        disabled={loading}
                                        style={{ flex: 1, height: 48, border: "none", outline: "none", padding: "0 12px", fontSize: "1rem", fontWeight: 600 }}
                                      />
                                    </div>
                                  </div>

                                  <OtpDispatchFeedback loading={loading} channel="whatsapp" destination={phone} />

                                  <button
                                    type="submit"
                                    disabled={!isPhoneValid || loading}
                                    className="btn btn-navy btn-block"
                                    style={{ height: 48, fontSize: "0.95rem", fontWeight: 700 }}
                                  >
                                    {loading ? (
                                      <>
                                        <span className="otp-btn-spinner" aria-hidden="true" />
                                        <span>Sending WhatsApp OTP...</span>
                                      </>
                                    ) : (
                                      "Send WhatsApp OTP"
                                    )}
                                  </button>
                                </form>
                              ) : (
                                <div style={{ display: "grid", gap: 16 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.84rem" }}>
                                    <span>Sent to: <strong>+91 {phone}</strong></span>
                                    <button
                                      type="button"
                                      onClick={() => setStep("phone")}
                                      style={{ background: "transparent", border: "none", color: "var(--blue-ink, #1a73e8)", fontWeight: 700, cursor: "pointer" }}
                                    >
                                      Change
                                    </button>
                                  </div>

                                  <div
                                    onPaste={handleOtpPaste}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                                      gap: "clamp(6px, 1.8vw, 10px)",
                                      width: "100%",
                                      maxWidth: 340,
                                      margin: "0 auto",
                                      boxSizing: "border-box",
                                    }}
                                  >
                                    {otp.map((digit, idx) => (
                                      <input
                                        key={idx}
                                        ref={(el) => (otpInputRefs.current[idx] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        autoComplete={idx === 0 ? "one-time-code" : "off"}
                                        value={digit}
                                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                        onPaste={handleOtpPaste}
                                        disabled={loading}
                                        style={{
                                          width: "100%",
                                          minWidth: 0,
                                          maxWidth: "100%",
                                          boxSizing: "border-box",
                                          height: 52,
                                          padding: 0,
                                          textAlign: "center",
                                          fontSize: "1.3rem",
                                          fontWeight: 800,
                                          borderRadius: 10,
                                          border: digit ? "2px solid var(--navy, #10263a)" : "1.5px solid var(--line, #dce4ed)",
                                          background: digit ? "var(--blue-50, #f0f7ff)" : "#fff",
                                          color: "var(--navy, #10263a)",
                                          outline: "none",
                                          boxShadow: digit ? "0 2px 8px rgba(16, 38, 58, 0.08)" : "none",
                                          transition: "all 0.15s ease",
                                        }}
                                      />
                                    ))}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleVerifyOtp()}
                                    disabled={otp.join("").length !== 6 || loading}
                                    className="btn btn-navy btn-block"
                                    style={{ height: 48, fontWeight: 700 }}
                                  >
                                    {loading ? "Verifying..." : "Verify & Sign In as Staff →"}
                                  </button>

                                  <div style={{ textAlign: "center", fontSize: "0.84rem" }}>
                                    {cooldown > 0 ? (
                                      <span style={{ color: "var(--tx-3, #94a3b8)" }}>Resend code in {cooldown}s</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={loading}
                                        style={{ background: "transparent", border: "none", color: "var(--blue-ink, #1a73e8)", fontWeight: 700, cursor: "pointer", padding: 0 }}
                                      >
                                        Resend Code
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* SUB-METHOD B: STAFF WORK EMAIL + PASSWORD */}
                          {authMethod === "email" && (
                            <form onSubmit={handleStaffLoginSubmit} style={{ display: "grid", gap: 14 }}>
                              <div>
                                <label htmlFor="staff-login-email-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                                  Work Email
                                </label>
                                <input
                                  id="staff-login-email-in"
                                  type="email"
                                  required
                                  placeholder="staff@dealership.com"
                                  autoComplete="email"
                                  value={staffLoginEmail}
                                  onChange={(e) => setStaffLoginEmail(e.target.value)}
                                  style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 12px", fontSize: "0.95rem", boxSizing: "border-box" }}
                                />
                              </div>

                              <div>
                                <label htmlFor="staff-login-pass-in" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 4 }}>
                                  Password
                                </label>
                                <div style={{ position: "relative" }}>
                                  <input
                                    id="staff-login-pass-in"
                                    type={staffShowPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={staffLoginPassword}
                                    onChange={(e) => setStaffLoginPassword(e.target.value)}
                                    style={{ width: "100%", height: 46, borderRadius: 8, border: "1.5px solid var(--line, #cbd5e1)", padding: "0 40px 0 12px", fontSize: "0.95rem", boxSizing: "border-box" }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setStaffShowPassword((v) => !v)}
                                    style={{
                                      position: "absolute",
                                      right: 10,
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                      background: "transparent",
                                      border: "none",
                                      color: "var(--tx-3, #94a3b8)",
                                      cursor: "pointer",
                                      padding: 4,
                                      display: "flex",
                                    }}
                                    aria-label={staffShowPassword ? "Hide password" : "Show password"}
                                  >
                                    <Icon name={staffShowPassword ? "eyeoff" : "eye"} size={16} />
                                  </button>
                                </div>
                              </div>

                              <button
                                type="submit"
                                disabled={staffSubmitLoading || !staffLoginEmail || !staffLoginPassword}
                                className="btn btn-navy btn-block"
                                style={{ height: 48, fontWeight: 700, marginTop: 4 }}
                              >
                                {staffSubmitLoading ? "Signing in..." : "Sign In as Staff →"}
                              </button>
                            </form>
                          )}

                          <div style={{ textAlign: "center", marginTop: 14, fontSize: "0.85rem", color: "var(--tx-2, #64748b)" }}>
                            First time joining your showroom?{" "}
                            <button
                              type="button"
                              onClick={() => { setStaffMode("join"); setStaffSubmitError(""); setError(null); }}
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
                              Join with Store Code
                            </button>
                          </div>
                        </div>
                      )}

                      {/* MODE 2: STAFF JOIN WITH DEALER CODE & TWO-CHANNEL VERIFICATION */}
                      {staffMode === "join" && (
                        <StaffJoinFlow
                          onSwitchToLogin={() => { setStaffMode("login"); setError(null); setStaffSubmitError(""); }}
                          onSuccess={() => navigate("/dealer/pending?kind=staff", { replace: true })}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Quick Nav Footer Links */}
        <nav
          aria-label="Quick navigation"
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 28,
            padding: "8px 16px",
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
