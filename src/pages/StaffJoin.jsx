import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSession, revalidateSession } from "../data/session";
import { lookupStaffCode, staffSignup } from "../data/auth";
import { formatLoginCode } from "../data/loginCode";
import { isValidEmail, isValidPhone, isValidName } from "../data/validators";

export default function StaffJoin() {
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isApproved = session && session.role === "dealer" && session.status === "approved";
  const isPending = session && (session.status === "pending" || session.dealer?.status === "pending");

  useEffect(() => {
    if (isApproved) {
      navigate("/products", { replace: true });
    } else if (isPending) {
      navigate("/dealer/pending?kind=staff", { replace: true });
    }
  }, [isApproved, isPending, navigate]);

  // Step 1: Code lookup
  const initialCode = searchParams.get("code") || searchParams.get("dealer") || "";
  const [code, setCode] = useState(formatLoginCode(initialCode));
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [storeInfo, setStoreInfo] = useState(null);

  // Step 2: Staff Registration
  const [form, setForm] = useState({
    fullName: session?.fullName || "",
    email: session?.email || "",
    phone: session?.phone || "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleLookup = async (codeToVerify) => {
    const raw = String(codeToVerify || code).trim();
    if (!raw) {
      setLookupError("Please enter a Dealer or Business Code");
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

  // Auto-verify if code is provided in URL
  useEffect(() => {
    if (initialCode && !storeInfo && !lookupLoading) {
      handleLookup(initialCode);
    }
  }, [initialCode]);

  const resetStore = () => {
    setStoreInfo(null);
    setLookupError("");
    setCode("");
  };

  const validateForm = () => {
    const errors = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      errors.fullName = "Please enter your full name (minimum 2 characters)";
    } else if (!isValidName(form.fullName)) {
      errors.fullName = "Name should contain letters only";
    }

    if (!form.email.trim() || !isValidEmail(form.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!form.phone.trim() || !isValidPhone(form.phone)) {
      errors.phone = "Please enter a valid 10-digit mobile number";
    }

    if (!form.password || form.password.length < 8) {
      errors.password = "Password must be at least 8 characters long";
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeInfo) return;
    if (!validateForm()) return;

    setSubmitLoading(true);
    setSubmitError("");

    try {
      await staffSignup({
        dealer_code: storeInfo.dealer_code || code,
        invite_code: storeInfo.dealer_code || code,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        full_name: form.fullName.trim(),
      });

      await revalidateSession().catch(() => {});
      navigate("/dealer/pending?kind=staff", { replace: true });
    } catch (err) {
      setSubmitError(err.message || "Failed to submit staff registration. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="staff-join-page" style={{
      maxWidth: 540,
      margin: "0 auto",
      padding: "24px 16px 64px",
      minHeight: "80vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      boxSizing: "border-box",
      overflowX: "clip",
    }}>
      {/* Header Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/login" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: ".88rem",
          color: "var(--tx-muted, #64748b)",
          textDecoration: "none",
          fontWeight: 500,
          padding: "6px 0",
        }}>
          <span style={{ fontSize: "1.1rem" }}>←</span> Back to Sign In
        </Link>
      </div>

      <div style={{
        background: "var(--bg-card, #ffffff)",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "var(--r-lg, 16px)",
        padding: "28px 24px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
      }}>
        {/* Title & Badge */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--brand-surface, #f0fdf4)",
            color: "var(--brand-green, #16a34a)",
            fontSize: "1.5rem",
            marginBottom: 12,
            border: "1px solid var(--border-green, #bbf7d0)",
          }}>
            👥
          </div>
          <h1 style={{
            fontSize: "1.45rem",
            fontWeight: 800,
            margin: "0 0 6px",
            color: "var(--tx-1, #0f172a)",
            letterSpacing: "-0.02em",
          }}>
            Join Store as Staff
          </h1>
          <p style={{
            fontSize: ".9rem",
            color: "var(--tx-2, #64748b)",
            margin: 0,
            lineHeight: 1.45,
          }}>
            Connect to your dealership to access wholesale dealer pricing, digital catalog, and customer sharing.
          </p>
        </div>

        {/* Step 1: Dealer Code Lookup Card */}
        {!storeInfo ? (
          <div>
            <div style={{
              background: "var(--bg-subtle, #f8fafc)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--r-md, 12px)",
              padding: "16px 18px",
              marginBottom: 20,
            }}>
              <label htmlFor="dealer-code-input" style={{
                display: "block",
                fontWeight: 700,
                fontSize: ".88rem",
                color: "var(--tx-1, #1e293b)",
                marginBottom: 8,
              }}>
                Store / Dealer Code
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  id="dealer-code-input"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(formatLoginCode(e.target.value));
                    setLookupError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  placeholder="e.g. DE-ABC-1234 or ST-KRT-1742"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  style={{
                    flex: "1 1 200px",
                    padding: "11px 14px",
                    fontSize: ".98rem",
                    fontWeight: 700,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    borderRadius: "var(--r-md, 8px)",
                    border: lookupError ? "1.5px solid var(--red-500, #ef4444)" : "1px solid var(--border, #cbd5e1)",
                    outline: "none",
                    background: "#ffffff",
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleLookup()}
                  disabled={!code.trim() || lookupLoading}
                  style={{
                    padding: "11px 20px",
                    fontSize: ".92rem",
                    fontWeight: 700,
                    borderRadius: "var(--r-md, 8px)",
                    background: "var(--brand, #0f172a)",
                    color: "#ffffff",
                    border: "none",
                    cursor: (!code.trim() || lookupLoading) ? "not-allowed" : "pointer",
                    opacity: (!code.trim() || lookupLoading) ? 0.6 : 1,
                    transition: "all .15s ease",
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {lookupLoading ? "Checking…" : "Verify Store"}
                </button>
              </div>

              {lookupError && (
                <div style={{
                  marginTop: 10,
                  fontSize: ".84rem",
                  color: "var(--red-600, #dc2626)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <span>⚠️</span> {lookupError}
                </div>
              )}

              <div style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "var(--blue-50, #eff6ff)",
                border: "1px solid var(--blue-200, #bfdbfe)",
                borderRadius: 8,
                fontSize: ".82rem",
                color: "var(--blue-900, #1e3a8a)",
                lineHeight: 1.45,
              }}>
                <span style={{ fontWeight: 700 }}>Where to find your code?</span> Ask your shop owner or manager. Their official Dealer Code is shown in their Dealer Dashboard and Store Settings.
              </div>
            </div>

            <div style={{
              padding: "12px 16px",
              background: "var(--bg-subtle, #f8fafc)",
              borderRadius: "var(--r-md, 10px)",
              border: "1px solid var(--border, #e2e8f0)",
              textAlign: "center",
              fontSize: ".88rem",
              color: "var(--tx-muted, #64748b)",
              marginBottom: 12,
            }}>
              Already registered as staff?{" "}
              <Link
                to="/login?role=staff"
                style={{
                  color: "var(--brand, #0f172a)",
                  fontWeight: 700,
                  textDecoration: "underline",
                }}
              >
                Sign In with Email & Password →
              </Link>
            </div>

            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <span style={{ fontSize: ".86rem", color: "var(--tx-muted, #64748b)" }}>
                Are you a business owner applying for your own dealership?{" "}
                <Link to="/dealer/apply" style={{
                  color: "var(--brand-green, #16a34a)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}>
                  Apply as Dealer Owner →
                </Link>
              </span>
            </div>
          </div>
        ) : (
          /* Step 2: Store Verified -> Registration Details */
          <div>
            {/* Verified Store Card */}
            <div style={{
              background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
              border: "1px solid #86efac",
              borderRadius: "var(--r-md, 12px)",
              padding: "14px 16px",
              marginBottom: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}>
              <div>
                <div style={{
                  fontSize: ".78rem",
                  fontWeight: 800,
                  color: "#166534",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 2,
                }}>
                  <span>✓</span> Verified Dealership
                </div>
                <div style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "#0f172a",
                }}>
                  {storeInfo.business_name}
                </div>
                <div style={{
                  fontSize: ".82rem",
                  fontWeight: 600,
                  color: "#475569",
                  marginTop: 2,
                }}>
                  Code: <span style={{ fontFamily: "monospace", letterSpacing: ".06em", fontWeight: 700 }}>{storeInfo.dealer_code}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={resetStore}
                style={{
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: ".8rem",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Change Code
              </button>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              {/* Full Name */}
              <div>
                <label htmlFor="staff-name" style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: ".86rem",
                  color: "var(--tx-1, #1e293b)",
                  marginBottom: 6,
                }}>
                  Your Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="staff-name"
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => {
                    setForm({ ...form, fullName: e.target.value });
                    setFieldErrors({ ...fieldErrors, fullName: null });
                  }}
                  placeholder="e.g. Ramesh Kumar"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    fontSize: ".94rem",
                    borderRadius: "var(--r-md, 8px)",
                    border: fieldErrors.fullName ? "1.5px solid #ef4444" : "1px solid var(--border, #cbd5e1)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {fieldErrors.fullName && (
                  <div style={{ fontSize: ".8rem", color: "#dc2626", marginTop: 4 }}>
                    {fieldErrors.fullName}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="staff-email" style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: ".86rem",
                  color: "var(--tx-1, #1e293b)",
                  marginBottom: 6,
                }}>
                  Email Address <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    setFieldErrors({ ...fieldErrors, email: null });
                  }}
                  placeholder="e.g. ramesh@sunshinedealer.com"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    fontSize: ".94rem",
                    borderRadius: "var(--r-md, 8px)",
                    border: fieldErrors.email ? "1.5px solid #ef4444" : "1px solid var(--border, #cbd5e1)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {fieldErrors.email && (
                  <div style={{ fontSize: ".8rem", color: "#dc2626", marginTop: 4 }}>
                    {fieldErrors.email}
                  </div>
                )}
              </div>

              {/* Mobile Phone (Required) */}
              <div>
                <label htmlFor="staff-phone" style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: ".86rem",
                  color: "var(--tx-1, #1e293b)",
                  marginBottom: 6,
                }}>
                  Mobile Phone Number <span style={{ color: "#ef4444" }}>*</span> <span style={{ fontWeight: 400, color: "var(--tx-muted, #64748b)", fontSize: ".8rem" }}>(10 digits)</span>
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{
                    padding: "10px 12px",
                    background: "var(--bg-subtle, #f1f5f9)",
                    border: "1px solid var(--border, #cbd5e1)",
                    borderRadius: "var(--r-md, 8px)",
                    fontSize: ".9rem",
                    fontWeight: 700,
                    color: "var(--tx-muted, #64748b)",
                    display: "flex",
                    alignItems: "center",
                  }}>
                    +91
                  </span>
                  <input
                    id="staff-phone"
                    type="tel"
                    required
                    maxLength={10}
                    value={form.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      setForm({ ...form, phone: digits });
                      setFieldErrors({ ...fieldErrors, phone: null });
                    }}
                    placeholder="e.g. 9876543210"
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      fontSize: ".94rem",
                      borderRadius: "var(--r-md, 8px)",
                      border: fieldErrors.phone ? "1.5px solid #ef4444" : "1px solid var(--border, #cbd5e1)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
                {fieldErrors.phone && (
                  <div style={{ fontSize: ".8rem", color: "#dc2626", marginTop: 4 }}>
                    {fieldErrors.phone}
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="staff-password" style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: ".86rem",
                  color: "var(--tx-1, #1e293b)",
                  marginBottom: 6,
                }}>
                  Create Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="staff-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => {
                      setForm({ ...form, password: e.target.value });
                      setFieldErrors({ ...fieldErrors, password: null });
                    }}
                    placeholder="Minimum 8 characters"
                    style={{
                      width: "100%",
                      padding: "10px 42px 10px 14px",
                      fontSize: ".94rem",
                      borderRadius: "var(--r-md, 8px)",
                      border: fieldErrors.password ? "1.5px solid #ef4444" : "1px solid var(--border, #cbd5e1)",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "var(--tx-muted, #64748b)",
                      cursor: "pointer",
                      fontSize: ".84rem",
                      fontWeight: 600,
                      padding: 4,
                    }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {fieldErrors.password && (
                  <div style={{ fontSize: ".8rem", color: "#dc2626", marginTop: 4 }}>
                    {fieldErrors.password}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="staff-confirm-password" style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: ".86rem",
                  color: "var(--tx-1, #1e293b)",
                  marginBottom: 6,
                }}>
                  Confirm Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="staff-confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.confirmPassword}
                  onChange={(e) => {
                    setForm({ ...form, confirmPassword: e.target.value });
                    setFieldErrors({ ...fieldErrors, confirmPassword: null });
                  }}
                  placeholder="Re-type password"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    fontSize: ".94rem",
                    borderRadius: "var(--r-md, 8px)",
                    border: fieldErrors.confirmPassword ? "1.5px solid #ef4444" : "1px solid var(--border, #cbd5e1)",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
                {fieldErrors.confirmPassword && (
                  <div style={{ fontSize: ".8rem", color: "#dc2626", marginTop: 4 }}>
                    {fieldErrors.confirmPassword}
                  </div>
                )}
              </div>

              {submitError && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: ".86rem",
                  color: "#b91c1c",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span>⚠️</span> {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitLoading}
                style={{
                  marginTop: 6,
                  padding: "13px 20px",
                  fontSize: "1rem",
                  fontWeight: 700,
                  borderRadius: "var(--r-md, 10px)",
                  background: "var(--brand, #0f172a)",
                  color: "#ffffff",
                  border: "none",
                  cursor: submitLoading ? "not-allowed" : "pointer",
                  opacity: submitLoading ? 0.7 : 1,
                  transition: "all .15s ease",
                  minHeight: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {submitLoading ? (
                  <>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                    Registering Staff Account…
                  </>
                ) : (
                  "Join Store & Submit for Approval →"
                )}
              </button>

              <div style={{
                fontSize: ".8rem",
                color: "var(--tx-muted, #64748b)",
                textAlign: "center",
                lineHeight: 1.45,
                marginTop: 4,
              }}>
                By joining, a pending access request will be sent to the dealership owner for authorization.
              </div>

              <div style={{
                marginTop: 12,
                padding: "12px 16px",
                background: "var(--bg-subtle, #f8fafc)",
                borderRadius: "var(--r-md, 10px)",
                border: "1px solid var(--border, #e2e8f0)",
                textAlign: "center",
                fontSize: ".88rem",
                color: "var(--tx-muted, #64748b)",
              }}>
                Already registered as staff?{" "}
                <Link
                  to="/login?role=staff"
                  style={{
                    color: "var(--brand, #0f172a)",
                    fontWeight: 700,
                    textDecoration: "underline",
                  }}
                >
                  Sign In with Email & Password →
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
