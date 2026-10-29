import { useState, useEffect } from "react";
import { useSession, setSession } from "../data/session";
import { requestPhoneOtp, verifyPhoneOtp } from "../data/auth";
import { isValidPhone } from "../data/validators";
import OtpDispatchFeedback from "./OtpDispatchFeedback";

export default function PhoneVerificationPrompt() {
  const session = useSession();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("shriji_phone_prompt_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [openModal, setOpenModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState(session.phone || "");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [devCode, setDevCode] = useState("");

  const isOnDealerRoute =
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/dealer") || window.location.pathname.startsWith("/staff"));
  useEffect(() => {
    const handleOpen = () => {
      setDismissed(false);
      setOpenModal(true);
    };
    window.addEventListener("open-phone-verification", handleOpen);
    return () => window.removeEventListener("open-phone-verification", handleOpen);
  }, []);

  const isLoggedIn = Boolean(session.userId || (session.role && session.role !== "guest"));

  // Only show for logged-in users whose phone is not yet verified
  if (!isLoggedIn || session.phone_verified || (dismissed && !isOnDealerRoute)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("shriji_phone_prompt_dismissed", "true");
    } catch {}
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const clean = phoneInput.replace(/\D/g, "").slice(-10);
    if (!clean || !isValidPhone(clean)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await requestPhoneOtp(clean);
      setOtpSent(true);
      if (res.dev_code) setDevCode(res.dev_code);
    } catch (err) {
      setError(err.message || "Failed to send verification code to mobile.");
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
    const cleanPhone = phoneInput.replace(/\D/g, "").slice(-10);
    setError("");
    setLoading(true);
    try {
      const res = await verifyPhoneOtp(cleanPhone, cleanCode);
      setSuccess(true);
      setSession({
        ...session,
        phone: res.phone || cleanPhone,
        phone_verified: true,
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
      <div className="email-verify-banner" role="alert" style={{ background: "linear-gradient(90deg, #f0fdf4 0%, #e0f2fe 100%)", borderBottom: "1px solid #bbf7d0" }}>
        <div className="email-verify-banner-inner wrap">
          <div className="email-verify-banner-left">
            <span className="email-verify-icon" aria-hidden="true" style={{ background: "#dcfce7", color: "#16a34a" }}>📱</span>
            <span className="email-verify-text">
              <strong>Add & verify your mobile number:</strong> Required for showroom staff record, dispatch alerts, and sync with Zoho CRM.
            </span>
          </div>
          <div className="email-verify-banner-actions">
            <button
              type="button"
              className="btn btn-sm btn-navy email-verify-btn"
              onClick={() => {
                setError("");
                setPhoneInput(session.phone || "");
                setOtpSent(false);
                setOtpCode("");
                setSuccess(false);
                setOpenModal(true);
              }}
            >
              {session.phone ? "Verify Mobile" : "Add Mobile"}
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
                <span style={{ fontSize: "1.5rem" }}>📱</span>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  {session.phone ? "Verify Mobile Number" : "Add Mobile Number"}
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
                  <h4 style={{ margin: "0 0 6px", fontSize: "1.2rem", color: "var(--teal-700, #0f766e)" }}>Mobile Verified!</h4>
                  <p style={{ margin: 0, color: "var(--tx-2, #475569)", fontSize: "0.9rem" }}>
                    Your mobile number <strong>+91 {phoneInput.replace(/\D/g, "").slice(-10)}</strong> has been verified and synced with Zoho CRM.
                  </p>
                </div>
              ) : !otpSent ? (
                <form onSubmit={handleSendOtp} style={{ display: "grid", gap: 14 }}>
                  <p style={{ margin: 0, color: "var(--tx-2, #475569)", fontSize: "0.88rem", lineHeight: 1.45 }}>
                    Enter your 10-digit mobile number. We will send a 6-digit WhatsApp / SMS verification code.
                  </p>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="ph-prompt-input" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--tx-1, #0f172a)", display: "block", marginBottom: 6 }}>
                      Mobile Number *
                    </label>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 44,
                        padding: "0 12px",
                        background: "var(--bg-2, #f1f5f9)",
                        border: "1.5px solid var(--line, #cbd5e1)",
                        borderRight: "none",
                        borderRadius: "8px 0 0 8px",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        color: "var(--tx-2, #64748b)"
                      }}>
                        +91
                      </span>
                      <input
                        id="ph-prompt-input"
                        type="tel"
                        required
                        maxLength={10}
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        autoComplete="tel-national"
                        autoFocus
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: "0 8px 8px 0",
                          border: "1.5px solid var(--line, #cbd5e1)",
                          padding: "0 12px",
                          fontSize: "0.95rem"
                        }}
                      />
                    </div>
                  </div>
                  {error && <div className="email-modal-error">{error}</div>}
                  <OtpDispatchFeedback loading={loading} channel="phone" destination={phoneInput} />
                  <button
                    type="submit"
                    className="btn btn-navy btn-block"
                    disabled={loading || phoneInput.replace(/\D/g, "").length < 10}
                    style={{ padding: "10px 16px", fontSize: "0.95rem" }}
                  >
                    {loading ? (
                      <>
                        <span className="otp-btn-spinner" aria-hidden="true" />
                        <span>Sending WhatsApp OTP…</span>
                      </>
                    ) : (
                      "Send WhatsApp Verification OTP"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} style={{ display: "grid", gap: 14 }}>
                  <p style={{ margin: 0, color: "var(--tx-2, #475569)", fontSize: "0.88rem", lineHeight: 1.45 }}>
                    We sent a 6-digit verification code to <strong>+91 {phoneInput.replace(/\D/g, "").slice(-10)}</strong>.
                  </p>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="ph-otp-input" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--tx-1, #0f172a)" }}>
                      Enter 6-Digit OTP *
                    </label>
                    <input
                      id="ph-otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      autoFocus
                      style={{ letterSpacing: "0.3em", fontSize: "1.25rem", textAlign: "center", fontWeight: 700 }}
                    />
                  </div>
                  {devCode && (
                    <div style={{ fontSize: "0.8rem", color: "var(--tx-3, #64748b)", background: "#f8fafc", padding: "6px 10px", borderRadius: 6 }}>
                      Dev test code: <strong>{devCode}</strong>
                    </div>
                  )}
                  {error && <div className="email-modal-error">{error}</div>}
                  <button
                    type="submit"
                    className="btn btn-navy btn-block"
                    disabled={loading || otpCode.length < 6}
                    style={{ padding: "10px 16px", fontSize: "0.95rem" }}
                  >
                    {loading ? "Verifying…" : "Confirm & Link Number"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={loading}
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      setError("");
                    }}
                    style={{ justifySelf: "center", fontSize: "0.82rem" }}
                  >
                    Change Phone Number
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
