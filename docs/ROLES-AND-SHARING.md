# ROLES-AND-SHARING.md — who sees which price

Added 2026-09-20. This is the security-shaped part of the app. Read it before changing anything in
`src/data/session.js`, `src/data/dealer.js` or `src/components/PriceBlock.jsx`.

**Mockup reference:** `web ref.jpeg` panel 4 · `mobile ref.jpeg` panel 5 (Product Detail, customer
view).

---

## 1. The four viewers

| Viewer | How they get there | Sees | Primary action |
|---|---|---|---|
| **Guest** | Not signed in | MRP | Contact Us · Dealer sign in |
| **Customer** | Signed in as a customer | MRP | Contact Us |
| **Dealer, pending** | Applied, not yet approved | MRP — same as a customer | Check application |
| **Dealer, approved** | Approved by a Shriji admin | Dealer price, behind a toggle | Share with Customer |
| **Anyone on a shared link** | Opened `?from=<dealerId>` | MRP + the dealer who shared | Contact Dealer · Share on WhatsApp |

The last row **overrides every row above it**. That is the whole point.

## 2. The rule, in one function

`viewerFor(session, fromId)` in `src/data/dealer.js`:

```js
export function viewerFor(session, fromId) {
  const sharedBy = dealerById(fromId);
  const me = isDealer(session) ? dealerById(session.dealerId) : null;
  return { sharedBy, me, customerView: Boolean(sharedBy) || !me };
}
```

Three properties worth stating explicitly, because each one is a bug someone will otherwise
reintroduce:

1. **A `?from=` link forces the customer view for everyone — including the dealer who sent it.**
   Not "unless the viewer is a dealer". A dealer might hand their phone to a customer, or forward
   a link from a session that stays signed in. If the sender wants their own price back they
   remove the parameter, and the page offers a "Back to dealer view" button to do exactly that.
2. **`isDealer` requires `status === "approved"`.** A pending applicant is a customer as far as
   pricing is concerned. There is no in-between state that shows a partial price.
3. **An unknown dealer id degrades to the plain customer view**, it does not throw and does not
   fall back to the dealer view.

`viewerFor`, `isDealer` and `tierOf` live in `dealer.js`, not `session.js`, purely so they carry no
React import and can be asserted in `node src/data/dealer.test.mjs`. `session.js` re-exports them.

## 3. ⚠️ What this is not

**This is demo authentication.** The role lives in `localStorage` and the share token is a plain
query parameter. Anyone can edit either one in a browser.

That is acceptable **only** because every price in the build is also fake. The moment real Zoho
pricing arrives, the rule has to move to the server, and the client check becomes a UI convenience
on top of it:

- The API returns a dealer price **only** for a request carrying an approved dealer's authenticated
  session, and only that dealer's own price. The client never asks for "the price for account X".
- The customer endpoint returns MRP and nothing else. It is a different response shape, not the
  same payload with a field the UI declines to render. **If the dealer price is in the JSON, it has
  leaked** — devtools is one keypress away.
- The share token should become opaque and server-resolved (a short id mapping to dealer + product)
  rather than a readable dealer code in the URL.

Keeping the two prices in separate responses is the single most important thing to get right during
the Zoho integration. See [ZOHO-INTEGRATION.md](ZOHO-INTEGRATION.md) § 4.

## 4. The share link

Built by `shareLink(product, dealer)` in `src/data/dealer.js`:

```
https://<host>/products/<productId>?from=<dealerId>
```

The dealer's **Share with Customer** button uses the Web Share API where available (so it lands
straight in WhatsApp on a phone) and falls back to copying the link, with the button label flipping
to "Link copied" for a couple of seconds.

The shared text deliberately carries **no price**. A shared link must never contain one, in the URL
or in the preview text.

## 5. What the customer sees — `CustomerPrice` in `PriceBlock.jsx`

Matching web mockup panel 4 and mobile panel 5:

```
MRP
₹8,999
(Incl. of all taxes)
─────────────────────
Available with
Rajesh Appliances
Borivali East, Mumbai

[ Contact Dealer ]        amber, calls the dealer directly
[ Share on WhatsApp ]     green outline, opens a chat with the product link
Customers see only MRP.
```

With **no** `from` token (someone found the page on their own) the same block reads "Available at
Shriji Domestic Appliances Pvt. Ltd.", offers Contact Us, and adds a quiet **Dealer sign in** link.

There is no "View Dealer Price" control in this view at all — not disabled, not hidden behind a
login prompt. It is not rendered.

## 6. The login flow

`/login`, `src/pages/Login.jsx`. One page, four states driven by the session:

1. **Guest** — dealer sign-in (pick a demo account), "continue as customer", and the dealer
   application form.
2. **Pending** — "Application under review", explains that a Shriji admin approves the contact in
   Zoho and that pricing unlocks automatically. Customer pricing applies meanwhile.
   Carries a clearly-labelled **Simulate admin approval** button so the flow can be demonstrated;
   delete it when real approval exists.
3. **Approved dealer** — account card with dealer id, phone and rebate, plus sign out.
4. **Customer** — account card, plus the dealer application form.

The header's control reflects the same state: "Dealer Login" → "Approval pending" → an account chip
with the shop name and tier.

**Approval is not something this app does.** An admin marks the contact as a dealer in Zoho and
attaches a price list; the app only reflects that. When the backend lands, state 2 stops being a
local flag and becomes a real status read from Zoho.

## 7. Also gated

`/schemes` § Dealer Price Lists is dealer-only — non-dealers get a locked card pointing at
`/login`, worded differently for a pending applicant. Scheme cards themselves stay public; they are
marketing.

To gate anything else, the same two lines:

```jsx
const session = useSession();
if (!isDealer(session)) return <SomethingElse />;
```

## 8. Checks

`node src/data/dealer.test.mjs` asserts, alongside the pricing invariants:

- a pending application does not unlock pricing
- guests and customers pay MRP exactly — no accidental rebate
- MRP does not vary by dealer, but the dealer price does
- a `?from=` link yields `customerView: true` for a guest, a customer, a pending applicant, the
  sending dealer, and a different dealer
- an unknown dealer id yields `sharedBy: null` rather than throwing

Run it after touching any of this.
