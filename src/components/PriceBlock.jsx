import { useState } from "react";
import { Link } from "react-router-dom";
import { inr, priceFor, shareLink, formatWhatsAppPhone } from "../data/dealer";
import { COMPANY } from "../data/site";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";

/* The whole dealer/customer split lives here.
 *
 * Dealer view  — MRP never rendered except as the basis of the rebate; price is
 *                behind a toggle so it can be cleared off the screen fast.
 * Customer view — MRP only, no dealer price, no way to ask for one, plus the
 *                dealer the link came from.
 *
 * `customerView` is decided by the caller and is TRUE whenever the URL carries a
 * ?from= share token, whoever is signed in. A shared link must never leak a
 * dealer price, not even back to the dealer who sent it. */
export default function PriceBlock({ p, customerView, dealer, sharedBy, canSeeDealerPrice = true }) {
  if (customerView) return <CustomerPrice p={p} sharedBy={sharedBy} />;
  return <DealerPrice p={p} dealer={dealer} canSeeDealerPrice={canSeeDealerPrice} />;
}

function DealerPrice({ p, dealer, canSeeDealerPrice = true }) {
  const [open, setOpen] = useState(true);
  const { t } = useLanguage();
  const effectiveDealer = canSeeDealerPrice ? dealer : null;
  const { dealer: trade, mrp, isPriceOnRequest } = priceFor(p, effectiveDealer);

  // If entire item is unpriced in catalog (both MRP and trade are zero/missing)
  if (mrp <= 0 && trade <= 0) {
    return (
      <div className="pricebox">
        <div className="pricebox-l">
          <span className="pricebox-lbl">{t("price_mrp_label")}</span>
          <b className="pricebox-amt">{t("price_on_request")}</b>
          <small>{t("price_on_request_sub")}</small>
        </div>
        <div className="pricebox-r">
          <p className="note pricebox-note">{t("price_unpriced_catalog")}</p>
        </div>
      </div>
    );
  }

  // If retail MRP is known, but wholesale trade price is on request
  if (trade <= 0 && mrp > 0) {
    return (
      <div className="pricebox">
        <div className="pricebox-l">
          <span className="pricebox-lbl">{t("price_mrp_label")}</span>
          <b className="pricebox-amt">{inr(mrp)}</b>
        </div>
        <div className="pricebox-r">
          <div style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 12px",
            background: "var(--navy-50, #f8fafc)", border: "1px solid #cbd5e1",
            borderRadius: "var(--r-sm, 8px)", fontSize: "0.82rem", color: "#334155", fontWeight: 700
          }}>
            <Icon name="phone" size={15} style={{ color: "#2563eb", flexShrink: 0 }} />
            <span>Wholesale Rate on Request</span>
          </div>
          <p className="note pricebox-note">
            Contact your Sunshine distributor for custom trade contract pricing on this model.
          </p>
        </div>
      </div>
    );
  }

  // If dealer wholesale price is hidden from this staff member by the dealer owner
  if (!canSeeDealerPrice) {
    return (
      <div className="pricebox">
        <div className="pricebox-l">
          <span className="pricebox-lbl">{t("price_mrp_label")}</span>
          <b className="pricebox-amt">{inr(mrp)}</b>
        </div>
        <div className="pricebox-r">
          <div style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 12px",
            background: "var(--amber-50, #fffbeb)", border: "1px solid #fde68a",
            borderRadius: "var(--r-sm, 8px)", fontSize: "0.82rem", color: "#92400e", fontWeight: 700
          }}>
            <Icon name="lock" size={15} style={{ color: "#d97706", flexShrink: 0 }} />
            <span>Wholesale Price Hidden</span>
          </div>
          <p className="note pricebox-note">
            Your store owner has hidden trade pricing for staff. Showing retail MRP for customer assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`pricebox ${open ? "pricebox-revealed" : ""}`}>
      <div className="pricebox-l">
        {open ? (
          <>
            <span className="pricebox-lbl">{t("price_dealer_label")}</span>
            <b className="pricebox-amt pricebox-dealer-amt">{inr(trade)}</b>
            <small>
              Retail MRP: {inr(mrp)}
            </small>
          </>
        ) : (
          <>
            <span className="pricebox-lbl">{t("price_mrp_label")}</span>
            <b className="pricebox-amt">{inr(mrp)}</b>
          </>
        )}
      </div>

      <div className="pricebox-r">
        <button
          type="button"
          className={`btn ${open ? "btn-ghost" : "btn-navy"} btn-block`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? "eyeoff" : "lock"} /> {open ? t("price_dealer_hide") : t("price_dealer_view")}
        </button>
        <p className="note pricebox-note">
          {open ? "Visible to approved dealers only" : "Click to view your wholesale dealer rate"}
        </p>
      </div>
    </div>
  );
}

function CustomerPrice({ p, sharedBy }) {
  const { t } = useLanguage();
  const { mrp, isPriceOnRequest } = priceFor(p);
  const dealerPhone = sharedBy?.phone || "";
  const dealerPhoneRaw = sharedBy?.phoneRaw || formatWhatsAppPhone(dealerPhone);
  const dealerName = sharedBy?.name || "Authorised Dealer";
  const telHref = dealerPhone ? `tel:${dealerPhone.replace(/[^0-9+]/g, "")}` : `tel:${COMPANY.phone.replace(/[^0-9+]/g, "")}`;
  const waNumber = dealerPhoneRaw || COMPANY.phoneRaw;

  const msg = encodeURIComponent(`Hello ${dealerName}, I am interested in the ${p.name} from Sunshine.\n\n${shareLink(p, sharedBy)}`);

  const dealerLocation = [sharedBy?.city, sharedBy?.state].filter(Boolean).join(", ");

  return (
    <div className="custbox">
      <div className="custbox-price">
        <span className="pricebox-lbl">{isPriceOnRequest || mrp <= 0 ? t("price_on_request") : t("price_mrp_label")}</span>
        <b className="pricebox-amt">{isPriceOnRequest || mrp <= 0 ? t("price_on_request") : inr(mrp)}</b>
        {(isPriceOnRequest || mrp <= 0) && <small>{t("price_on_request_sub")}</small>}
      </div>

      {sharedBy ? (
        <>
          <div className="availat">
            <span className="pricebox-lbl">Available with</span>
            <b>{sharedBy.name}</b>
            <small>{[sharedBy.person, dealerLocation, sharedBy.phone].filter(Boolean).join(" · ")}</small>
          </div>
          <a className="btn btn-amber btn-block" href={telHref}>
            <Icon name="phone" /> Contact Dealer
          </a>
          <a
            className="btn btn-wa btn-block"
            href={`https://wa.me/${waNumber}?text=${msg}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="wa" /> Share on WhatsApp
          </a>
        </>
      ) : (
        <>
          <div className="availat">
            <span className="pricebox-lbl">Available at</span>
            <b>{COMPANY.legal}</b>
            <small>Ask us for your nearest authorised dealer</small>
          </div>
          <a className="btn btn-amber btn-block" href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>
            <Icon name="phone" /> Contact Us
          </a>
          <Link className="btn btn-ghost btn-block" to="/login">
            <Icon name="lock" /> {t("dealer_login")}
          </Link>
        </>
      )}
    </div>
  );
}
