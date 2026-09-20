import { useState } from "react";
import { Link } from "react-router-dom";
import { inr, priceFor, shareLink } from "../data/dealer";
import { COMPANY } from "../data/site";
import { Icon } from "../ui";

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
  const { mrp, dealer: net, rebatePct } = priceFor(p, dealer);

  return (
    <div className="pricebox">
      <div className="pricebox-l">
        <span className="pricebox-lbl">Your Dealer Price</span>
        {open ? (
          <>
            <b className="pricebox-amt">{inr(net)}</b>
            <small>(Incl. of all taxes)</small>
          </>
        ) : (
          <>
            <b className="pricebox-amt pricebox-mask" aria-hidden="true">
              ₹ • • • •
            </b>
            <small>Hidden until you ask</small>
          </>
        )}
      </div>

      <div className="pricebox-r">
        <button className="btn btn-navy btn-block" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name={open ? "eyeoff" : "lock"} /> {open ? "Hide Dealer Price" : "View Dealer Price"}
        </button>
        <p className="note pricebox-note">
          {open ? (
            <>
              {rebatePct}% off {inr(mrp)} MRP · rate for <b>{dealer.name}</b> ({dealer.id}). Customers see only MRP.
            </>
          ) : (
            <>Visible to approved dealers only</>
          )}
        </p>
      </div>
    </div>
  );
}

function CustomerPrice({ p, sharedBy }) {
  const { mrp } = priceFor(p);
  const msg = encodeURIComponent(`Hello, I am interested in the ${p.name}.\n${shareLink(p, sharedBy)}`);

  return (
    <div className="custbox">
      <div className="custbox-price">
        <span className="pricebox-lbl">MRP</span>
        <b className="pricebox-amt">{inr(mrp)}</b>
        <small>(Incl. of all taxes)</small>
      </div>

      {sharedBy ? (
        <>
          <div className="availat">
            <span className="pricebox-lbl">Available with</span>
            <b>{sharedBy.name}</b>
            <small>{sharedBy.city}</small>
          </div>
          <a className="btn btn-amber btn-block" href={`tel:${sharedBy.phone.replace(/\s/g, "")}`}>
            <Icon name="phone" /> Contact Dealer
          </a>
          <a
            className="btn btn-wa btn-block"
            href={`https://wa.me/${sharedBy.phoneRaw}?text=${msg}`}
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
            <Icon name="lock" /> Dealer sign in
          </Link>
        </>
      )}

      <p className="note" style={{ textAlign: "center" }}>
        Customers see only MRP.
      </p>
    </div>
  );
}
