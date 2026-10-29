import { useState, useEffect } from "react";
import { useSession, setSession } from "../data/session";
import { requestEmailOtp, verifyEmailOtp } from "../data/auth";
import { isValidEmail } from "../data/validators";
import OtpDispatchFeedback from "./OtpDispatchFeedback";

export default function EmailVerificationPrompt() {
  const session = useSession();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("shriji_email_prompt_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [openModal, setOpenModal] = useState(false);
  const [emailInput, setEmailInput] = useState(session.email || "");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [devCode, setDevCode] = useState("");

  // Only show for logged in users whose email is not yet verified.
  // On dealer onboarding routes, do not allow dismissal to bypass verification requirements.
  const isOnDealerRoute = typeof window !== "undefined" && (window.location.pathname.startsWith("/dealer") || window.location.pathname.startsWith("/staff"));
  useEffect(() => {
    const handleOpen = () => {
      setDismissed(false);
      setOpenModal(true);
    };
    window.addEventListener("open-email-verification", handleOpen);
    return () => window.removeEventListener("open-email-verification", handleOpen);
  }, []);

  const isLoggedIn = Boolean(session.userId || (session.role && session.role !== "guest"));
  if (!isLoggedIn || session.email_verified || (dismissed && !isOnDealerRoute)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("shriji_email_prompt_dismissed", "true");
    } catch {}
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const clean = emailInput.trim().toLowerCase();
    if (!clean || !isValidEmail(clean)) {
      setError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await requestEmailOtp(clean);
      setOtpSent(true);
      if (res.dev_code) setDevCode(res.dev_code);
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await verifyEmailOtp(emailInput.trim().toLowerCase(), cleanCode);
      setSuccess(true);
      setSession({
        ...session,
        email: res.email || emailInput.trim().toLowerCase(),
        email_verified: true,
      });
      setTimeout(() => {
        setOpenModal(false);
      }, 1500);
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="email-verify-banner" role="alert">
        <div className="email-verify-banner-inner wrap">
          <div className="email-verify-banner-left">
            <span className="email-verify-icon" aria-hidden="true">📧</span>
            <span className="email-verify-text">
              <strong>Add & verify your email:</strong> Get order invoices, PDF receipts, and dispatch tracking directly in your inbox.
            </span>
          </div>
          <div className="email-verify-banner-actions">
            <button
              type="button"
              className="btn btn-sm btn-navy email-verify-btn"
              onClick={() => {
                setError("");
                setEmailInput(session.email || "");
                setOtpSent(false);
                setOtpCode("");
                setSuccess(false);
                setOpenModal(true);
              }}
            >
              {session.email ? "Verify Email" : "Add Email"}
            </button>
            <button
              type="button"
              className="email-verify-dismiss"
              onClick={handleDismiss}
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {openModal && (
        <div className="email-modal-backdrop" onClick={() => !loading && setOpenModal(false)}>
          <div className="email-modal-card rise" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.5rem" }}>✉️</span>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  {session.email ? "Verify Email Address" : "Add Email Address"}
                </h3>
              </div>
              <button
                type="button"
                className="email-modal-close"
                disabled={loading}
                onClick={() => setOpenModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="email-modal-body">
              {success ? (
                <div style={{ textAlign: "center", padding: "20px 10px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>✅</div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "1.2rem", color: "var(--teal-700, #0f766e)" }}>Email Verified!</h4>
                  <p style={{ margin: 0, color: "var(--tx-2, #475569)", fontSize: "0.9rem" }}>
                    Your email <strong>{emailInput}</strong> has been linked and verified successfully.
                  </p>
                </div>
              ) : !otpSent ? (
                <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 14 }}>
                  <p style={{ margin: 0, color: "var(--tx-2, #475569)", fontSize: "0.88rem", lineHeight: 1.45 }}>
                    Enter your email to receive order confirmations, invoices, and price change notifications. We will send a 6-digit OTP to verify.
                  </p>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="em-prompt-input" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--tx-1, #0f172a)" }}>
                      Email Address *
                    </label>
                    <input
                      id="em-prompt-input"
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="dealer@company.com"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  {error && <div className="email-modal-error">{error}</div>}
                  <OtpDispatchFeedback loading={loading} channel="email" destination={emailInput} />
                  <button
                    type="submit"
                    className="btn btn-navy btn-block"
                    disabled={loading || !emailInput.trim()}
                    style={{ padding: "10px 16px", fontSize: "0.95rem" }}
                  >
                    {loading ? (
                      <>
                        <span className="otp-btn-spinner" aria-hidden="true" />
                        <span>Sending Verification Code…</span>
                      </>
                    ) : (
                      "Send Verification OTP"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: "grid", gap: 14 }}>
                  <p style={{ margin: 0, color: "var(--tx-2, #475569)", fontSize: "0.88rem", lineHeight: 1.45 }}>
                    We sent a 6-digit verification code to <strong>{emailInput}</strong>.
                  </p>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="em-otp-input" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--tx-1, #0f172a)" }}>
                      Enter 6-Digit OTP *
                    </label>
                    <input
                      id="em-otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      style={{ letterSpacing: "4px", fontSize: "1.2rem", fontWeight: 700, textAlign: "center" }}
                      autoFocus
                    />
                  </div>
                  {import.meta.env.VITE_ENABLE_DEV_OTP === 'true' && devCode && (
                    <div style={{ background: "var(--bg-2, #f1f5f9)", padding: "8px 12px", borderRadius: 6, fontSize: "0.8rem", color: "var(--tx-2)" }}>
                      🛠️ Dev OTP Code: <strong>{devCode}</strong>
                    </div>
                  )}
                  {error && <div className="email-modal-error">{error}</div>}
                  <button
                    type="submit"
                    className="btn btn-navy btn-block"
                    disabled={loading || otpCode.length < 6}
                    style={{ padding: "10px 16px", fontSize: "0.95rem" }}
                  >
                    {loading ? "Verifying…" : "Verify & Confirm"}
                  </button>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => { setOtpSent(false); setOtpCode(""); setError(""); }}
                    >
                      ← Change email
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      disabled={loading}
                      onClick={handleSendOtp}
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
