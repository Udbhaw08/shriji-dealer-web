import { useState, useEffect } from "react";

/**
 * High-quality, tactile feedback card for 3-4 second WhatsApp / Email OTP latency.
 * Provides live stepped progress updates so users always know their request is active.
 */
export default function OtpDispatchFeedback({ loading, channel = "whatsapp", destination = "" }) {
  const [stage, setStage] = useState(1);

  useEffect(() => {
    if (!loading) {
      setStage(1);
      return;
    }
    setStage(1);
    const t1 = setTimeout(() => setStage(2), 1100);
    const t2 = setTimeout(() => setStage(3), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  if (!loading) return null;

  const isEmail = channel === "email";

  const stageTitles = isEmail
    ? [
        "",
        "Connecting to mail dispatch server...",
        "Generating 6-digit verification code...",
        destination ? `Dispatching code to ${destination}...` : "Delivering code to your inbox...",
      ]
    : [
        "",
        "Connecting to WhatsApp Business API...",
        "Generating 6-digit secure code...",
        destination ? `Delivering OTP to +91 ${destination}...` : "Delivering OTP directly to WhatsApp...",
      ];

  const currentTitle = stageTitles[stage] || stageTitles[1];

  return (
    <div
      className={`otp-dispatch-card ${isEmail ? "email-theme" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="otp-dispatch-header">
        <div className="otp-dispatch-pulse-ring" aria-hidden="true">
          {isEmail ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.19 8.19 0 0 1-5.82 2.41c-1.42 0-2.82-.37-4.06-1.07l-.29-.17-3.12.82.83-3.04-.19-.3a8.18 8.18 0 0 1-1.25-4.47c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.78.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.2-.59.2-1.09.14-1.18-.06-.11-.23-.17-.48-.3z" />
            </svg>
          )}
        </div>

        <div className="otp-dispatch-meta">
          <div className="otp-dispatch-title">{currentTitle}</div>
          <div className="otp-dispatch-subtitle">
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: isEmail ? "#2563eb" : "#16a34a" }} />
            <span>⚡ Delivering directly to your {isEmail ? "inbox" : "WhatsApp"}. Please hold on.</span>
          </div>
        </div>
      </div>

      <div className="otp-dispatch-progress">
        <div className="otp-dispatch-progress-bar" />
      </div>
    </div>
  );
}
