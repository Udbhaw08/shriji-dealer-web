import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { setSession, signOut, useSession, revalidateSession } from "../data/session";
import {
  login as apiLogin, signup as apiSignup, staffSignup as apiStaffSignup,
  requestOtp, verifyOtp, applyAsDealer,
} from "../data/auth";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";

/* Sunshine Dealer Portal — wizard auth (mockup: shop-owner + shop-staff flows).
 * Owner:  role → identify (OTP/password) → business match → details → review → approved
 * Staff:  role → invite code → details → OTP → confirm → waiting → all set
 * Security unchanged: backend owns identity; this screen only reflects /api/auth/me.
 */

const ROLES = [
  { id: "owner", name: "Shop Owner", sub: "Manage your store and team" },
  { id: "staff", name: "Shop Staff", sub: "Access products and tools" },
  { id: "customer", name: "Customer", sub: "Browse retail prices" },
  { id: "brand", name: "Brand", sub: "Coming soon", disabled: true },
];

export default function Login() {
  const { t } = useLanguage();
  const s = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const needAuth = params.get("needAuth") === "true";
  const [flow, setFlow] = useState(null); // null | 'owner' | 'staff'
  const [stage, setStage] = useState("role");
  const [otpTarget, setOtpTarget] = useState(""); // email or phone the OTP was sent to

  // page reload with a live pending/approved session → land on the right screen
  useEffect(() => {
    if (flow) return;
    if (s.role === "dealer" && s.status === "approved" && !s.staffPending) return; // portal card below
    if (s.role === "dealer" && s.staffPending) { setFlow("staff"); setStage("staff-waiting"); }
    else if (s.role === "dealer" && s.status === "pending") { setFlow("owner"); setStage("owner-review"); }
  }, [flow, s.role, s.status, s.staffPending]);

  const reset = () => { setFlow(null); setStage("role"); };
  const chooseRole = (role) => {
    if (role === "customer") {
      setSession({ role: "customer", status: "approved", person: "Customer" });
      nav("/products");
      return;
    }
    if (role === "brand") return;
    setFlow(role);
    setStage(role === "owner" ? "owner-identify" : "staff-invite");
  };

  // polling → when approval lands, jump to the approved screen
  const pollRef = useRef(null);
  const watchApproval = () => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const next = await revalidateSession();
      if (!next) return;
      if (next.status === "approved" || next.userApproved) {
        clearInterval(pollRef.current);
        setStage(flow === "staff" ? "staff-approved" : "owner-approved");
      }
    }, 8000);
  };
  useEffect(() => () => clearInterval(pollRef.current), []);

  const afterAuth = async () => {
    const next = await revalidateSession();
    if (!next) return false;
    if (next.authRole === "dealer_staff") {
      if (next.status === "active") { setStage("staff-approved"); }
      else { setStage("staff-confirm"); }
      return true;
    }
    if (next.role === "dealer") {
      if (next.status === "approved") nav("/products");
      else if (next.dealerId) setStage("owner-match");
      else setStage("owner-details");
      return true;
    }
    nav("/products"); // plain customer
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
              <h2>Welcome to Sunshine Dealer Portal</h2>
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
              <Identify onSent={(target) => { setOtpTarget(target); setStage("owner-otp"); }}
                        onPasswordOk={afterAuth} onBack={reset} />
            )}
            {stage === "owner-otp" && (
              <OtpStep target={otpTarget} onVerified={afterAuth}
                       onEdit={() => setStage("owner-identify")} onBack={reset} />
            )}
            {stage === "owner-match" && <BusinessMatch onYes={() => { setStage("owner-review"); watchApproval(); }}
                                                       onNew={() => setStage("owner-details")} onBack={reset} />}
            {stage === "owner-details" && <BusinessDetails onDone={async () => { await revalidateSession(); setStage("owner-review"); watchApproval(); }} onBack={() => setStage("owner-identify")} />}
            {stage === "owner-review" && <Review kind="owner" onLogin={reset} />}
            {stage === "owner-approved" && <Approved kind="owner" onEnter={() => nav("/products")} />}
          </>
        )}
        {flow === "staff" && (
          <>
            {stage === "staff-invite" && <StaffInvite onNext={(code) => { StaffCtx.code = code; setStage("staff-details"); }} onBack={reset} />}
            {stage === "staff-details" && <StaffDetails inviteCode={StaffCtx.code}
                onSent={(target) => { setOtpTarget(target); setStage("staff-otp"); }} onBack={() => setStage("staff-invite")} />}
            {stage === "staff-otp" && <OtpStep target={otpTarget} onVerified={afterAuth}
                                               onEdit={() => setStage("staff-details")} onBack={() => setStage("staff-invite")} />}
            {stage === "staff-confirm" && <StaffConfirm onOk={() => { setStage("staff-waiting"); watchApproval(); }} onBack={reset} />}
            {stage === "staff-waiting" && <Review kind="staff" onLogin={reset} />}
            {stage === "staff-approved" && <Approved kind="staff" onEnter={() => nav("/products")} />}
          </>
        )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// shared context for the staff invite code across steps (module-scope is fine per wizard life)
const StaffCtx = { code: "" };

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
        <h1>Welcome to Sunshine Dealer Portal</h1>
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
          <p className="note" style={{ textAlign: "center", margin: "10px 0 0" }}>Already registered? Continue and log in with your number or email.</p>
        </div>
      </div>
    </div>
  );
}

/* OWNER STEP: mobile/email + OTP or password */
function Identify({ onSent, onPasswordOk, onBack }) {
  const [mode, setMode] = useState("otp"); // otp | password
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn) => {
    setError(""); setLoading(true);
    try { await fn(); }
    catch (err) { setError(err.message === "Failed to fetch" ? "Unable to reach the server." : err.message); }
    finally { setLoading(false); }
  };

  const sendOtp = (e) => {
    e.preventDefault();
    if (loading || !value.trim()) return;
    run(async () => {
      const isEmail = value.includes("@");
      const body = isEmail ? { email: value.trim() } : { phone: value.trim() };
      await requestOtp(body);
      onSent(isEmail ? body.email : body.phone);
    });
  };

  const loginPassword = (e) => {
    e.preventDefault();
    if (loading) return;
    run(async () => {
      const isEmail = value.includes("@");
      const body = isEmail ? { email: value.trim(), password } : { email: value.trim(), password };
      await apiLogin({ email: body.email, password });
      await onPasswordOk();
    });
  };

  return (
    <WizardShell step={1} steps={5} onBack={onBack} title="Let's get started"
                 sub="Enter your registered mobile number or email.">
      {mode === "otp" ? (
        <form onSubmit={sendOtp} style={{ display: "grid", gap: 10 }}>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="id-value">Mobile number or email</label>
            <input id="id-value" required value={value} onChange={(e) => setValue(e.target.value)}
                   placeholder="+91 98201 23456" autoComplete="username" />
          </p>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Sending…" : "Send OTP"}
          </button>
          <p className="note" style={{ textAlign: "center", margin: 0 }}>
            <button type="button" className="link-btn" onClick={() => { setMode("password"); setError(""); }}>Log in with password instead</button>
          </p>
          <div className="secure-note" style={{ marginTop: 6 }}>
            <b>Your information is secure</b>
            We only use your number to verify your identity and find your account.
          </div>
        </form>
      ) : (
        <form onSubmit={loginPassword} style={{ display: "grid", gap: 10 }}>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="id-email">Email</label>
            <input id="id-email" type="email" required value={value} onChange={(e) => setValue(e.target.value)} placeholder="you@company.com" />
          </p>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="id-pass">Password</label>
            <input id="id-pass" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </p>
          {error && <FormError error={error} />}
          <button className="btn btn-navy btn-block" disabled={loading} style={{ padding: 12, fontSize: "1rem" }}>
            {loading ? "Signing in…" : "Log in"}
          </button>
          <p className="note" style={{ textAlign: "center", margin: 0 }}>
            <button type="button" className="link-btn" onClick={() => { setMode("otp"); setError(""); }}>Use OTP instead</button>
          </p>
        </form>
      )}
    </WizardShell>
  );
}

/* OTP step — 6 boxes, resend timer */
function OtpStep({ target, onVerified, onEdit, onBack }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [secs, setSecs] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef([]);

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
      const isEmail = target.includes("@");
      await verifyOtp(isEmail ? { email: target, code } : { email: undefined, code, phone: target });
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
      await requestOtp(target.includes("@") ? { email: target } : { phone: target });
    } catch { /* keep timer running */ }
  };

  const masked = target && (target.includes("@") ? target : target.replace(/\d(?=\d{4})/g, "•"));

  return (
    <WizardShell step={2} steps={5} onBack={onBack} title="Verify your number"
                 sub={<>We sent a 6-digit OTP to <b>{masked}</b></>}>
      <div className="otp-row">
        {digits.map((d, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} className="otp-box" inputMode="numeric"
                 value={d} onChange={(e) => setDigit(i, e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }} />
        ))}
      </div>
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
        <button type="button" className="link-btn" onClick={onEdit}>Wrong number? Edit</button>
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
  const [form, setForm] = useState({ person_name: "", business_name: "", gst_number: "", city: "", pin: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (loading || !form.business_name.trim()) return;
    setError(""); setLoading(true);
    try {
      await applyAsDealer({
        business_name: form.business_name.trim(),
        person_name: form.person_name.trim() || undefined,
        gst_number: form.gst_number.trim() || undefined,
        address: [form.city.trim(), form.pin.trim()].filter(Boolean).join(" - ") || undefined,
      });
      await onDone();
    } catch (err) {
      setError(err.message || "Could not submit application");
    } finally { setLoading(false); }
  };

  return (
    <WizardShell step={4} steps={5} onBack={onBack} title="Business details"
                 sub="Used for KYC and dealer approval.">
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="bd-owner">Owner name</label>
          <input id="bd-owner" value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} placeholder="Rajesh Sharma" />
        </p>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="bd-shop">Business / shop name *</label>
          <input id="bd-shop" required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Rajesh Appliances" />
        </p>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="bd-gst">GSTIN</label>
          <input id="bd-gst" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} placeholder="27AABCR1234D1Z5" />
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

/* STAFF: invite code */
function StaffInvite({ onNext, onBack }) {
  const [code, setCode] = useState("");
  return (
    <WizardShell step={1} steps={5} onBack={onBack} title="Join your store"
                 sub="Enter the invite code shared by your shop owner.">
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) onNext(code.trim().toUpperCase()); }} style={{ display: "grid", gap: 10 }}>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="st-code">Invite code</label>
          <input id="st-code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                 placeholder="RJA-7K29" style={{ textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }} />
        </p>
        <div className="secure-note">
          <b>Do not have a code?</b>
          Ask your shop owner to share one from the Team section of their dashboard.
        </div>
        <button className="btn btn-navy btn-block" disabled={!code.trim()} style={{ padding: 12, fontSize: "1rem" }}>Continue</button>
      </form>
    </WizardShell>
  );
}

/* STAFF: details */
function StaffDetails({ inviteCode, onSent, onBack }) {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      await apiStaffSignup({
        email: form.email.trim(), password: form.password, invite_code: inviteCode,
        full_name: form.full_name.trim() || undefined, phone: form.phone.trim() || undefined,
      });
      const isPhone = !form.email.trim();
      await requestOtp(isPhone ? { phone: form.phone.trim() } : { email: form.email.trim() });
      onSent(isPhone ? form.phone.trim() : form.email.trim());
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Unable to reach the server." : err.message);
    } finally { setLoading(false); }
  };

  return (
    <WizardShell step={2} steps={5} onBack={onBack} title="Your details" sub="Create your staff account.">
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="sd-name">Full name</label>
          <input id="sd-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Amit Sharma" />
        </p>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="sd-phone">Mobile number</label>
          <input id="sd-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
        </p>
        <p className="field" style={{ margin: 0 }}>
          <label htmlFor="sd-email">Email</label>
          <input id="sd-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="amit.shop@email.com" />
        </p>
        <p className="field" style={{ margin: 0, position: "relative" }}>
          <label htmlFor="sd-pass">Create password</label>
          <input id="sd-pass" type={show ? "text" : "password"} required minLength={8} value={form.password}
                 onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          <button type="button" className="link-btn" style={{ position: "absolute", right: 4, top: 30, fontSize: ".8rem" }} onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
        </p>
        {error && <FormError error={error} />}
        <button className="btn btn-navy btn-block" disabled={loading} style={{ padding: 12, fontSize: "1rem" }}>
          {loading ? "Creating…" : "Send OTP"}
        </button>
      </form>
    </WizardShell>
  );
}

/* STAFF: confirm store */
function StaffConfirm({ onOk, onBack }) {
  const s = useSession();
  return (
    <WizardShell step={4} steps={5} onBack={onBack} title="Confirm your store" sub="You are requesting access to:">
      <div className="authcard" style={{ boxShadow: "none", border: "1px solid var(--line)", margin: 0 }}>
        <div className="authcard-body" style={{ padding: 14 }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{s.dealer?.name || "Your store"}</h3>
          <p style={{ margin: "2px 0 0", fontSize: ".85rem", color: "var(--tx-3)" }}>Invited by the shop owner</p>
        </div>
      </div>
      <div className="secure-note" style={{ marginTop: 12 }}>
        Your request goes to the shop owner for approval. You will be notified as soon as it is approved.
      </div>
      <button className="btn btn-navy btn-block" style={{ padding: 12, fontSize: "1rem", marginTop: 12 }} onClick={onOk}>
        Send request
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
