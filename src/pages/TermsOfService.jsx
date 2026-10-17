import { useEffect } from "react";
import { Link } from "react-router-dom";
import { COMPANY } from "../data/site";

export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p className="sub" style={{ fontSize: "0.95rem" }}>
          Last updated: October 2026 · Governing Restor (<a href="https://restor.in" target="_blank" rel="noreferrer">restor.in</a>) and Shriji Domestic Appliances portal services.
        </p>
      </div>

      <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: "var(--s5)", lineHeight: 1.7, fontSize: "0.96rem" }}>
        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>1. Agreement to Terms</h2>
          <p>
            By accessing or using the dealer webstore and authentication services provided by <strong>Restor</strong> (<a href="https://restor.in">restor.in</a>) and <strong>{COMPANY.legal}</strong>, you agree to be bound by these Terms of Service. If you do not agree, you must not access or use this service.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>2. Dealer Authentication & Access</h2>
          <p>
            Wholesale dealer rates and order facilities are gated to verified commercial partners. You agree that:
          </p>
          <ul style={{ paddingLeft: "var(--s4)", marginTop: "var(--s2)", display: "flex", flexDirection: "column", gap: "var(--s1)" }}>
            <li>You are responsible for maintaining the confidentiality of any OTP codes or authentication links received on your phone.</li>
            <li>All wholesale pricing disclosed on this platform is proprietary and confidential to verified dealers.</li>
            <li>You will not misrepresent your identity or store credentials during application or login.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>3. Electronic & WhatsApp Communications</h2>
          <p>
            By providing your mobile number to receive verification codes or order updates, you authorize Restor and Shriji Domestic Appliances to send automated transactional messages via WhatsApp Cloud API. You may opt out of non-essential communications by contacting our support team.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>4. Intellectual Property</h2>
          <p>
            All content, brand marks, logos, appliance designs, and catalog photography on this website are the intellectual property of Shriji Domestic Appliances or licensed brand partners. Unauthorized reproduction is strictly prohibited.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.25rem", color: "var(--c-text)", marginBottom: "var(--s2)" }}>5. Contact Information</h2>
          <p>For questions regarding these Terms, contact us at:</p>
          <div style={{ marginTop: "var(--s2)", paddingLeft: "var(--s3)", borderLeft: "3px solid var(--c-brand)" }}>
            <p><strong>Restor / {COMPANY.legal}</strong></p>
            <p>Email: <a href="mailto:restortoday@gmail.com">restortoday@gmail.com</a></p>
            <p>Phone: <a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a></p>
          </div>
        </section>
      </div>

      <div style={{ marginTop: "var(--s6)", display: "flex", gap: "var(--s4)" }}>
        <Link to="/" className="btn btn-navy">← Return to Home</Link>
        <Link to="/privacy" className="btn btn-ghost">View Privacy Policy</Link>
      </div>
    </div>
  );
}
