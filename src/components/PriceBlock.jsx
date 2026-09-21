import { useState } from "react";
import { Link } from "react-router-dom";
import { inr, priceFor, shareLink } from "../data/dealer";
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
export default function PriceBlock({ p, customerView, dealer, sharedBy }) {
  if (customerView) return <CustomerPrice p={p} sharedBy={sharedBy} />;
  return <DealerPrice p={p} dealer={dealer} />;
}

function DealerPrice({ p, dealer }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { dealer: net, mrp, rebatePct, isPriceOnRequest } = priceFor(p, dealer);

  if (isPriceOnRequest || (mrp <= 0 && net <= 0)) {
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

  return (
    <div className={`pricebox ${open ? "pricebox-revealed" : ""}`}>
      <div className="pricebox-l">
        {open ? (
          <>
            <span className="pricebox-lbl">{t("price_dealer_label")}</span>
            <b className="pricebox-amt pricebox-dealer-amt">{inr(net)}</b>
            <small>
              {t("price_incl_taxes")}
              {mrp > 0 && ` · Retail MRP: ${inr(mrp)}`}
            </small>
          </>
        ) : (
          <>
            <span className="pricebox-lbl">{t("price_mrp_label")}</span>
            <b className="pricebox-amt">{inr(mrp)}</b>
            <small>{t("price_incl_taxes")}</small>
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
          {open ? "Visible to approved dealers only" : "Click to view your wholesale dealer price"}
        </p>
      </div>
    </div>
  );
}

function CustomerPrice({ p, sharedBy }) {
  const { t } = useLanguage();
  const { mrp, isPriceOnRequest } = priceFor(p);
  const msg = encodeURIComponent(`Hello, I am interested in the ${p.name}.\n${shareLink(p, sharedBy)}`);

  return (
    <div className="custbox">
      <div className="custbox-price">
        <span className="pricebox-lbl">{isPriceOnRequest || mrp <= 0 ? t("price_on_request") : t("price_mrp_label")}</span>
        <b className="pricebox-amt">{isPriceOnRequest || mrp <= 0 ? t("price_on_request") : inr(mrp)}</b>
        <small>{isPriceOnRequest || mrp <= 0 ? t("price_on_request_sub") : t("price_incl_taxes")}</small>
      </div>

      {sharedBy ? (
        <>
          <div className="availat">
            <span className="pricebox-lbl">Available with</span>
            <b>{sharedBy.name}</b>
            <small>{sharedBy.city}</small>
          </div>
          <a className="btn btn-amber btn-block" href={`tel:${(sharedBy.phone || "").replace(/\s/g, "")}`}>
            <Icon name="phone" /> Contact Dealer
          </a>
          <a
            className="btn btn-wa btn-block"
            href={`https://wa.me/${sharedBy.phoneRaw || (sharedBy.phone || "").replace(/\D/g, "")}?text=${msg}`}
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
