import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { inr, priceFor, shareLink, formatWhatsAppPhone } from "../data/dealer";
import { COMPANY } from "../data/site";
import { Icon } from "../ui";
import { useLanguage } from "../data/i18n";

/* The whole dealer/customer split lives here.
 *
 * Dealer view  — MRP is always shown prominently by default; wholesale dealer rate
 *                is masked behind a strict click-to-view toggle.
 *                Whenever navigating away or back, the toggle always starts OFF.
 * Customer view — MRP only, no dealer price, no way to ask for one, plus the
 *                dealer the link came from.
 *
 * `customerView` is decided by the caller and is TRUE whenever the URL carries a
 * ?from= share token, whoever is signed in. A shared link must never leak a
 * dealer price, not even back to the dealer who sent it. */
export default function PriceBlock({ p, customerView, dealer, sharedBy, canSeeDealerPrice = true, loadingPrice = false }) {
  if (customerView) return <CustomerPrice p={p} sharedBy={sharedBy} />;
  return <DealerPrice p={p} dealer={dealer} canSeeDealerPrice={canSeeDealerPrice} loadingPrice={loadingPrice} />;
}

function DealerPrice({ p, dealer, canSeeDealerPrice = true, loadingPrice = false }) {
  // CRITICAL: open defaults to FALSE. MRP is visible; Dealer Price only revealed on explicit click.
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  // Reset toggle to closed whenever product id changes (ensures no state leaks across navigation)
  useEffect(() => {
    setOpen(false);
  }, [p?.id]);

  const effectiveDealer = canSeeDealerPrice ? dealer : null;
  const { dealer: trade, mrp } = priceFor(p, effectiveDealer);

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

  // Normal dealer state:
  // When closed (DEFAULT): ALWAYS show Retail MRP prominently with "View Dealer Price" action.
  // Never flash "Wholesale Rate on Request" on initial load.
  // When opened: Reveal dealer wholesale price if loaded, or show subtle fetching spinner if in flight.
  return (
    <div className={`pricebox ${open ? "pricebox-revealed" : ""}`}>
      <div className="pricebox-l">
        {open ? (
          loadingPrice ? (
            <>
              <span className="pricebox-lbl">{t("price_dealer_label")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
                <Icon name="refresh" size={18} style={{ animation: "spin 1s linear infinite", color: "var(--navy-600, #2563eb)" }} />
                <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--tx-2, #64748b)" }}>Loading Dealer Rate…</span>
              </div>
              <small>Retail MRP: {inr(mrp)}</small>
            </>
          ) : trade > 0 ? (
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
              <small>{t("price_on_request_sub")}</small>
            </>
          )
        ) : (
          <>
            <span className="pricebox-lbl">{t("price_mrp_label")}</span>
            <b className="pricebox-amt">{inr(mrp)}</b>
          </>
        )}
      </div>

      <div className="pricebox-r">
        {open && !loadingPrice && trade <= 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 7, padding: "8px 12px",
              background: "var(--navy-50, #f8fafc)", border: "1px solid #cbd5e1",
              borderRadius: "var(--r-sm, 8px)", fontSize: "0.82rem", color: "#334155", fontWeight: 700
            }}>
              <Icon name="phone" size={15} style={{ color: "#2563eb", flexShrink: 0 }} />
              <span>Wholesale Rate on Request</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              aria-expanded={true}
              onClick={() => setOpen(false)}
            >
              <Icon name="eyeoff" /> {t("price_dealer_hide")}
            </button>
            <p className="note pricebox-note">
              Contact your Sunshine distributor for custom trade contract pricing on this model.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`btn ${open ? "btn-ghost" : "btn-navy"} btn-block`}
              aria-expanded={open}
              disabled={open && loadingPrice}
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name={open ? "eyeoff" : "lock"} /> {open ? t("price_dealer_hide") : t("price_dealer_view")}
            </button>
            <p className="note pricebox-note">
              {open ? "Visible to approved dealers only" : t("price_hidden_sub")}
            </p>
          </>
        )}
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
