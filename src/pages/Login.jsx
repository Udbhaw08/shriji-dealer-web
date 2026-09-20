import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEALERS, dealerById } from "../data/dealer";
import { setSession, signOut, useSession } from "../data/session";
import { COMPANY } from "../data/site";
import { Icon } from "../ui";

/* Demo authentication. Real approval happens in Zoho — an admin marks the contact
   as a dealer and attaches a price list; this app only reflects that state.
   See docs/ROLES-AND-SHARING.md before replacing any of this. */

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

function Field({ id, label, ...rest }) {
  return (
    <p className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...rest} />
    </p>
  );
}

function Apply() {
  const [form, setForm] = useState({ shop: "", person: "", phone: "", city: "" });
  const set = (k) => (e) => setForm((v) => ({ ...v, [k]: e.target.value }));
  const ok = form.shop.trim() && form.person.trim() && form.phone.trim();

  return (
    <Card
      title="Apply for dealer access"
      sub={`Already stocking Sunshine? Apply, and ${COMPANY.legal} will approve your account.`}
      foot="Approval is manual and happens in Zoho. Until it comes through, you see customer pricing."
    >
      <div className="form-grid">
        <Field id="shop" label="Shop / firm name" value={form.shop} onChange={set("shop")} placeholder="Shah Electronics" />
        <Field id="person" label="Contact person" value={form.person} onChange={set("person")} placeholder="Kunal Shah" />
        <Field id="phone" label="Phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+91 98200 00000" />
        <Field id="city" label="City" value={form.city} onChange={set("city")} placeholder="Mumbai" />
      </div>
      <button
        className="btn btn-navy btn-block"
        disabled={!ok}
        onClick={() => setSession({ role: "dealer", status: "pending", shop: form.shop, person: form.person })}
      >
        Submit application
      </button>
    </Card>
  );
}

export default function Login() {
  const s = useSession();
  const nav = useNavigate();
  const [picked, setPicked] = useState(DEALERS[0].id);
  const dealer = s.dealerId ? dealerById(s.dealerId) : null;

  /* ---- signed in as an approved dealer ---- */
  if (s.role === "dealer" && s.status === "approved" && dealer) {
    return (
      <Shell title="Your dealer account" lead={`Signed in as ${dealer.person}.`} narrow>
        <Card
          title={dealer.name}
          sub={`${dealer.person} · ${dealer.city}`}
          foot="You see dealer pricing on any product page. Links you share with customers never carry it."
        >
          <span className="badge">{dealer.tier}</span>
          <table className="spec">
            <tbody>
              <tr>
                <th scope="row">Dealer ID</th>
                <td>{dealer.id}</td>
              </tr>
              <tr>
                <th scope="row">Phone</th>
                <td>{dealer.phone}</td>
              </tr>
              <tr>
                <th scope="row">Rebate on MRP</th>
                <td>{dealer.rebatePct}% off MRP</td>
              </tr>
            </tbody>
          </table>
          <Link className="btn btn-navy btn-block" to="/products">
            <Icon name="stove" /> Browse products
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
      <Shell title="Application under review" lead={`${COMPANY.legal} reviews every dealer application.`} narrow>
        <Card
          title={`Thanks, ${s.person || "there"}`}
          sub={`Once an admin approves ${s.shop || "your shop"}, your dealer pricing and schemes unlock automatically. You do not need to apply again.`}
          foot={
            <>
              Until then you see the same prices a customer sees. Questions:{" "}
              <a className="link" href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>
                {COMPANY.phone}
              </a>
            </>
          }
        >
          <span className="badge badge-warn">Pending approval</span>
          <Link className="btn btn-navy btn-block" to="/products">
            Browse products
          </Link>
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            Sign out
          </button>
        </Card>

        <Card
          className="demo-note"
          title="Demo shortcut"
          sub="In production an admin approves the contact inside Zoho. For this draft, approve it here."
        >
          <button
            className="btn btn-navy btn-block"
            onClick={() => setSession({ role: "dealer", status: "approved", dealerId: DEALERS[0].id })}
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
      lead="Approved dealers see their own pricing and schemes. Everyone else browses the range at MRP."
    >
      <Card
        title="Dealer sign in"
        sub="Approved retail partners see their own pricing, schemes and price lists."
        foot={`Demo sign-in, no password. Real accounts are approved in Zoho by ${COMPANY.legal}`}
      >
        <p className="field">
          <label htmlFor="acct">Dealer account</label>
          <select id="acct" value={picked} onChange={(e) => setPicked(e.target.value)}>
            {DEALERS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.id}
              </option>
            ))}
          </select>
        </p>
        <button
          className="btn btn-navy btn-block"
          onClick={() => {
            setSession({ role: "dealer", status: "approved", dealerId: picked });
            nav("/products");
          }}
        >
          <Icon name="lock" /> Sign in as dealer
        </button>
      </Card>

      <Card
        title="Continue as a customer"
        sub="Browse the full Sunshine range at MRP and reach your nearest dealer."
        foot="No account is needed. Signing in only saves your details for next time."
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
