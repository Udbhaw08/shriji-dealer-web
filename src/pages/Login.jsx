import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEALERS, dealerById } from "../data/dealer";
import { setSession, signOut, useSession } from "../data/session";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";

export default function Login() {
  const { t } = useLanguage();
  const s = useSession();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState("dealer"); // "dealer" | "customer" | "apply"

  // Dealer login states
  const [phone, setPhone] = useState("");
  const [dealerLoading, setDealerLoading] = useState(false);
  const [dealerError, setDealerError] = useState("");

  // Application form states
  const [applyForm, setApplyForm] = useState({ shop: "", person: "", phone: "", email: "", city: "", gst: "" });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Pending approval refresh states
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  const handleDealerLogin = async (inputVal) => {
    const val = (inputVal || phone).trim();
    if (!val || dealerLoading) return;
    setDealerLoading(true);
    setDealerError("");

    try {
      const res = await fetch("/api/dealer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: val }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No dealer account found in Zoho with that phone/email.");
      }

      const d = data.dealer;
      setSession({
        role: "dealer",
        status: d.status, // "approved" or "pending"
        dealerId: d.id,
        dealer: d,
        shop: d.name,
        person: d.person,
        phone: d.phone,
        city: d.city,
      });

      if (d.status === "approved") {
        nav("/products");
      }
    } catch (err) {
      setDealerError(err.message);
    } finally {
      setDealerLoading(false);
    }
  };

  const handleCustomerLogin = (name = "Customer") => {
    setSession({
      role: "customer",
      person: name,
    });
    nav("/products");
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applyForm.shop.trim() || !applyForm.person.trim() || !applyForm.phone.trim() || applyLoading) return;
    setApplyLoading(true);
    setApplyError("");

    try {
      const res = await fetch("/api/dealer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applyForm),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit dealer application to Zoho.");
      }

      setSession({
        role: "dealer",
        status: "pending",
        dealerId: data.dealer?.id,
        dealer: data.dealer,
        shop: applyForm.shop,
        person: applyForm.person,
        phone: applyForm.phone,
        city: applyForm.city,
      });
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setApplyLoading(false);
    }
  };

  const checkApprovalStatus = async () => {
    if (!s.phone) return;
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const res = await fetch("/api/dealer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: s.phone }),
      });
      const data = await res.json();
      if (res.ok && data.dealer) {
        if (data.dealer.status === "approved") {
          setSession({
            role: "dealer",
            status: "approved",
            dealerId: data.dealer.id,
            dealer: data.dealer,
            shop: data.dealer.name,
            person: data.dealer.person,
            phone: data.dealer.phone,
            city: data.dealer.city,
          });
          setRefreshMsg("🎉 Approved in Zoho! Your trade pricing and price list are unlocked.");
          setTimeout(() => nav("/products"), 1200);
        } else {
          setRefreshMsg("Status: Contact is in Zoho, waiting for admin approval.");
        }
      }
    } catch {
      setRefreshMsg("Unable to reach Zoho right now. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const dealer = s.dealer || (s.dealerId ? dealerById(s.dealerId) : null);

  // ----------------------------------------------------
  // VIEW 1: ALREADY LOGGED IN AS APPROVED DEALER
  // ----------------------------------------------------
  if (s.role === "dealer" && s.status === "approved" && dealer) {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="authcard" style={{ borderTop: "4px solid var(--blue-600, #2563eb)" }}>
            <div className="authcard-head">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <span className="badge badge-ok" style={{ marginBottom: "8px" }}>
                    {t("active_dealer_portal")}
                  </span>
                  <h2 style={{ fontSize: "1.4rem" }}>{dealer.name}</h2>
                  <p style={{ margin: "4px 0 0" }}>
                    {dealer.person || dealer.name} · {dealer.city || "Verified Partner"}
                  </p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={signOut}
                  style={{ color: "var(--tx-3)" }}
                  title="Sign out of dealer session"
                >
                  {t("sign_out")}
                </button>
              </div>
            </div>

            <div className="authcard-body" style={{ marginTop: "var(--s3)" }}>
              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "14px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
                <table className="spec" style={{ margin: 0 }}>
                  <tbody>
                    <tr>
                      <th scope="row">Dealer ID</th>
                      <td><b>{dealer.id}</b></td>
                    </tr>
                    {dealer.phone && (
                      <tr>
                        <th scope="row">{t("phone_label")}</th>
                        <td>{dealer.phone}</td>
                      </tr>
                    )}
                    {dealer.city && (
                      <tr>
                        <th scope="row">Location</th>
                        <td>{dealer.city}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "var(--s3)" }}>
                <Link className="btn btn-navy btn-block" to="/products" style={{ textAlign: "center" }}>
                  <Icon name="stove" size={17} /> {t("nav_products")}
                </Link>
                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => handleCustomerLogin("Customer")}
                >
                  Switch to Customer View
                </button>
              </div>

              <p className="note" style={{ textAlign: "center", marginTop: "4px" }}>
                You see wholesale dealer rates. Any link you share with customers automatically opens retail MRP.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: APPLICATION PENDING IN ZOHO
  // ----------------------------------------------------
  if (s.role === "dealer" && s.status === "pending") {
    return (
      <section className="sec" style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div className="authcard" style={{ borderTop: "4px solid var(--amber-500, #f59e0b)" }}>
            <div className="authcard-head">
              <span className="badge badge-warn" style={{ marginBottom: "8px" }}>
                {t("pending_approval")}
              </span>
              <h2 style={{ fontSize: "1.3rem" }}>Application Submitted, {s.person || s.shop || "Partner"}</h2>
              <p>
                Your application for <b>{s.shop || "your firm"}</b> has been registered in Zoho Books. Once our distribution team activates your account in Zoho, your wholesale pricing unlocks immediately.
              </p>
            </div>

            <div className="authcard-body">
              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "12px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
                <table className="spec" style={{ margin: 0 }}>
                  <tbody>
                    {s.shop && (
                      <tr>
                        <th scope="row">{t("shop_name_label")}</th>
                        <td>{s.shop}</td>
                      </tr>
                    )}
                    {s.person && (
                      <tr>
                        <th scope="row">{t("contact_person_label")}</th>
                        <td>{s.person}</td>
                      </tr>
                    )}
                    {s.phone && (
                      <tr>
                        <th scope="row">{t("phone_label")}</th>
                        <td>{s.phone}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {refreshMsg && (
                <div style={{ padding: "10px 14px", background: "var(--blue-50, #eff6ff)", color: "var(--blue-700, #1d4ed8)", borderRadius: "var(--r-md)", fontSize: "0.88rem", fontWeight: 500 }}>
                  {refreshMsg}
                </div>
              )}

              <button
                className="btn btn-navy btn-block"
                onClick={checkApprovalStatus}
                disabled={refreshing}
              >
                <Icon name="bolt" size={16} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
                {refreshing ? t("verifying_zoho") : t("check_status_btn")}
              </button>

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <Link className="btn btn-ghost btn-block" to="/products">
                  {t("browse_catalog_directly")}
                </Link>
                <button className="btn btn-ghost btn-block" onClick={signOut}>
                  {t("sign_out")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ----------------------------------------------------
  // VIEW 3: SIGN IN SCREEN (TABBED INTERFACE)
  // ----------------------------------------------------
  return (
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap" style={{ maxWidth: 740 }}>
        {/* Top Header */}
        <div style={{ textAlign: "center", marginBottom: "var(--s5)" }}>
          <h1 className="d2">{t("auth_access_title")}</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {t("auth_access_sub")}
          </p>

          {/* Segmented Pill Tabs */}
          <div className="tabs" role="tablist" style={{ marginTop: "var(--s4)", display: "inline-flex" }}>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "dealer"}
              onClick={() => setActiveTab("dealer")}
            >
              {t("tab_dealer_signin")}
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "customer"}
              onClick={() => setActiveTab("customer")}
            >
              {t("tab_customer_access")}
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "apply"}
              onClick={() => setActiveTab("apply")}
            >
              {t("tab_apply_dealer")}
            </button>
          </div>
        </div>

        {/* TAB 1: DEALER SIGN IN */}
        {activeTab === "dealer" && (
          <div className="authcard rise" style={{ borderTop: "4px solid var(--blue-600, #2563eb)" }}>
            <div className="authcard-head">
              <h2>{t("dealer_login_title")}</h2>
              <p>
                {t("dealer_login_sub")}
              </p>
            </div>

            <div className="authcard-body">
              <form onSubmit={(e) => { e.preventDefault(); handleDealerLogin(); }} style={{ display: "contents" }}>
                <p className="field">
                  <label htmlFor="dealer-phone">{t("dealer_phone_label")}</label>
                  <input
                    id="dealer-phone"
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("dealer_phone_placeholder")}
                    autoComplete="tel"
                  />
                </p>

                {dealerError && (
                  <div style={{ padding: "8px 12px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: "0.85rem" }}>
                    {dealerError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-navy btn-block"
                  disabled={!phone.trim() || dealerLoading}
                  style={{ padding: "12px", fontSize: "1rem" }}
                >
                  <Icon name="lock" size={16} />
                  {dealerLoading ? t("verifying_zoho") : t("dealer_signin_btn")}
                </button>
              </form>

              {/* Quick 1-Click Client Testing Chips */}
              <div style={{ marginTop: "var(--s4)", padding: "14px 16px", background: "var(--bg-subtle, #f8fafc)", borderRadius: "var(--r-md)", border: "1px dashed var(--blue-300, #93c5fd)" }}>
                <p style={{ margin: "0 0 10px", fontSize: "0.82rem", fontWeight: 700, color: "var(--blue-900, #1e3a8a)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="bolt" size={15} /> 1-Click Test Accounts for Client Testing:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-white btn-sm"
                    style={{ borderColor: "var(--blue-300)", fontWeight: 600, fontSize: "0.82rem" }}
                    onClick={() => {
                      setPhone("7896543217");
                      handleDealerLogin("7896543217");
                    }}
                  >
                    ⚡ Test Dealer: hello (Mumbai PL May 2026)
                  </button>
                  <button
                    type="button"
                    className="btn btn-white btn-sm"
                    style={{ borderColor: "var(--line)", fontWeight: 600, fontSize: "0.82rem" }}
                    onClick={() => {
                      setSession({ role: "dealer", status: "approved", dealerId: DEALERS[0].id, dealer: DEALERS[0] });
                      nav("/products");
                    }}
                  >
                    🏢 Shah Electronics
                  </button>
                  <button
                    type="button"
                    className="btn btn-white btn-sm"
                    style={{ borderColor: "var(--line)", fontWeight: 600, fontSize: "0.82rem" }}
                    onClick={() => {
                      setSession({ role: "dealer", status: "approved", dealerId: DEALERS[1].id, dealer: DEALERS[1] });
                      nav("/products");
                    }}
                  >
                    🏪 Rajesh Appliances
                  </button>
                </div>
              </div>
            </div>

            <p className="note authcard-foot" style={{ textAlign: "center" }}>
              New dealer? <button type="button" className="link" onClick={() => setActiveTab("apply")}>Apply for dealer access</button> or <button type="button" className="link" onClick={() => setActiveTab("customer")}>browse as customer</button>.
            </p>
          </div>
        )}

        {/* TAB 2: CUSTOMER ACCESS */}
        {activeTab === "customer" && (
          <div className="authcard rise" style={{ borderTop: "4px solid var(--navy, #0f172a)" }}>
            <div className="authcard-head">
              <h2>{t("customer_view_title")}</h2>
              <p>
                {t("customer_view_sub")}
              </p>
            </div>

            <div className="authcard-body">
              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "16px", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.9rem", lineHeight: 1.8, color: "var(--tx-2)" }}>
                  <li>Browse 400+ genuine Sunshine kitchen appliances</li>
                  <li>View official retail MRP and technical specifications</li>
                  <li>Direct WhatsApp & Phone calling to authorized dealers</li>
                  <li>No registration or approval needed to browse</li>
                </ul>
              </div>

              <div style={{ display: "grid", gap: "10px", marginTop: "var(--s2)" }}>
                <button
                  className="btn btn-navy btn-block"
                  style={{ padding: "12px", fontSize: "1rem" }}
                  onClick={() => handleCustomerLogin("Customer")}
                >
                  <Icon name="arrowsm" size={16} /> {t("customer_enter_btn")}
                </button>
                <Link className="btn btn-ghost btn-block" to="/products">
                  {t("browse_catalog_directly")}
                </Link>
              </div>
            </div>

            <p className="note authcard-foot" style={{ textAlign: "center" }}>
              Are you a dealer? <button type="button" className="link" onClick={() => setActiveTab("dealer")}>Sign in for wholesale trade rates</button>.
            </p>
          </div>
        )}

        {/* TAB 3: APPLY FOR DEALER ACCESS */}
        {activeTab === "apply" && (
          <div className="authcard rise" style={{ borderTop: "4px solid var(--green-600, #16a34a)" }}>
            <div className="authcard-head">
              <h2>{t("apply_dealer_title")}</h2>
              <p>
                {t("apply_dealer_sub")}
              </p>
            </div>

            <div className="authcard-body">
              <form onSubmit={handleApplySubmit} style={{ display: "contents" }}>
                <div className="form-grid">
                  <p className="field">
                    <label htmlFor="apply-shop">{t("shop_name_label")} *</label>
                    <input
                      id="apply-shop"
                      required
                      value={applyForm.shop}
                      onChange={(e) => setApplyForm({ ...applyForm, shop: e.target.value })}
                      placeholder="e.g. Shah Electronics"
                    />
                  </p>
                  <p className="field">
                    <label htmlFor="apply-person">{t("contact_person_label")} *</label>
                    <input
                      id="apply-person"
                      required
                      value={applyForm.person}
                      onChange={(e) => setApplyForm({ ...applyForm, person: e.target.value })}
                      placeholder="e.g. Kunal Shah"
                    />
                  </p>
                  <p className="field">
                    <label htmlFor="apply-phone">{t("phone_label")} *</label>
                    <input
                      id="apply-phone"
                      type="tel"
                      required
                      value={applyForm.phone}
                      onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                      placeholder="e.g. 98200 12345"
                    />
                  </p>
                  <p className="field">
                    <label htmlFor="apply-email">Email Address</label>
                    <input
                      id="apply-email"
                      type="email"
                      value={applyForm.email}
                      onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                      placeholder="dealer@example.com"
                    />
                  </p>
                  <p className="field">
                    <label htmlFor="apply-city">{t("city_label")} / Region</label>
                    <input
                      id="apply-city"
                      value={applyForm.city}
                      onChange={(e) => setApplyForm({ ...applyForm, city: e.target.value })}
                      placeholder="e.g. Mumbai"
                    />
                  </p>
                  <p className="field">
                    <label htmlFor="apply-gst">GST Number (optional)</label>
                    <input
                      id="apply-gst"
                      value={applyForm.gst}
                      onChange={(e) => setApplyForm({ ...applyForm, gst: e.target.value })}
                      placeholder="27AAAPT2184Q1Z2"
                    />
                  </p>
                </div>

                {applyError && (
                  <div style={{ padding: "8px 12px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: "0.85rem" }}>
                    {applyError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-navy btn-block"
                  disabled={!applyForm.shop.trim() || !applyForm.person.trim() || !applyForm.phone.trim() || applyLoading}
                  style={{ padding: "12px", fontSize: "1rem" }}
                >
                  <Icon name="check" size={16} />
                  {applyLoading ? t("verifying_zoho") : t("apply_submit_btn")}
                </button>
              </form>
            </div>

            <p className="note authcard-foot" style={{ textAlign: "center" }}>
              Already approved in Zoho? <button type="button" className="link" onClick={() => setActiveTab("dealer")}>Sign in directly with your registered phone</button>.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
