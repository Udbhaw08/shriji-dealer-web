import { useEffect } from "react";
import { Link } from "react-router-dom";
import { COMPANY } from "../data/site";

export default function LegalPrivacy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="wrap" style={{ padding: "var(--s6) var(--s4) var(--s8)", maxWidth: "860px" }}>
      <div style={{ marginBottom: "var(--s6)" }}>
        <p style={{ color: "var(--c-brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.85rem", marginBottom: "var(--s2)" }}>
          Legal & Compliance
        </p>
        <h1 className="d2" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.4rem)", marginBottom: "var(--s2)" }}>
          Privacy Policy
        </h1>
        <p className="sub" style={{ fontSize: "0.95rem" }}>
          Last updated: October 2026 · Applicable to Restor (<a href="https://restor.in" target="_blank" rel="noreferrer">restor.in</a>) and Shriji Domestic Appliances.
        </p>
      </div>

      <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: "var(--s5)", lineHeight: 1.7, fontSize: "0.96rem" }}>
        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>1. Introduction</h2>
          <p>
            Welcome to <strong>Restor</strong> (<a href="https://restor.in">restor.in</a>), operated in conjunction with <strong>{COMPANY.legal}</strong> ("we", "us", "our"). We are committed to protecting your personal information and your right to privacy. This policy outlines how we collect, use, process, and safeguard your data when you visit our webstore, apply for dealerships, or use our digital services.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>2. Information We Collect</h2>
          <p>We only collect information necessary to facilitate dealer onboarding, authentication, and order fulfillment:</p>
          <ul style={{ paddingLeft: "var(--s4)", marginTop: "var(--s2)", display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
            <li><strong>Phone Number:</strong> Collected for One-Time Password (OTP) verification and critical transactional account alerts.</li>
            <li><strong>Identity & Store Details:</strong> Business name, contact person, shop address, GSTIN (for dealer verification), and email address.</li>
            <li><strong>Technical Identifiers:</strong> Browser type, device details, and session tokens to ensure authorized access to dealer pricing.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>3. Communications</h2>
          <p>
            We may use email and customer-requested support channels for account and service communications:
          </p>
          <ul style={{ paddingLeft: "var(--s4)", marginTop: "var(--s2)", display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
            <li>We do <strong>not</strong> send spam, unsolicited promotional messages, or share your phone number with external marketing aggregators.</li>
            <li>Email verification codes are sent only when you request email verification.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>4. How We Use and Share Your Data</h2>
          <p>
            Your information is used solely for dealer verification, pricing authorization, catalog access, and order processing. We do not sell or rent your personal data to any third parties. Data is shared exclusively with:
          </p>
          <ul style={{ paddingLeft: "var(--s4)", marginTop: "var(--s2)", display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
            <li><strong>Resend:</strong> For transactional email delivery.</li>
            <li><strong>Zoho Corporation:</strong> For authorized catalog synchronization and verified dealer pricebooks.</li>
            <li><strong>Fast2SMS:</strong> For transactional OTP delivery if SMS is requested.</li>
            <li><strong>Meta Cloud API:</strong> For verified dealer WhatsApp alerts where opted in.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>5. Data Retention & Deletion</h2>
          <p>
            We retain account data for as long as your dealership relationship remains active. You may request account closure and deletion of your stored records at any time by emailing us at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>6. Security</h2>
          <p>
            We maintain strict cryptographic security protocols, including TLS in transit, database row-level encryption, and zero storage of raw passwords.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>7. Contact Us</h2>
          <p>
            If you have questions or concerns regarding this Privacy Policy, please contact our Compliance Officer at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or call {COMPANY.phone}.
          </p>
        </section>

        <div style={{ borderTop: "1px solid var(--c-line)", paddingTop: "var(--s4)", display: "flex", gap: "var(--s4)" }}>
          <Link to="/terms" style={{ color: "var(--c-brand)", fontWeight: 600 }}>Terms of Service</Link>
          <Link to="/" style={{ color: "var(--c-text-2)" }}>Back to Store</Link>
        </div>
      </div>
    </div>
  );
}
