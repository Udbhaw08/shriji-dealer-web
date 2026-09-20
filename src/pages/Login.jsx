import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEALERS, dealerById } from "../data/dealer";
import { setSession, signOut, useSession } from "../data/session";
import { COMPANY } from "../data/site";
import { Icon } from "../ui";

/* Connected to Zoho Books & Commerce.
   When a dealer applies, a contact is created in Zoho.
   When an admin approves them in Zoho, their dealer pricing unlocks here.
   See docs/ROLES-AND-SHARING.md and docs/ZOHO-INTEGRATION.md */

function Card({ title, sub, foot, children, className = "" }) {
  return (
    <section className={`authcard ${className}`.trim()}>
      <div className="authcard-head">
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      <div className="authcard-body">{children}</div>
      {foot && <p className="note authcard-foot">{foot}</p>}
    </section>
  );
}

function Field({ id, label, error, ...rest }) {
  return (
    <p className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...rest} />
      {error && <span style={{ color: "var(--red-600, #dc2626)", fontSize: "0.8rem", marginTop: "4px" }}>{error}</span>}
    </p>
  );
}

function Apply() {
  const [form, setForm] = useState({ shop: "", person: "", phone: "", email: "", city: "", gst: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((v) => ({ ...v, [k]: e.target.value }));
  const ok = form.shop.trim() && form.person.trim() && form.phone.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ok || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dealer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        shop: form.shop,
        person: form.person,
        phone: form.phone,
        city: form.city,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Apply for dealer access"
      sub={`Stocking or planning to stock Sunshine? Apply here and ${COMPANY.legal} will approve your account in Zoho.`}
      foot="Once approved in Zoho, your account automatically unlocks wholesale dealer pricing and share links."
    >
      <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div className="form-grid">
          <Field id="shop" label="Shop / firm name *" required value={form.shop} onChange={set("shop")} placeholder="e.g. Shah Electronics" />
          <Field id="person" label="Contact person *" required value={form.person} onChange={set("person")} placeholder="e.g. Kunal Shah" />
          <Field id="phone" label="Mobile number *" type="tel" required value={form.phone} onChange={set("phone")} placeholder="e.g. 98200 12345" />
          <Field id="email" label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="dealer@example.com" />
          <Field id="city" label="City / Region" value={form.city} onChange={set("city")} placeholder="e.g. Mumbai" />
          <Field id="gst" label="GST Number (optional)" value={form.gst} onChange={set("gst")} placeholder="27AAAPT2184Q1Z2" />
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-navy btn-block"
          disabled={!ok || loading}
        >
          {loading ? "Connecting with Zoho..." : "Submit application to Zoho"}
        </button>
      </form>
    </Card>
  );
}

function DealerSignIn() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [picked, setPicked] = useState(DEALERS[0].id);
  const nav = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!phone.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dealer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No dealer account found.");
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Dealer sign in"
      sub="Approved retail partners see trade pricing, schemes, and shareable customer links."
      foot={`Verified in real-time against Zoho contacts.`}
    >
      <form onSubmit={handleLogin} style={{ display: "contents" }}>
        <p className="field">
          <label htmlFor="dealer-phone">Registered Mobile or Email</label>
          <input
            id="dealer-phone"
            type="text"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9869861700 or dealer@shop.com"
          />
        </p>

        {error && (
          <div style={{ padding: "8px 12px", background: "var(--red-50, #fef2f2)", color: "var(--red-700, #b91c1c)", borderRadius: "var(--r-md)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-navy btn-block"
          disabled={!phone.trim() || loading}
        >
          <Icon name="lock" /> {loading ? "Verifying with Zoho..." : "Sign in as dealer"}
        </button>
      </form>

      <div style={{ marginTop: "var(--s1)", textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setShowDemo(!showDemo)}
          style={{ background: "none", border: "none", color: "var(--tx-3)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
        >
          {showDemo ? "Hide demo accounts" : "Need a quick demo account?"}
        </button>
      </div>

      {showDemo && (
        <div style={{ padding: "12px", background: "var(--bg-subtle, #f8fafc)", borderRadius: "var(--r-md)", marginTop: "4px" }}>
          <p className="field" style={{ margin: 0 }}>
            <label htmlFor="demo-acct" style={{ fontSize: "0.8rem" }}>Sample dealer</label>
            <select id="demo-acct" value={picked} onChange={(e) => setPicked(e.target.value)}>
              {DEALERS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.id}
                </option>
              ))}
            </select>
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: "8px" }}
            onClick={() => {
              setSession({ role: "dealer", status: "approved", dealerId: picked });
              nav("/products");
            }}
          >
            Sign in as demo dealer
          </button>
        </div>
      )}
    </Card>
  );
}

export default function Login() {
  const s = useSession();
  const nav = useNavigate();
  const dealer = s.dealer || (s.dealerId ? dealerById(s.dealerId) : null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

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
          setRefreshMsg("🎉 Approved! Your dealer pricing has been unlocked.");
          nav("/products");
        } else {
          setRefreshMsg("Still pending review by Shriji admin in Zoho.");
        }
      }
    } catch {
      setRefreshMsg("Unable to reach Zoho right now. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  /* ---- signed in as an approved dealer ---- */
  if (s.role === "dealer" && s.status === "approved" && dealer) {
    return (
      <Shell title="Your dealer account" lead={`Signed in as ${dealer.person || dealer.name}.`} narrow>
        <Card
          title={dealer.name}
          sub={`${dealer.person || dealer.name} · ${dealer.city || "Verified Partner"}`}
          foot="You see dealer pricing on all product pages. Links you share with customers never carry it."
        >
          <span className="badge">{dealer.tier || "Verified Dealer"}</span>
          <table className="spec">
            <tbody>
              <tr>
                <th scope="row">Dealer ID</th>
                <td>{dealer.id}</td>
              </tr>
              {dealer.phone && (
                <tr>
                  <th scope="row">Registered Contact</th>
                  <td>{dealer.phone}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Trade Rebate</th>
                <td>{dealer.rebatePct || 20}% off MRP</td>
              </tr>
            </tbody>
          </table>
          <Link className="btn btn-navy btn-block" to="/products">
            <Icon name="stove" /> Browse products with trade pricing
          </Link>
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            Sign out
          </button>
        </Card>
      </Shell>
    );
  }

  /* ---- application submitted, waiting on the Zoho admin ---- */
  if (s.role === "dealer" && s.status === "pending") {
    return (
      <Shell title="Application under review" lead={`${COMPANY.legal} reviews every dealer application in Zoho.`} narrow>
        <Card
          title={`Thanks, ${s.person || s.shop || "Partner"}`}
          sub={`Your application for ${s.shop || "your shop"} has been submitted to Zoho. Once an admin approves your contact in Zoho, your dealer pricing and schemes will unlock automatically.`}
          foot={
            <>
              Until approved you browse at standard MRP. Need immediate approval? Call{" "}
              <a className="link" href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>
                {COMPANY.phone}
              </a>
            </>
          }
        >
          <span className="badge badge-warn">Pending Zoho approval</span>
          
          <table className="spec">
            <tbody>
              {s.shop && (
                <tr>
                  <th scope="row">Firm / Shop</th>
                  <td>{s.shop}</td>
                </tr>
              )}
              {s.person && (
                <tr>
                  <th scope="row">Applicant</th>
                  <td>{s.person}</td>
                </tr>
              )}
              {s.phone && (
                <tr>
                  <th scope="row">Phone</th>
                  <td>{s.phone}</td>
                </tr>
              )}
            </tbody>
          </table>

          {refreshMsg && (
            <div style={{ padding: "8px 12px", background: "var(--blue-50, #eff6ff)", color: "var(--blue-700, #1d4ed8)", borderRadius: "var(--r-md)", fontSize: "0.85rem" }}>
              {refreshMsg}
            </div>
          )}

          <button
            className="btn btn-navy btn-block"
            onClick={checkApprovalStatus}
            disabled={refreshing}
          >
            <Icon name="check" size={16} /> {refreshing ? "Checking Zoho..." : "Check / Refresh approval status"}
          </button>

          <Link className="btn btn-ghost btn-block" to="/products">
            Browse products at MRP
          </Link>
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            Sign out / Switch account
          </button>
        </Card>

        <Card
          className="demo-note"
          title="Demo shortcut"
          sub="Want to test without opening Zoho? Simulate an approval right here:"
        >
          <button
            className="btn btn-navy btn-block"
            onClick={() => setSession({ role: "dealer", status: "approved", dealerId: DEALERS[0].id, dealer: DEALERS[0] })}
          >
            <Icon name="check" size={16} /> Simulate admin approval
          </button>
        </Card>
      </Shell>
    );
  }

  /* ---- signed in as a customer ---- */
  if (s.role === "customer") {
    return (
      <Shell title="You are signed in" lead="Browsing as a customer.">
        <Card
          title="Customer account"
          sub="Every product shows MRP. Dealer pricing is only available to approved retail partners."
        >
          <Link className="btn btn-navy btn-block" to="/products">
            Browse products
          </Link>
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            Sign out
          </button>
        </Card>
        <Apply />
      </Shell>
    );
  }

  /* ---- guest ---- */
  return (
    <Shell
      title="Sign in"
      lead="Approved dealers see trade pricing and customer sharing tools. Everyone else browses at MRP."
    >
      <DealerSignIn />

      <Card
        title="Continue as a customer"
        sub="Browse the full Sunshine range at MRP and reach your nearest dealer."
        foot="No dealer application needed. Signing in saves your view."
      >
        <button
          className="btn btn-navy btn-block"
          onClick={() => {
            setSession({ role: "customer", person: "Customer" });
            nav("/products");
          }}
        >
          Continue as customer
        </button>
        <Link className="btn btn-ghost btn-block" to="/products">
          Browse without signing in
        </Link>
      </Card>

      <Apply />
    </Shell>
  );
}

function Shell({ title, lead, narrow, children }) {
  return (
    <section className="sec" style={{ paddingTop: "var(--s6)" }}>
      <div className="wrap">
        <h1 className="d2">{title}</h1>
        {lead && (
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {lead}
          </p>
        )}
        <div className={`authgrid${narrow ? " authgrid-narrow" : ""}`}>{children}</div>
      </div>
    </section>
  );
}
