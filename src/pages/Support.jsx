import { useState } from "react";
import { COMPANY, ISSUE_TYPES, MATERIALS } from "../data/site";
import { Icon, EnquiryButtons } from "../ui";
import { useProducts } from "../data/productsStore";

const TICKETS = [
  { id: "SR-2418", model: "3B Carnival Plus Auto Tablet Hob", issue: "Spare part required", state: "Open", tone: "badge-warn", when: "Raised 2 days ago" },
  { id: "SR-2402", model: "60 Dijon BLDC Chimney", issue: "Installation support", state: "Resolved", tone: "", when: "Closed 11 Sep 2026" },
  { id: "SR-2377", model: "4B Magic Plus SS Gas Stove", issue: "Warranty claim", state: "Resolved", tone: "", when: "Closed 28 Aug 2026" },
];

function ServiceForm() {
  const { products: PRODUCTS, categories: CATEGORIES } = useProducts();
  const [v, setV] = useState({ product: "", issue: "", desc: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!v.product) next.product = "Select the product the request is about.";
    if (!v.issue) next.issue = "Select an issue type.";
    if (v.desc.trim().length < 10) next.desc = "Describe the issue in a sentence or two.";
    setErrors(next);
    if (!Object.keys(next).length) setSent(true);
  };

  if (sent) {
    return (
      <div className="ok">
        <Icon name="check" size={22} style={{ flex: "none", marginTop: 2 }} />
        <div>
          <h3 className="h3" style={{ fontSize: "1.05rem" }}>
            Request logged
          </h3>
          <p style={{ fontSize: "0.92rem", marginTop: 4 }}>
            In the live site this creates a ticket and the service desk responds the same working day. This demo build
            stores nothing — nothing was sent.
          </p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: "var(--s4)" }} onClick={() => setSent(false)}>
            Raise another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="product">Product</label>
        <select id="product" value={v.product} onChange={set("product")} aria-invalid={!!errors.product} aria-describedby={errors.product ? "e-product" : undefined}>
          <option value="">Select Product</option>
          {CATEGORIES.map((c) => (
            <optgroup key={c.key} label={c.label}>
              {PRODUCTS.filter((p) => p.cat === c.key)
                .slice(0, 14)
                .map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {errors.product && (
          <span className="err" id="e-product">
            {errors.product}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="issue">Issue Type</label>
        <select id="issue" value={v.issue} onChange={set("issue")} aria-invalid={!!errors.issue} aria-describedby={errors.issue ? "e-issue" : undefined}>
          <option value="">Select Issue Type</option>
          {ISSUE_TYPES.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        {errors.issue && (
          <span className="err" id="e-issue">
            {errors.issue}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="desc">Description</label>
        <textarea id="desc" rows="4" value={v.desc} onChange={set("desc")} placeholder="Describe the issue…" aria-invalid={!!errors.desc} aria-describedby={errors.desc ? "e-desc" : undefined} />
        {errors.desc && (
          <span className="err" id="e-desc">
            {errors.desc}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="photos">
          Upload Images <span className="note">(Optional)</span>
        </label>
        <label className="dropzone" htmlFor="photos">
          <Icon name="upload" size={20} />
          <b style={{ fontSize: "0.9rem" }}>Add Photos</b>
          <span className="note">PNG or JPG, up to 5 files</span>
          <input id="photos" type="file" multiple accept="image/*" style={{ display: "none" }} />
        </label>
      </div>

      <button className="btn btn-navy btn-block" type="submit">
        Submit Request
      </button>
      <p className="note">Demo form — submissions are not stored or sent.</p>
    </form>
  );
}

function DealerForm() {
  const [v, setV] = useState({ shop: "", person: "", phone: "", city: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!v.shop.trim()) next.shop = "Enter the shop or firm name.";
    if (!v.person.trim()) next.person = "Enter a contact name.";
    if (!/^[+\d][\d\s-]{8,}$/.test(v.phone.trim())) next.phone = "Enter a reachable phone number.";
    if (!v.city.trim()) next.city = "Enter the city you sell in.";
    setErrors(next);
    if (!Object.keys(next).length) setSent(true);
  };

  if (sent) {
    return (
      <div className="ok">
        <Icon name="check" size={22} style={{ flex: "none", marginTop: 2 }} />
        <div>
          <h3 className="h3" style={{ fontSize: "1.05rem" }}>
            Enquiry noted, {v.person.split(" ")[0]}
          </h3>
          <p style={{ fontSize: "0.92rem", marginTop: 4 }}>
            In the live site this reaches the distribution desk and someone calls {v.city} within a working day. Demo
            build — nothing was sent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <DealerField id="shop" label="Shop / firm name" ph="Shah Electronics" value={v.shop} onChange={set("shop")} error={errors.shop} />
        <DealerField id="person" label="Contact person" ph="Kunal Shah" value={v.person} onChange={set("person")} error={errors.person} />
        <DealerField id="phone" label="Phone" ph="+91 98200 00000" type="tel" value={v.phone} onChange={set("phone")} error={errors.phone} />
        <DealerField id="city" label="City" ph="Mumbai" value={v.city} onChange={set("city")} error={errors.city} />
      </div>
      <div className="row">
        <button className="btn btn-navy" type="submit">
          Send dealership enquiry <Icon name="arrowsm" />
        </button>
        <span className="note">Demo form — nothing is stored or sent.</span>
      </div>
    </form>
  );
}

function DealerField({ id, label, ph, type = "text", value, onChange, error }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={ph}
        aria-invalid={!!error}
        aria-describedby={error ? `e-${id}` : undefined}
      />
      {error && (
        <span className="err" id={`e-${id}`}>
          {error}
        </span>
      )}
    </div>
  );
}

const MAT_TABS = ["Images", "Videos", "Brochures"];

export default function Support() {
  const [tab, setTab] = useState("request");
  const [matTab, setMatTab] = useState("Images");

  return (
    <>
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <h1 className="d2">Service Support</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            Raise a request against any model in the range and track it to closure.
          </p>

          <div className="tabs" role="tablist" aria-label="Support view" style={{ marginTop: "var(--s5)" }}>
            <button className="tab" role="tab" aria-selected={tab === "request"} onClick={() => setTab("request")}>
              Raise Request
            </button>
            <button className="tab" role="tab" aria-selected={tab === "tickets"} onClick={() => setTab("tickets")}>
              My Tickets
            </button>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "var(--s5)", alignItems: "start" }}>
            <div className="card pad">
              {tab === "request" ? (
                <ServiceForm />
              ) : (
                <div className="stack" style={{ gap: "var(--s3)" }}>
                  {TICKETS.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: "var(--r)",
                        padding: "var(--s4)",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", gap: "var(--s3)" }}>
                        <b style={{ fontSize: "0.9rem" }}>{t.id}</b>
                        <span className={`badge ${t.tone}`}>{t.state}</span>
                      </div>
                      <b style={{ fontSize: "0.95rem" }}>{t.model}</b>
                      <span className="muted small">{t.issue}</span>
                      <span className="note">{t.when}</span>
                    </div>
                  ))}
                  <p className="note">Sample tickets — the live list loads from the dealer account.</p>
                </div>
              )}
            </div>

            <div className="stack" style={{ gap: "var(--s5)" }}>
              <div className="card pad" style={{ display: "grid", gap: "var(--s4)" }}>
                <h3 className="h3" style={{ fontSize: "1.05rem" }}>
                  Prefer to talk?
                </h3>
                <p className="muted" style={{ fontSize: "0.94rem" }}>
                  The Mumbai desk is open Monday to Saturday. WhatsApp is usually fastest.
                </p>
                <EnquiryButtons />
              </div>

              <div className="list">
                {[
                  { icon: "phone", label: "Phone", value: COMPANY.phone, href: `tel:${COMPANY.phone.replace(/\s/g, "")}` },
                  { icon: "mail", label: "Email", value: COMPANY.email, href: `mailto:${COMPANY.email}` },
                  { icon: "pin", label: "Office", value: COMPANY.address },
                ].map((c) => (
                  <div className="list-row" key={c.label}>
                    <span className="tile tile-sm">
                      <Icon name={c.icon} size={18} />
                    </span>
                    <span className="txt">
                      <span>{c.label}</span>
                      <b>{c.href ? <a href={c.href}>{c.value}</a> : c.value}</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Marketing material ---------- */}
      <section className="sec" id="marketing" style={{ paddingTop: 0, scrollMarginTop: 90 }}>
        <div className="wrap">
          <div className="sec-head">
            <h2>Marketing Material</h2>
            <div className="tabs" role="tablist" aria-label="Material type">
              {MAT_TABS.map((t) => (
                <button key={t} className="tab" role="tab" aria-selected={matTab === t} onClick={() => setMatTab(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mats">
            {MATERIALS.filter((m) => m.tab === matTab).map((m) => (
              <a className="mat" key={m.title} href="#marketing" onClick={(e) => e.preventDefault()}>
                <img src={m.img} alt="" loading="lazy" />
                <span className="mat-foot">
                  <span>
                    <b>{m.title}</b>
                    <span>{m.count}</span>
                  </span>
                  <span className="fab">
                    <Icon name="arrowsm" size={15} />
                  </span>
                </span>
              </a>
            ))}
          </div>
          <p className="note" style={{ marginTop: "var(--s4)" }}>
            Library counts are sample content for this demo build.
          </p>
        </div>
      </section>

      {/* ---------- Apply ---------- */}
      <section className="sec" id="apply" style={{ paddingTop: 0, scrollMarginTop: 90 }}>
        <div className="wrap">
          <div className="card pad">
            <h2 className="d2" style={{ fontSize: "clamp(1.4rem,2.4vw,1.9rem)" }}>
              Become a Shriji dealer
            </h2>
            <p className="sub" style={{ margin: "var(--s3) 0 var(--s5)" }}>
              Over a thousand retailers already stock this range. Tell us where you sell and we come back with the
              current price list and the scheme running in your territory.
            </p>
            <DealerForm />
          </div>
        </div>
      </section>
    </>
  );
}
