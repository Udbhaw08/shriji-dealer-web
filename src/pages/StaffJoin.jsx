import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../data/session";
import StaffJoinFlow from "../components/StaffJoinFlow";
import { Icon } from "../ui";

export default function StaffJoin() {
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isApproved = session && session.role === "dealer" && session.status === "approved";
  const isPending = session && (session.status === "pending" || session.dealer?.status === "pending");

  useEffect(() => {
    if (isApproved) {
      navigate("/products", { replace: true });
    } else if (isPending) {
      navigate("/dealer/pending?kind=staff", { replace: true });
    }
  }, [isApproved, isPending, navigate]);

  const initialCode = searchParams.get("code") || searchParams.get("dealer") || "";

  return (
    <div
      className="staff-join-page"
      style={{
        maxWidth: 540,
        margin: "0 auto",
        padding: "clamp(16px, 4vw, 32px) 16px 64px",
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        boxSizing: "border-box",
        overflowX: "clip",
      }}
    >
      {/* Header Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link
          to="/login?role=staff"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: ".88rem",
            color: "var(--tx-muted, #64748b)",
            textDecoration: "none",
            fontWeight: 600,
            padding: "6px 0",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>←</span> Back to Staff Sign In
        </Link>
      </div>

      <div
        style={{
          background: "var(--bg-card, #ffffff)",
          border: "1.5px solid var(--border, #e2e8f0)",
          borderRadius: "var(--r-xl, 20px)",
          padding: "clamp(20px, 3.5vw, 32px)",
          boxShadow: "0 10px 30px -10px rgba(16, 38, 58, 0.1)",
        }}
      >
        {/* Title & Badge */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "16px",
              background: "#e0e7ff",
              color: "#3730a3",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Icon name="user" size={26} />
          </div>
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 800,
              margin: "0 0 6px",
              color: "var(--tx-1, #0f172a)",
              letterSpacing: "-0.02em",
            }}
          >
            Join Store as Staff
          </h1>
          <p
            style={{
              fontSize: ".88rem",
              color: "var(--tx-2, #64748b)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Connect to your authorized dealership to access wholesale pricing, customer share links, and digital catalog.
          </p>
        </div>

        {/* Staff Join Flow Component */}
        <StaffJoinFlow
          initialCode={initialCode}
          onSwitchToLogin={() => navigate("/login?role=staff")}
          onSuccess={() => navigate("/dealer/pending?kind=staff", { replace: true })}
        />
      </div>
    </div>
  );
}
