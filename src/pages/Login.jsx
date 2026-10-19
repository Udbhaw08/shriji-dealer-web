import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { setSession, signOut, useSession, revalidateSession } from "../data/session";
import {
  login as apiLogin, signup as apiSignup, staffSignup as apiStaffSignup,
  requestOtp, verifyOtp, applyAsDealer, lookupStaffCode, googleLogin, firebaseAuthLogin,
  hasSession,
} from "../data/auth";
import {
  signInWithGoogleFirebase,
} from "../data/firebase";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";
import { formatLoginCode, GST_TREATMENT_OPTIONS } from "../data/loginCode";
import { isValidEmail, isValidPhone, isValidName, isValidGstin, isValidPincode } from "../data/validators";

/* Sunshine Dealer Portal — wizard auth (mockup: shop-owner + shop-staff flows).
 * Owner:  role → identify (OTP/password) → business match → details → review → approved
 * Staff:  role → invite code → details → OTP → confirm → waiting → all set
 * Security unchanged: backend owns identity; this screen only reflects /api/auth/me.
 */

const ROLES = [
  { id: "owner", name: "ReStor Dealer", sub: "Manage your store and team" },
  { id: "staff", name: "ReStor Staff", sub: "Access products and tools" },
  { id: "brand", name: "ReStor Brand", sub: "Coming soon", disabled: true },
  { id: "customer", name: "ReStor Customer", sub: "Browse retail prices" },
];

export default function Login() {
  const { t } = useLanguage();
  const s = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const needAuth = params.get("needAuth") === "true";
  const [flow, setFlow] = useState(null); // null | 'owner' | 'staff'
  const [stage, setStage] = useState("role");
  const [otpTarget, setOtpTarget] = useState(null); // { phone, email, channel, target } or string
  const [devOtpCode, setDevOtpCode] = useState(""); // dev OTP code when returned in local development
  const [savedPhone, setSavedPhone] = useState("");
  const [savedEmail, setSavedEmail] = useState("");

  // polling → when approval lands, jump to the approved screen
  const pollRef = useRef(null);
  const watchApproval = () => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const next = await revalidateSession();
      if (!next) return;
      if (next.status === "approved" || next.userApproved || next.dealer?.status === "approved" || next.userStatus === "active") {
        clearInterval(pollRef.current);
        nav("/products");
      }
    }, 5000);
  };
  useEffect(() => () => clearInterval(pollRef.current), []);

  // page reload with a live pending/approved session → land on the right screen
  useEffect(() => {
    if (flow) return;
    if (s.role === "dealer" && s.status === "approved" && !s.staffPending) return; // portal card below
    if (s.role === "dealer" && s.staffPending) { setFlow("staff"); setStage("staff-waiting"); watchApproval(); }
    else if (s.role === "dealer" && s.staffHold) { setFlow("staff"); setStage("staff-hold"); }
    else if (s.role === "dealer" && s.status === "pending") { setFlow("owner"); setStage("owner-review"); watchApproval(); }
  }, [flow, s.role, s.status, s.staffPending]);

  const reset = () => { setFlow(null); setStage("role"); };
  const chooseRole = (role) => {
    if (role === "customer") {
      setSession({ role: "customer", status: "approved", person: "Customer" });
      nav("/products");
      return;
    }
    if (role === "brand") return;
    if (role === "owner") {
      // If already an approved dealer, jump straight to products
      if (s.role === "dealer" && (s.status === "approved" || s.dealer?.status === "approved")) {
        nav("/products");
        return;
      }
      setFlow("owner");
      // If already authenticated (e.g. registered customer wanting to become dealer), jump directly to KYC
      if (hasSession()) {
        if (s.role === "dealer" && (s.status === "pending" || s.dealer?.status === "pending")) {
          setStage("owner-review");
          watchApproval();
        } else if (s.dealerId || s.dealer?.id) {
          setStage("owner-match");
        } else {
          setStage("owner-details");
        }
        return;
      }
      setStage("owner-identify");
      return;
    }
    setFlow(role);
    setStage("staff-newexist");
  };

  const afterAuth = async () => {
    const next = await revalidateSession();
    if (!next) return false;
    
    if (next.authRole === "dealer_staff") {
      setFlow("staff");
      if (next.status === "active" || next.status === "approved") {
        nav("/products");
        return true;
      }
      else if (next.status === "hold" || next.staffHold) { setStage("staff-hold"); }
      else { setStage("staff-confirm"); }
      return true;
    }

    if (flow === "owner") {
      // 1. If already approved dealer
      if (next.dealer?.status === "approved" || (next.role === "dealer" && next.status === "approved")) {
        nav("/products");
        return true;
      }
      // 2. If submitted and awaiting review
      if (next.dealer?.status === "pending" || (next.role === "dealer" && next.status === "pending")) {
        setStage("owner-review");
        watchApproval();
        return true;
      }
      // 3. Matched dealer record
      if (next.dealerId || next.dealer?.id) {
        setStage("owner-match");
        return true;
      }
      // 4. New dealer signup or existing customer upgrading to dealer: fill KYC details!
      setStage("owner-details");
      return true;
    }
    
    // Plain customer login
    nav("/products"); 
    return false;
  };

  // ---------- already-approved dealer portal card ----------
  if (!flow && s.role === "dealer" && s.status === "approved" && s.dealer) {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap wizard-card">
          <div className="authcard" style={{ borderTop: "4px solid var(--blue-600, #2563eb)" }}>
            <div className="authcard-head">
              <span className="badge badge-ok" style={{ marginBottom: 8 }}>{t("active_dealer_portal")}</span>
              <h2 style={{ fontSize: "1.35rem" }}>{s.dealer.name}</h2>
              <p style={{ margin: "4px 0 0" }}>{s.email}{s.dealer.dealer_code ? ` · ${s.dealer.dealer_code}` : ""}</p>
            </div>
            <div className="authcard-body" style={{ display: "grid", gap: 10 }}>
              <Link className="btn btn-navy btn-block" to="/products" style={{ textAlign: "center" }}>
                <Icon name="stove" size={17} /> {t("nav_products")}
              </Link>
              <Link className="btn btn-ghost btn-block" to="/dealer" style={{ textAlign: "center" }}>Your team</Link>
              <button className="btn btn-ghost btn-block" onClick={signOut}>{t("sign_out")}</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const stepIndex = {
    "owner-identify": 1, "owner-otp": 2, "owner-match": 3, "owner-details": 4,
    "owner-review": 5, "owner-approved": 7,
    "staff-newexist": 1,
    "staff-login": 2, "staff-login-otp": 3,
    "staff-invite": 1, "staff-details": 2, "staff-otp": 3, "staff-confirm": 4,
    "staff-waiting": 5, "staff-approved": 7,
  }[stage] || 0;

  return (
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap">
        <div className="auth-shell">
          <aside className="auth-side" aria-hidden="true">
            <div>
              <div className="brand-tag">SUNSHINE</div>
              <h2>Welcome to ReStor Dealer Portal</h2>
              <p>Grow your retail business with us.</p>
            </div>
            <ul className="side-points">
              <li>Wholesale dealer pricing, unlocked after approval</li>
              <li>Staff access with single-use invite codes</li>
              <li>Secure OTP login — no passwords on shared devices</li>
              <li>GST-verified dealer onboarding</li>
            </ul>
            <p className="side-foot">Since 1999 · Authorised Sunshine India distributor</p>
          </aside>
          <div className="auth-main">
            <div className="wizard-card">
        {needAuth && stage === "role" && (
          <div style={{ background: "var(--blue-50, #eff6ff)", border: "1px solid var(--blue-200, #bfdbfe)", color: "#1e40af", padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontSize: ".88rem", fontWeight: 600 }}>
            Verified dealer access only — sign in to unlock wholesale pricing.
          </div>
        )}

        {stage === "role" && <RoleSelect onPick={chooseRole} />}
        {flow === "owner" && (
          <>
            {stage === "owner-identify" && (
              <Identify initialPhone={savedPhone} initialEmail={savedEmail}
                        onSent={(target, code) => {
                          setOtpTarget(target);
                          if (typeof target === "object" && target !== null) {
                            if (target.phone) setSavedPhone(target.phone);
                            if (target.email) setSavedEmail(target.email);
                          } else if (typeof target === "string") {
                            if (target.includes("@")) setSavedEmail(target);
                            else setSavedPhone(target);
                          }
                          setDevOtpCode(code || "");
                          setStage("owner-otp");
                        }}
                        onPasswordOk={afterAuth} onBack={reset} />
            )}
            {stage === "owner-otp" && (
              <OtpStep target={otpTarget} devCode={devOtpCode} onVerified={afterAuth}
                       onEdit={() => setStage("owner-identify")} onBack={reset} />
            )}
            {stage === "owner-match" && <BusinessMatch onYes={() => { setStage("owner-review"); watchApproval(); }}
                                                       onNew={() => setStage("owner-details")} onBack={reset} />}
            {stage === "owner-details" && <BusinessDetails onDone={async () => { await revalidateSession(); setStage("owner-review"); watchApproval(); }} onBack={() => { if (hasSession()) reset(); else setStage("owner-identify"); }} />}
            {stage === "owner-review" && <Review kind="owner" onLogin={signOutAndReload} />}
            {stage === "owner-approved" && <Approved kind="owner" onEnter={() => nav("/products")} />}
          </>
        )}
        {flow === "staff" && (
          <>
            {stage === "staff-newexist" && (
              <StaffNewOrExisting
                onNew={() => setStage("staff-invite")}
                onExisting={() => setStage("staff-login")}
                onBack={reset}
              />
            )}
            {/* Existing staff login path */}
            {stage === "staff-login" && (
              <StaffLogin initialPhone={savedPhone} initialEmail={savedEmail}
                onSent={(target, code) => {
                  setOtpTarget(target);
                  if (typeof target === "object" && target !== null) {
                    if (target.phone) setSavedPhone(target.phone);
                    if (target.email) setSavedEmail(target.email);
                  } else if (typeof target === "string") {
                    if (target.includes("@")) setSavedEmail(target);
                    else setSavedPhone(target);
                  }
                  setDevOtpCode(code || "");
                  setStage("staff-login-otp");
                }}
                onPasswordOk={afterAuth}
                onBack={() => setStage("staff-newexist")}
              />
            )}
            {stage === "staff-login-otp" && (
              <OtpStep target={otpTarget} devCode={devOtpCode} onVerified={afterAuth}
                       onEdit={() => setStage("staff-login")} onBack={() => setStage("staff-login")} />
            )}
            {/* New staff signup path */}
            {stage === "staff-invite" && <StaffInvite onNext={(code) => { StaffCtx.code = code; setStage("staff-details"); }} onBack={() => setStage("staff-newexist")} />}
            {stage === "staff-details" && <StaffDetails inviteCode={StaffCtx.code}
                onSent={(target, code) => {
                  setOtpTarget(target);
                  if (typeof target === "object" && target !== null) {
                    if (target.phone) setSavedPhone(target.phone);
                    if (target.email) setSavedEmail(target.email);
                  }
                  setDevOtpCode(code || "");
                  setStage("staff-otp");
                }} onBack={() => setStage("staff-invite")} />}
            {stage === "staff-otp" && (
              <OtpStep
                target={otpTarget}
                devCode={devOtpCode}
                onVerified={async () => {
                  if (StaffCtx.pendingSignup) {
                    try {
                      const res = await apiStaffSignup(StaffCtx.pendingSignup);
                      if (res?.accessToken) {
                        setSession(res);
                      }
                    } catch (signupErr) {
                      console.error("[staff:signup] Failed to complete signup after OTP:", signupErr);
                    }
                    StaffCtx.pendingSignup = null;
                  }
                  await afterAuth();
                }}
                onEdit={() => setStage("staff-details")}
                onBack={() => setStage("staff-invite")}
              />
            )}
            {stage === "staff-confirm" && <StaffConfirm onOk={() => { setStage("staff-waiting"); watchApproval(); }} onBack={reset} />}
            {stage === "staff-waiting" && <Review kind="staff" onLogin={signOutAndReload} />}
            {stage === "staff-approved" && <Approved kind="staff" onEnter={() => nav("/products")} />}
            {stage === "staff-hold" && (
              <div className="authcard rise" style={{ textAlign: "center" }}>
                <div className="authcard-body" style={{ padding: "26px 20px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>⏸️</div>
                  <h2 style={{ fontSize: "1.25rem", margin: "0 0 6px" }}>Staff Access on Hold</h2>
                  <p style={{ color: "var(--tx-2)", fontSize: ".9rem", margin: "0 0 14px", lineHeight: 1.5 }}>
                    Your store staff access has been temporarily placed on hold by the shop owner. Please reach out to your store owner to resume access.
                  </p>
                  <button className="btn btn-navy btn-block" style={{ padding: 12, marginBottom: 8 }} onClick={revalidateSession}>
                    Check Status Again
                  </button>
                  <button className="btn btn-ghost btn-block" onClick={signOutAndReload}>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </>
        )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// shared context for the staff Dealer/invite code across steps
const StaffCtx = { code: "", businessName: "", pendingSignup: null };

function WizardShell({ title, sub, step, steps, onBack, children }) {
  return (
    <div className="authcard rise">
      <div style={{ padding: "14px 18px 0" }}>
        <div className="wizard-top">
          <button className="wizard-back" onClick={onBack} aria-label="Back">‹</button>
          <div className="progress-dots" style={{ flex: 1 }}>
            {Array.from({ length: steps }, (_, i) => <span key={i} className={i < step ? "on" : ""} />)}
          </div>
        </div>
        <h2 style={{ fontSize: "1.3rem", margin: "2px 0 2px" }}>{title}</h2>
        {sub && <p style={{ margin: "0 0 6px", color: "var(--tx-2)", fontSize: ".9rem" }}>{sub}</p>}
      </div>
      <div className="authcard-body" style={{ paddingTop: 8 }}>{children}</div>
    </div>
  );
}

/* STEP: role select — navy hero + radio cards */
function RoleSelect({ onPick }) {
  const [pick, setPick] = useState("owner");
  return (
    <div>
      <div className="auth-hero">
        <div className="brand-tag">SUNSHINE</div>
        <h1>Welcome to ReStor Portal</h1>
        <p>Grow your retail business with us.</p>
      </div>
      <div className="authcard" style={{ margin: "-14px 12px 0", position: "relative", borderTop: "none" }}>
        <div className="authcard-body">
          <h2 style={{ fontSize: "1.05rem", margin: "0 0 4px" }}>How will you use the portal?</h2>
          <div className="role-list">
            {ROLES.map((r) => (
              <label key={r.id} className="role-option" data-selected={pick === r.id} data-disabled={!!r.disabled}
                     style={r.disabled ? { pointerEvents: "none" } : undefined}>
                <input type="radio" name="portal-role" checked={pick === r.id} onChange={() => setPick(r.id)} disabled={r.disabled} />
                <span className="role-dot" />
                <span style={{ minWidth: 0 }}>
                  <p className="role-name">{r.name} {r.disabled && <span className="badge" style={{ marginLeft: 6 }}>Coming soon</span>}</p>
                  <p className="role-sub">{r.sub}</p>
                </span>
              </label>
            ))}
          </div>
          <button className="btn btn-navy btn-block" style={{ padding: 12, fontSize: "1rem", marginTop: 12 }} onClick={() => onPick(pick)}>
            Continue
          </button>
          <p className="note" style={{ textAlign: "center", margin: "10px 0 0" }}>Existing staff? Select ReStor Staff → Existing User to log in directly.</p>
        </div>
      </div>
    </div>
  );
}

/* STAFF: New or Existing user choice */
function StaffNewOrExisting({ onNew, onExisting, onBack }) {
  return (
    <div className="authcard rise">
      <div className="authcard-body" style={{ padding: "22px 20px" }}>
        <button className="wizard-back" onClick={onBack} aria-label="Back" style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--tx-2)", marginBottom: 8 }}>‹</button>
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 6px" }}>ReStor Staff Login</h2>
        <p style={{ color: "var(--tx-2)", fontSize: ".9rem", margin: "0 0 18px" }}>
          Are you a new user joining for the first time, or an existing staff member logging back in?
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <button
            className="btn btn-navy btn-block"
            style={{ padding: "14px 16px", fontSize: "1rem", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
            onClick={onExisting}
          >
            <span style={{ fontSize: "1.4rem" }}>🔑</span>
            <span>
              <div style={{ fontWeight: 800 }}>Existing User — Log In</div>
              <div style={{ fontSize: ".8rem", fontWeight: 400, opacity: 0.85 }}>I already have an account, just signing in</div>
            </span>
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ padding: "14px 16px", fontSize: "1rem", textAlign: "left", display: "flex", alignItems: "center", gap: 12, border: "1.5px solid var(--blue-200, #bfdbfe)" }}
            onClick={onNew}
          >
            <span style={{ fontSize: "1.4rem" }}>✨</span>
            <span>
              <div style={{ fontWeight: 800 }}>New User — Sign Up</div>
              <div style={{ fontSize: ".8rem", fontWeight: 400, opacity: 0.8 }}>I don't have an account yet, joining with Dealer Code</div>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* Reusable phone input with country code dropdown (default: +91 India) and sanitized 10-digit input */
function PhoneInputField({
  id = "phone-input",
  label = "Mobile Number",
  labelSuffix = "",
  value = "",
  countryCode = "+91",
  onCountryCodeChange,
  onChange,
  placeholder = "98765 43210",
  autoComplete = "tel",
  required = false,
  error = "",
}) {
  const rawDigits = String(value || "").replace(/\D/g, "");
  const national10 = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;

  const handleInputChange = (e) => {
    let clean = e.target.value.replace(/\D/g, "");
    if (clean.length === 12 && clean.startsWith("91")) {
      clean = clean.slice(2);
    } else if (clean.length === 11 && clean.startsWith("0")) {
      clean = clean.slice(1);
    } else if (clean.length > 10) {
      clean = clean.slice(-10);
    }
    onChange?.(clean);
  };

  return (
    <div className="field" style={{ margin: 0 }}>
      <label htmlFor={id}>
        {label} {labelSuffix}
      </label>
      <div className="phone-field-group">
        <select
          id={`${id}-cc`}
          className="phone-country-select"
          value={countryCode}
          onChange={(e) => onCountryCodeChange?.(e.target.value)}
          aria-label="Country Code"
        >
          <option value="+91">🇮🇳 +91</option>
        </select>
        <input
          id={id}
          className="phone-number-input"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={national10}
          onChange={handleInputChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />
      </div>
      {error && <span className="err">{error}</span>}
    </div>
  );
}

/* STAFF: Existing staff direct login (OTP or Password) */
function StaffLogin({ onSent, onPasswordOk, onBack, initialPhone = "", initialEmail = "" }) {
  const [mode, setMode] = useState("otp");
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const digits = phone.replace(/\D/g, "").slice(-10);
  const cleanPhone = digits ? `+91${digits}` : "";
  const cleanEmail = email.trim().toLowerCase();

  const run = async (fn) => {
    setError(""); setLoading(true);
    try { await fn(); }
    catch (err) { setError(err.message === "Failed to fetch" ? "Unable to reach the server." : err.message); }
    finally { setLoading(false); }
  };

  const sendOtp = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    const isTestPhone = cleanPhone && cleanPhone.replace(/\D/g, '').endsWith("7738369376");

    run(async () => {
      // Send OTP via backend → WhatsApp Cloud API (Meta)
      const res = await requestOtp({
        phone: cleanPhone,
        channel: "phone",
      });
      onSent({ phone: cleanPhone, email: cleanEmail || null, channel: "phone", target: cleanPhone }, (import.meta.env.VITE_ENABLE_DEV_OTP === 'true' && res.dev_code) || null);
    });
  };

  const loginPassword = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!cleanPhone && !cleanEmail) {
      setError("Please enter your mobile number or email.");
      return;
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    run(async () => {
      await apiLogin({
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        password,
      });
      await onPasswordOk();
    });
  };

  return (
    <WizardShell step={2} steps={5} onBack={onBack} title="Staff Log In"
                 sub="Sign in using your mobile number with OTP.">
      <div className="auth-tabs" role="tablist">
        <button type="button" role="tab" className={`auth-tab-btn ${mode === "otp" ? "active" : ""}`}
                onClick={() => { setMode("otp"); setError(""); }}>
          📱 Mobile OTP
        </button>
        <button type="button" role="tab" className={`auth-tab-btn ${mode === "password" ? "active" : ""}`}
                onClick={() => { setMode("password"); setError(""); }}>
          🔑 Password
        </button>
      </div>

      <div className="auth-linked-hint" style={{ marginBottom: 10 }}>
        <span>📱</span>
        <div>
          <strong>Mobile Verification:</strong> Quick & secure login via WhatsApp or SMS OTP.
        </div>
      </div>

      {mode === "otp" ? (
        <form onSubmit={sendOtp} style={{ display: "grid", gap: 10 }}>
          <PhoneInputField
            id="sl-phone"
            label="Mobile Number"
            labelSuffix="*"
            value={phone}
            onChange={setPhone}
          />

          <div className="auth-channels-note">
            <span className="auth-channel-badge">💬 WhatsApp</span>
            <span className="auth-channel-badge">📱 SMS</span>
          </div>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading || !cleanPhone} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Sending OTP…" : "Send 6-digit OTP"}
          </button>
          <p className="note" style={{ textAlign: "center", margin: 0 }}>Not registered yet? <button type="button" className="link-btn" onClick={onBack}>Go back and sign up</button></p>
        </form>
      ) : (
        <form onSubmit={loginPassword} style={{ display: "grid", gap: 10 }}>
          <PhoneInputField
            id="sl-phone-p"
            label="Mobile Number"
            labelSuffix={cleanEmail ? "(optional if using email)" : "*"}
            value={phone}
            onChange={setPhone}
          />
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="sl-email-p">Email Address {cleanPhone ? "(optional if using mobile)" : "*"}</label>
            <input id="sl-email-p" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="staff@company.com" autoComplete="email" />
          </p>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="sl-pass">Password *</label>
            <input id="sl-pass" type="password" required minLength={8} value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </p>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading || (!cleanPhone && !cleanEmail) || !password} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Signing in…" : "Log In"}
          </button>
          <p className="note" style={{ textAlign: "center", margin: 0 }}>
            <button type="button" className="link-btn" onClick={() => { setMode("otp"); setError(""); }}>Sign in with OTP instead</button>
          </p>
        </form>
      )}
    </WizardShell>
  );
}

/* Reusable 1-click Google Sign-in / Signup button */
function GoogleAuthButton({ onSuccess, onError, disabled, label = "Continue with Google", phone = "", email = "" }) {
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(false);

  const cleanPhone = phone ? String(phone).trim() : undefined;
  const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);

    // 1. Try Firebase Google popup first
    try {
      const { idToken } = await signInWithGoogleFirebase();
      if (idToken) {
        await firebaseAuthLogin(idToken, cleanEmail, cleanPhone);
        await onSuccess();
        return;
      }
    } catch (fbErr) {
      if (fbErr.code === "auth/popup-closed-by-user" || fbErr.code === "auth/cancelled-popup-request") {
        setLoading(false);
        return;
      }
      console.warn("[google:firebase] popup skipped, trying GIS fallback:", fbErr.message);
    }

    // 2. Fallback to Google Identity Services
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (window.google?.accounts?.id && clientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              if (resp.credential) {
                await googleLogin(resp.credential, cleanPhone);
                await onSuccess();
              }
            } catch (err) {
              onError?.(err.message || "Google authentication failed");
            } finally {
              setLoading(false);
            }
          },
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setLoading(false);
          }
        });
        return;
      } catch (err) {
        setLoading(false);
      }
    }

    setLoading(false);
    setHint(true);
  };

  return (
    <div>
      <button
        type="button"
        className="btn-google"
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label={label}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
          <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
          <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
          <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
        </svg>
        <span>{loading ? "Connecting to Google…" : label}</span>
      </button>

      {hint && (
        <div style={{
          marginTop: 8, padding: "10px 12px", background: "#f8fafc",
          border: "1px solid #cbd5e1", borderRadius: 8, fontSize: "0.82rem",
          color: "#475569", lineHeight: 1.45, textAlign: "left"
        }}>
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
            ℹ️ Google OAuth Activation
          </div>
          Add <code>VITE_GOOGLE_CLIENT_ID</code> to your <code>.env</code> file to enable Google 1-tap in this environment.
          <br/>
          In the meantime, you can <b>log in or register instantly</b> using <b>Mobile Number (WhatsApp/SMS)</b> or <b>Email</b> above!
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <button type="button" className="link-btn" style={{ fontSize: "0.78rem" }} onClick={() => setHint(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* OWNER STEP: mobile/email + OTP or password or signup */
function Identify({ onSent, onPasswordOk, onBack, initialPhone = "", initialEmail = "" }) {
  const [mode, setMode] = useState("otp"); // otp | password | signup
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const digits = phone.replace(/\D/g, "").slice(-10);
  const cleanPhone = digits ? `+91${digits}` : "";
  const cleanEmail = email.trim().toLowerCase();

  const run = async (fn) => {
    setError(""); setLoading(true);
    try { await fn(); }
    catch (err) { setError(err.message === "Failed to fetch" ? "Unable to reach the server." : err.message); }
    finally { setLoading(false); }
  };

  const sendOtp = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    const isTestPhone = cleanPhone && cleanPhone.replace(/\D/g, '').endsWith("7738369376");

    run(async () => {
      // Send OTP via backend → WhatsApp Cloud API (Meta)
      const res = await requestOtp({
        phone: cleanPhone,
        channel: "phone",
      });
      onSent({ phone: cleanPhone, email: cleanEmail || null, channel: "phone", target: cleanPhone }, (import.meta.env.VITE_ENABLE_DEV_OTP === 'true' && res.dev_code) || null);
    });
  };

  const loginPassword = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!cleanPhone && !cleanEmail) {
      setError("Please provide your mobile number or email address.");
      return;
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    run(async () => {
      await apiLogin({
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        password,
      });
      await onPasswordOk();
    });
  };

  const signupPassword = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!isValidName(firstName)) {
      setError("Please enter a valid first name (letters only, min 2 characters).");
      return;
    }
    if (!isValidName(lastName)) {
      setError("Please enter a valid last name (letters only, min 2 characters).");
      return;
    }
    if (!cleanPhone || !isValidPhone(cleanPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    if (!password || password.length < 8) {
      setError("Please set a password of at least 8 characters.");
      return;
    }
    run(async () => {
      await apiSignup({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        password,
      });
      await onPasswordOk();
    });
  };

  return (
    <WizardShell step={1} steps={5} onBack={onBack}
                 title={mode === "signup" ? "Create an account" : "Welcome to Sunshine"}
                 sub={mode === "signup" ? "Sign up as a new dealer with phone and name." : "Log in to access your wholesale dealer rates."}>

      <div className="auth-tabs" role="tablist">
        <button type="button" role="tab" className={`auth-tab-btn ${mode === "otp" ? "active" : ""}`}
                onClick={() => { setMode("otp"); setError(""); }}>
          📱 Mobile OTP
        </button>
        <button type="button" role="tab" className={`auth-tab-btn ${mode === "password" ? "active" : ""}`}
                onClick={() => { setMode("password"); setError(""); }}>
          🔑 Password
        </button>
        <button type="button" role="tab" className={`auth-tab-btn ${mode === "signup" ? "active" : ""}`}
                onClick={() => { setMode("signup"); setError(""); }}>
          ✨ Sign Up
        </button>
      </div>

      {mode === "otp" ? (
        <form onSubmit={sendOtp} style={{ display: "grid", gap: 10 }}>
          <div className="auth-linked-hint">
            <span>📱</span>
            <div>
              <strong>Instant Mobile Sign-in:</strong> Enter your mobile number. We dispatch a 6-digit OTP code directly via WhatsApp or SMS.
            </div>
          </div>

          <PhoneInputField
            id="id-phone"
            label="Mobile Number"
            labelSuffix="*"
            value={phone}
            onChange={setPhone}
          />

          <div className="auth-channels-note">
            <span className="auth-channel-badge">💬 WhatsApp</span>
            <span className="auth-channel-badge">📱 SMS</span>
          </div>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading || !cleanPhone} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Sending OTP…" : "Send 6-digit OTP"}
          </button>
          <div className="auth-divider">or</div>
          <GoogleAuthButton onSuccess={onPasswordOk} onError={setError} disabled={loading} label="Continue with Google" phone={cleanPhone} email={email} />
          <div className="secure-note" style={{ marginTop: 6 }}>
            <b>Fast & Passwordless</b>
            We dispatch an OTP directly to WhatsApp or SMS to sign you in securely.
          </div>
        </form>
      ) : mode === "password" ? (
        <form onSubmit={loginPassword} style={{ display: "grid", gap: 10 }}>
          <div className="auth-linked-hint">
            <span>🔗</span>
            <div>
              <strong>Interconnected Account:</strong> Enter your mobile number or email and password to log in.
            </div>
          </div>

          <PhoneInputField
            id="id-phone-p"
            label="Mobile Number"
            labelSuffix={cleanEmail ? "(optional if using email)" : "*"}
            value={phone}
            onChange={setPhone}
          />

          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="id-email-p">Email Address {cleanPhone ? "(optional if using mobile)" : "*"}</label>
            <input id="id-email-p" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="dealer@company.com" autoComplete="email" />
          </p>

          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="id-pass">Password *</label>
            <input id="id-pass" type="password" required minLength={8} value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </p>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading || (!cleanPhone && !cleanEmail) || !password} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Signing in…" : "Log in"}
          </button>
          <div className="auth-divider">or</div>
          <GoogleAuthButton onSuccess={onPasswordOk} onError={setError} disabled={loading} label="Continue with Google" phone={cleanPhone} email={email} />
          <p className="note" style={{ textAlign: "center", margin: 0 }}>
            <button type="button" className="link-btn" onClick={() => { setMode("otp"); setError(""); }}>
              Sign in with OTP instead (no password needed)
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={signupPassword} style={{ display: "grid", gap: 10 }}>
          <div className="auth-linked-hint">
            <span>✨</span>
            <div>
              <strong>Create Your Account:</strong> Fill in your details below. You can verify your email post-login for invoices and receipts.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <p className="field" style={{ margin: 0 }}>
              <label htmlFor="su-fname">First name *</label>
              <input id="su-fname" required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Rajesh" autoComplete="given-name" />
            </p>
            <p className="field" style={{ margin: 0 }}>
              <label htmlFor="su-lname">Last name *</label>
              <input id="su-lname" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sharma" autoComplete="family-name" />
            </p>
          </div>

          <PhoneInputField
            id="su-phone"
            label="Mobile Number"
            labelSuffix="*"
            value={phone}
            onChange={setPhone}
          />
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="su-email">Email Address <span style={{ fontWeight: 400, color: "var(--tx-3, #94a3b8)" }}>(optional — verify after login)</span></label>
            <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="rajesh@company.com" autoComplete="email" />
          </p>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="su-pass">Create Password *</label>
            <input id="su-pass" type="password" required minLength={8} value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="•••••••• (min 8 characters)" />
          </p>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading || !cleanPhone || !password || !firstName.trim() || !lastName.trim()} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Creating account…" : "Create account"}
          </button>
          <div className="auth-divider">or</div>
          <GoogleAuthButton onSuccess={onPasswordOk} onError={setError} disabled={loading} label="Sign up with Google (1-Click)" phone={cleanPhone} email={email} />
          <p className="note" style={{ textAlign: "center", margin: 0 }}>
            Prefer passwordless? <button type="button" className="link-btn" onClick={() => { setMode("otp"); setError(""); }}>Sign up with Mobile OTP</button>
          </p>
        </form>
      )}
    </WizardShell>
  );
}

/* OTP step — 6 boxes, resend timer, dev code auto-fill */
function OtpStep({ target, devCode, onVerified, onEdit, onBack }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [secs, setSecs] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef([]);

  const targetObj = typeof target === "object" && target !== null ? target : {
    target: String(target || ""),
    phone: String(target || "").includes("@") ? "" : String(target || ""),
    email: String(target || "").includes("@") ? String(target || "") : "",
    channel: String(target || "").includes("@") ? "email" : "phone",
  };
  const sendTarget = targetObj.target || (targetObj.channel === "email" ? targetObj.email : targetObj.phone) || "";
  const isEmail = targetObj.channel === "email" || sendTarget.includes("@");

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [secs]);

  const setDigit = (i, v) => {
    const clean = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d !== "")) submit(next.join(""));
  };

  const submit = async (code) => {
    if (loading || code.length !== 6) return;
    setError(""); setLoading(true);
    try {
      // Verify OTP via backend (WhatsApp Cloud API / Meta)
      await verifyOtp({
        phone: targetObj.phone || (!isEmail ? sendTarget : undefined),
        email: targetObj.email || (isEmail ? sendTarget : undefined),
        code,
      });
      await onVerified();
    } catch (err) {
      setError(err.message || "Invalid code");
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setSecs(25); setError("");
    try {
      // Resend OTP via backend (WhatsApp Cloud API / Meta)
      await requestOtp({
        phone: targetObj.phone || (!isEmail ? sendTarget : undefined),
        email: targetObj.email || (isEmail ? sendTarget : undefined),
        channel: isEmail ? "email" : "phone",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const masked = sendTarget && (isEmail ? sendTarget : sendTarget.replace(/\d(?=\d{4})/g, "•"));
  const linkedCounterpart = isEmail ? targetObj.phone : targetObj.email;

  return (
    <WizardShell step={2} steps={5} onBack={onBack} title={isEmail ? "Verify your email" : "Verify your number"}
                 sub={<>We sent a 6-digit OTP via <b>{isEmail ? "Email" : "WhatsApp & SMS"}</b> to <b>{masked}</b></>}>
      {linkedCounterpart && (
        <div className="auth-channels-note" style={{ marginBottom: 10 }}>
          <span className="auth-channel-badge">
            🔗 Linked with {isEmail ? `📱 ${linkedCounterpart}` : `✉️ ${linkedCounterpart}`}
          </span>
        </div>
      )}

      <div className="otp-row">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} className="otp-box" inputMode="numeric"
                 value={d} onChange={(e) => setDigit(i, e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }} />
        ))}
      </div>

      {import.meta.env.VITE_ENABLE_DEV_OTP === 'true' && devCode && (
        <div style={{ textAlign: "center", margin: "4px 0" }}>
          <button type="button" className="otp-dev-pill" onClick={() => {
            const arr = devCode.split("");
            setDigits(arr);
            submit(devCode);
          }}>
            <span>🔑</span> Test OTP: <b>{devCode}</b> (Click to auto-verify)
          </button>
        </div>
      )}

      <p className="timer-note">
        {secs > 0 ? <>Resend OTP in 00:{String(secs).padStart(2, "0")}</>
                  : <button type="button" className="link-btn" onClick={resend}>Resend OTP</button>}
      </p>
      {error && <FormError error={error} />}
      <button className="btn btn-navy btn-block" style={{ padding: 12, fontSize: "1rem", marginTop: 8 }}
              disabled={loading || digits.some((d) => !d)} onClick={() => submit(digits.join(""))}>
        {loading ? "Verifying…" : "Verify and continue"}
      </button>
      <p className="note" style={{ textAlign: "center" }}>
        <button type="button" className="link-btn" onClick={onEdit}>Wrong {isEmail ? "email" : "number"}? Edit</button>
      </p>
    </WizardShell>
  );
}


/* OWNER: business match — dealer found for this account */
function BusinessMatch({ onYes, onBack }) {
  const s = useSession();
  const nav = useNavigate();
  const dealer = s.dealer;
  const approved = dealer?.status === "approved";
  return (
    <WizardShell step={3} steps={5} onBack={onBack} title="We found a dealer account"
                 sub="This account is linked to:">
      <div className="authcard" style={{ boxShadow: "none", border: "1px solid var(--line)", margin: 0 }}>
        <div className="authcard-body" style={{ padding: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{dealer?.name || "Your business"}</h3>
          <p style={{ margin: "2px 0 8px", fontSize: ".85rem", color: "var(--tx-3)" }}>
            Dealer · Status: {dealer?.status}
          </p>
          {dealer?.dealer_code && <span className="badge-chip">Dealer code {dealer.dealer_code}</span>}
        </div>
      </div>
      <button className="btn btn-navy btn-block" style={{ padding: 12, fontSize: "1rem", marginTop: 12 }}
              onClick={() => (approved ? nav("/products") : onYes())}>
        {approved ? "Yes, enter portal" : "Yes, this is my business"}
      </button>
      <p className="note" style={{ textAlign: "center", margin: "10px 0 0" }}>
        Wrong business? <button type="button" className="link-btn" onClick={signOutAndReload}>Log out and start over</button>
      </p>
    </WizardShell>
  );
}
const signOutAndReload = async () => { await signOut(); window.location.href = "/login"; };

/* OWNER: business details (KYC for dealer approval) */
function BusinessDetails({ onDone, onBack }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    business_name: "",
    gst_treatment: "Registered Business - Regular",
    gst_number: "",
    city: "",
    pin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!form.business_name.trim() || form.business_name.trim().length < 2) {
      setError("Please enter your business or shop name.");
      return;
    }
    if (!isValidName(form.first_name)) {
      setError("Please provide a valid first name (letters only, min 2 characters).");
      return;
    }
    if (!isValidName(form.last_name)) {
      setError("Please provide a valid last name (letters only, min 2 characters).");
      return;
    }
    if (form.gst_treatment.includes("Registered") && (!form.gst_number || !isValidGstin(form.gst_number))) {
      setError("Please enter a valid 15-character GSTIN (e.g. 27AABCR1234D1Z5).");
      return;
    }
    if (form.pin && !isValidPincode(form.pin)) {
      setError("Please enter a valid 6-digit PIN code.");
      return;
    }
    setError(""); setLoading(true);
    try {
      await applyAsDealer({
        business_name: form.business_name.trim(),
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        person_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim() || undefined,
        gst_number: form.gst_number.trim() || undefined,
        gst_treatment: form.gst_treatment || undefined,
        address: [form.city.trim(), form.pin.trim()].filter(Boolean).join(" - ") || undefined,
      });
      await onDone();
    } catch (err) {
      setError(err.message || "Could not submit application");
    } finally { setLoading(false); }
  };

  return (
    <WizardShell step={4} steps={5} onBack={onBack} title="Business details"
                 sub="Used for KYC and dealer approval. Automatically synced to Zoho CRM.">
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="bd-fname">First name *</label>
            <input id="bd-fname" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Rajesh" autoComplete="given-name" />
          </p>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="bd-lname">Last name *</label>
            <input id="bd-lname" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Sharma" autoComplete="family-name" />
          </p>
        </div>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="bd-shop">Business / shop name *</label>
          <input id="bd-shop" required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Rajesh Appliances" />
        </p>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="bd-gst-treatment">GST Treatment *</label>
          <select
            id="bd-gst-treatment"
            value={form.gst_treatment}
            onChange={(e) => setForm({ ...form, gst_treatment: e.target.value })}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: "var(--r-md, 8px)",
              border: "1.5px solid var(--line, #cbd5e1)", fontSize: "0.95rem",
              background: "var(--card, #fff)", color: "var(--tx-1, #0f172a)",
              fontWeight: 600,
            }}
          >
            {GST_TREATMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </p>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="bd-gst">
            GSTIN {form.gst_treatment.includes("Registered") ? "*" : "(optional)"}
          </label>
          <input
            id="bd-gst"
            required={form.gst_treatment.includes("Registered")}
            value={form.gst_number}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setForm((prev) => ({
                ...prev,
                gst_number: val,
                gst_treatment:
                  val.trim().length > 2 && prev.gst_treatment === "Unregistered Business"
                    ? "Registered Business - Regular"
                    : prev.gst_treatment,
              }));
            }}
            placeholder="27AABCR1234D1Z5"
          />
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="bd-city">City</label>
            <input id="bd-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" />
          </p>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="bd-pin">PIN code</label>
            <input id="bd-pin" inputMode="numeric" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} placeholder="400002" />
          </p>
        </div>
        {error && <FormError error={error} />}
        <button className="btn btn-navy btn-block" disabled={loading} style={{ padding: 12, fontSize: "1rem" }}>
          {loading ? "Submitting…" : "Submit for approval"}
        </button>
        <p className="note" style={{ textAlign: "center", margin: 0 }}>New dealers need owner approval. You will get SMS and WhatsApp updates.</p>
      </form>
    </WizardShell>
  );
}

/* Review / waiting — hourglass + checklist, polls automatically */
function Review({ kind, onLogin }) {
  return (
    <div className="authcard rise" style={{ textAlign: "center" }}>
      <div className="authcard-body" style={{ padding: "26px 20px" }}>
        <div className="hurdle">⏳</div>
        <h2 style={{ fontSize: "1.25rem", margin: "0 0 4px" }}>
          {kind === "staff" ? "Waiting for owner approval" : "Application under review"}
        </h2>
        <p style={{ color: "var(--tx-2)", fontSize: ".9rem", margin: "0 0 4px" }}>
          {kind === "staff"
            ? "Request sent to the shop owner. You will be notified once approved."
            : "Our team is verifying your GST and business details."}
        </p>
        <ul className="step-list" style={{ textAlign: "left" }}>
          <li className="step-item step-done"><span className="step-ico">✓</span> {kind === "staff" ? "Request sent" : "Submitted"}</li>
          <li className="step-item step-active"><span className="step-ico">⏳</span> {kind === "staff" ? "Owner review" : "Under review"}</li>
          <li className="step-item"><span className="step-ico" /></li>
        </ul>
        <p className="note" style={{ fontSize: ".8rem", margin: "14px 0 0" }}>
          Checking automatically… you can close this page and log in later.
        </p>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={onLogin}>Go to login</button>
      </div>
    </div>
  );
}

/* Approved — green check + what unlocked */
function Approved({ kind, onEnter }) {
  const items = kind === "staff"
    ? ["View dealer prices", "View schemes", "Access marketing material", "Share products with customers"]
    : ["Business verified", "Dealer pricing enabled", "Team access enabled"];
  return (
    <div className="authcard rise" style={{ textAlign: "center" }}>
      <div className="authcard-body" style={{ padding: "26px 20px" }}>
        <div className="hurdle hurdle-ok" />
        <h2 style={{ fontSize: "1.3rem", margin: "0 0 4px" }}>
          {kind === "staff" ? "You are all set!" : "You are approved!"}
        </h2>
        <p style={{ color: "var(--tx-2)", fontSize: ".9rem", margin: "0 0 6px" }}>
          {kind === "staff" ? "You now have access to your store." : "Dealer prices are now unlocked."}
        </p>
        <ul className="step-list" style={{ textAlign: "left" }}>
          {items.map((it) => <li key={it} className="step-item step-done"><span className="step-ico">✓</span> {it}</li>)}
        </ul>
        <button className="btn btn-navy btn-block" style={{ padding: 12, fontSize: "1rem", marginTop: 14 }} onClick={onEnter}>
          Enter portal
        </button>
      </div>
    </div>
  );
}

/* STAFF: Dealer / Business Code */
function StaffInvite({ onNext, onBack }) {
  const [code, setCode] = useState(StaffCtx.code || "");
  const [lookup, setLookup] = useState(StaffCtx.businessName ? { business_name: StaffCtx.businessName, dealer_code: StaffCtx.code } : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verifyAndContinue = async (e) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setError("");
    setLoading(true);
    try {
      const res = await lookupStaffCode(cleanCode);
      setLookup(res);
      StaffCtx.code = res.dealer_code || cleanCode;
      StaffCtx.businessName = res.business_name;
      onNext(cleanCode);
    } catch (err) {
      setError(err.message || "Invalid Dealer / Business Code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WizardShell step={1} steps={5} onBack={onBack} title="Join your store"
                 sub="Enter your shop's official Dealer / Business Code.">
      <form onSubmit={verifyAndContinue} style={{ display: "grid", gap: 10 }}>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="st-code">Dealer / Business Code</label>
          <input id="st-code" required value={code} onChange={(e) => { setCode(formatLoginCode(e.target.value)); setError(""); setLookup(null); }}
                 placeholder="e.g. DE-ABC-1234 or ST-KRT-1742" style={{ textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }} />
        </p>
        {lookup && (
          <div style={{ padding: "10px 12px", background: "var(--blue-50, #eff6ff)", border: "1px solid var(--blue-200, #bfdbfe)", borderRadius: "var(--r-md)", fontSize: ".88rem" }}>
            <span style={{ color: "var(--blue-700, #1d4ed8)", fontWeight: 700 }}>✓ Verified Store:</span> {lookup.business_name}
          </div>
        )}
        {error && <FormError error={error} />}
        <div className="secure-note">
          <b>Where to find your Dealer Code?</b>
          Ask your shop owner. Their official Dealer Code is displayed at the top of their Dealer Dashboard.
        </div>
        <button className="btn btn-navy btn-block" disabled={!code.trim() || loading} style={{ padding: 12, fontSize: "1rem" }}>
          {loading ? "Verifying Code…" : "Continue"}
        </button>
      </form>
    </WizardShell>
  );
}

/* STAFF: details */
function StaffDetails({ inviteCode, onSent, onBack }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Please provide both first name and last name.");
      return;
    }
    if (!isValidName(form.first_name)) {
      setError("First name should only contain letters (2-60 characters).");
      return;
    }
    if (!isValidName(form.last_name)) {
      setError("Last name should only contain letters (2-60 characters).");
      return;
    }
    const digits = form.phone.replace(/\D/g, '').slice(-10);
    const cleanPhone = digits ? `+91${digits}` : '';
    const cleanEmail = form.email.trim();
    if (!cleanEmail && !cleanPhone) {
      setError("Please provide either a mobile number or an email.");
      return;
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }
    if (digits && !isValidPhone(digits)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    setError(""); setLoading(true);
    try {
      StaffCtx.pendingSignup = {
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        password: form.password,
        dealer_code: inviteCode,
        invite_code: inviteCode,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim() || undefined,
      };
      const isTestPhone = cleanPhone && cleanPhone.replace(/\D/g, '').endsWith("7738369376");
      // Send OTP via backend → WhatsApp Cloud API (Meta)
      const res = await requestOtp({
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        channel: cleanPhone ? "phone" : "email",
      });
      onSent({
        phone: cleanPhone,
        email: cleanEmail,
        channel: cleanPhone ? "phone" : "email",
        target: cleanPhone || cleanEmail,
      }, (import.meta.env.VITE_ENABLE_DEV_OTP === 'true' && res.dev_code) || null);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Unable to reach the server." : err.message);
    } finally { setLoading(false); }
  };

  return (
    <WizardShell step={2} steps={5} onBack={onBack} title="Your details"
                 sub={StaffCtx.businessName ? `Join ${StaffCtx.businessName} team` : "Create your staff account."}>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="sd-fname">First name *</label>
            <input id="sd-fname" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Amit" autoComplete="given-name" />
          </p>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="sd-lname">Last name *</label>
            <input id="sd-lname" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Sharma" autoComplete="family-name" />
          </p>
        </div>
        <PhoneInputField
          id="sd-phone"
          label="Mobile number"
          labelSuffix={form.email.trim() ? "(optional)" : "*"}
          value={form.phone}
          onChange={(val) => setForm({ ...form, phone: val })}
        />
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="sd-email">Email {form.phone.trim() ? "(optional)" : "*"}</label>
          <input id="sd-email" type="email" required={!form.phone.trim()} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="amit@company.com" />
        </p>
        <p className="field" style={{ margin: 0, position: "relative" }}>
          <label htmlFor="sd-pass">Create password *</label>
          <input id="sd-pass" type={show ? "text" : "password"} required minLength={8} value={form.password}
                 onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="•••••••• (min 8 characters)" />
          <button type="button" className="link-btn" style={{ position: "absolute", right: 4, top: 30, fontSize: ".8rem" }} onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        </p>
        <div className="auth-channels-note">
          <span className="auth-channel-badge">💬 WhatsApp</span>
          <span className="auth-channel-badge">📱 SMS</span>
          <span className="auth-channel-badge">✉️ Email</span>
        </div>
        {error && <FormError error={error} />}
        <button className="btn btn-navy btn-block" disabled={loading} style={{ padding: 12, fontSize: "1rem" }}>
          {loading ? "Creating account…" : "Send Verification OTP"}
        </button>
      </form>
    </WizardShell>
  );
}

/* STAFF: confirm store */
function StaffConfirm({ onOk, onBack }) {
  const s = useSession();
  const storeName = StaffCtx.businessName || s.dealer?.name || "Your store";
  const storeCode = StaffCtx.code || s.dealer?.dealer_code;
  return (
    <WizardShell step={4} steps={5} onBack={onBack} title="Confirm your store" sub="You are requesting access to:">
      <div className="authcard" style={{ boxShadow: "none", border: "1px solid var(--line)", margin: 0 }}>
        <div className="authcard-body" style={{ padding: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{storeName}</h3>
          {storeCode && (
            <span className="badge-chip" style={{ marginTop: 6, display: "inline-block" }}>
              Dealer Code: {storeCode}
            </span>
          )}
          <p style={{ margin: "6px 0 0", fontSize: ".85rem", color: "var(--tx-3)" }}>
            Shop Owner must approve your request
          </p>
        </div>
      </div>
      <div className="secure-note" style={{ marginTop: 12 }}>
        Your request goes directly to the shop owner for approval. Once approved on their dashboard, wholesale rates and features will unlock.
      </div>
      <button className="btn btn-navy btn-block" style={{ padding: 12, fontSize: "1rem", marginTop: 12 }} onClick={onOk}>
        Send request to owner
      </button>
    </WizardShell>
  );
}

function FormError({ error }) {
  return (
    <div style={{ padding: "8px 12px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: ".85rem" }}>
      {error}
    </div>
  );
}
