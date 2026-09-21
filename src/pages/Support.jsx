import { useState } from "react";
import { COMPANY } from "../data/site";
import { Icon, EnquiryButtons } from "../ui";
import { useLanguage } from "../data/i18n";
import UnderMaintenance from "../components/UnderMaintenance";

function DealerForm() {
  const { t } = useLanguage();
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
            {t("dealer_enquiry_noted")}, {v.person.split(" ")[0]}
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
        <DealerField id="shop" label={t("shop_name_label")} ph="Shah Electronics" value={v.shop} onChange={set("shop")} error={errors.shop} />
        <DealerField id="person" label={t("contact_person_label")} ph="Kunal Shah" value={v.person} onChange={set("person")} error={errors.person} />
        <DealerField id="phone" label={t("phone_label")} ph="+91 98200 00000" type="tel" value={v.phone} onChange={set("phone")} error={errors.phone} />
        <DealerField id="city" label={t("city_label")} ph="Mumbai" value={v.city} onChange={set("city")} error={errors.city} />
      </div>
      <div className="row">
        <button className="btn btn-navy" type="submit">
          {t("dealer_enquiry_send")} <Icon name="arrowsm" />
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

export default function Support() {
  const { t } = useLanguage();

  return (
    <>
      {/* ---------- Service Support ---------- */}
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <h1 className="d2">{t("support_title")}</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {t("support_sub")}
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "var(--s5)", alignItems: "start" }}>
            <div>
              <UnderMaintenance
                title={t("service_maintenance_title")}
                description={t("service_maintenance_sub")}
                showContact={false}
                showBrowse={false}
                compact={true}
              />
            </div>

            <div className="stack" style={{ gap: "var(--s5)" }}>
              <div className="card pad" style={{ display: "grid", gap: "var(--s4)" }}>
                <h3 className="h3" style={{ fontSize: "1.05rem" }}>
                  {t("support_prefer_to_talk")}
                </h3>
                <p className="muted" style={{ fontSize: "0.94rem" }}>
                  {t("support_talk_sub")}
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
            <h2>{t("mat_title")}</h2>
          </div>

          <UnderMaintenance
            title={t("mat_maintenance_title")}
            description={t("mat_maintenance_sub")}
            showContact={true}
            showBrowse={false}
          />
        </div>
      </section>

      {/* ---------- Apply ---------- */}
      <section className="sec" id="apply" style={{ paddingTop: 0, scrollMarginTop: 90 }}>
        <div className="wrap">
          <div className="card pad">
            <h2 className="d2" style={{ fontSize: "clamp(1.4rem,2.4vw,1.9rem)" }}>
              {t("dealer_enquiry_title")}
            </h2>
            <p className="sub" style={{ margin: "var(--s3) 0 var(--s5)" }}>
              {t("dealer_enquiry_sub")}
            </p>
            <DealerForm />
          </div>
        </div>
      </section>
    </>
  );
}
