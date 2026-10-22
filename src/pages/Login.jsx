import { Link, useNavigate } from "react-router-dom";
import { useSession, switchToDealerSession, switchToViewerSession } from "../data/session";
import { isDealer } from "../data/dealer";
import { Icon } from "../ui";

// Authentication remains intentionally bypassed while the replacement flow is designed.
export default function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const dealerActive = isDealer(session);
  const customerActive = !dealerActive && session.role === "customer";
  const selectDealer = () => { switchToDealerSession(); navigate("/products"); };
  const selectCustomer = () => { switchToViewerSession(); navigate("/products"); };

  return (
    <section className="sec" style={{ paddingTop: "var(--s6)", minHeight: "80vh" }}>
      <div className="wrap" style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--s5)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(37, 99, 235, 0.08)", color: "var(--blue-700, #1d4ed8)", fontSize: "0.82rem", fontWeight: 700, marginBottom: 12, border: "1px solid rgba(37, 99, 235, 0.15)" }}>
            <Icon name="check" size={14} /> Direct Mode Active · Login Page Bypassed
          </div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 8px", color: "var(--tx-1)" }}>Select Workspace Account</h1>
          <p style={{ margin: 0, color: "var(--tx-2)", fontSize: "0.95rem" }}>Directly test the CRM-linked Dealer account or Customer Viewer.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
          <WorkspaceCard active={dealerActive} label="Primary Dealer Account" title="ownershop" details={["Dealer Code: DE-BKV-8180", "Zoho CRM Link: #928463000001716004 (Approved)", "Pricebook: MH Dist Basic Oct 2026", "GSTIN: 27AJHPJ2192C1ZF"]} benefits={["Live wholesale dealer rates", "Dealer margin & profit calculator", "Exclusive Sunshine schemes", "Customer-safe sharing"]} buttonLabel={dealerActive ? "Continue as Dealer (Products)" : "Switch to Dealer"} icon="stove" onClick={() => dealerActive ? navigate("/products") : selectDealer()} />
          <WorkspaceCard active={customerActive} label="Linked Customer View" title="Customer / Viewer" details={["Role: Retail End-User", "Pricing: Standard MRP Only", "Trade Leakage: Wholesale Rates Masked", "Inquiry Contact: ownershop"]} benefits={["Retail catalog view for customer UI testing", "Customer-safe product links", "Zero-price items report ‘Price on Request’", "Simulates a shared dealer link"]} buttonLabel={customerActive ? "Continue as Customer (Products)" : "Switch to Customer View"} icon="grid" secondary onClick={() => customerActive ? navigate("/products") : selectCustomer()} />
        </div>
        <nav aria-label="Quick navigation" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, padding: "16px 20px", background: "var(--card-2, #f8fafc)", borderRadius: "var(--r-md, 10px)", border: "1px solid var(--line, #e2e8f0)" }}>
          <Link to="/products" className="btn btn-sm btn-navy"><Icon name="grid" size={14} /> Catalog</Link>
          <Link to="/schemes" className="btn btn-sm btn-ghost"><Icon name="badge" size={14} /> Schemes</Link>
          <Link to="/dealer" className="btn btn-sm btn-ghost"><Icon name="user" size={14} /> Team Dashboard</Link>
          <Link to="/" className="btn btn-sm btn-ghost"><Icon name="home" size={14} /> Home Page</Link>
        </nav>
      </div>
    </section>
  );
}

function WorkspaceCard({ active, label, title, details, benefits, buttonLabel, icon, secondary, onClick }) {
  return (
    <article style={{ background: "var(--card, #fff)", border: active ? "2px solid var(--blue-600, #2563eb)" : "1.5px solid var(--line, #e2e8f0)", borderRadius: "var(--r-lg, 14px)", padding: 22, boxShadow: active ? "0 4px 20px -2px rgba(37, 99, 235, 0.15)" : "var(--sh-sm)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div><span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: secondary ? "var(--tx-3, #64748b)" : "var(--blue-600, #2563eb)" }}>{label}</span><h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "2px 0 0" }}>{title}</h2></div>
          <span className={active ? "badge badge-ok" : "badge"} style={{ fontSize: "0.75rem", ...(active ? {} : { background: "var(--card-2)" }) }}>{active ? "Active Now" : secondary ? "Customer" : "Dealer"}</span>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--tx-2)", display: "grid", gap: 6, marginBottom: 16 }}>{details.map((detail) => <div key={detail}>{detail}</div>)}</div>
        <ul style={{ fontSize: "0.82rem", color: "var(--tx-2)", paddingLeft: 18, margin: "0 0 16px", display: "grid", gap: 4 }}>{benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
      </div>
      <button className={`btn btn-block ${secondary && !active ? "btn-ghost" : "btn-navy"}`} onClick={onClick} style={{ justifyContent: "center" }}><Icon name={icon} size={16} /> {buttonLabel}</button>
    </article>
  );
}
