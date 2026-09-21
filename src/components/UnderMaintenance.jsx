import { Link } from "react-router-dom";
import { Icon, EnquiryButtons } from "../ui";
import { useLanguage } from "../data/i18n";

export default function UnderMaintenance({
  badge,
  title,
  description,
  showContact = true,
  showBrowse = true,
  compact = false,
}) {
  const { t } = useLanguage();

  return (
    <div
      className="card pad"
      style={{
        textAlign: "center",
        padding: compact ? "var(--s5) var(--s4)" : "var(--s8) var(--s4)",
        maxWidth: compact ? "100%" : 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--s3)",
        border: "1px dashed var(--blue-300, #93c5fd)",
        background: "linear-gradient(180deg, var(--card) 0%, var(--bg-2) 100%)",
        boxShadow: "var(--sh)",
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "var(--amber-50, #fffbeb)",
          color: "var(--amber-600, #d97706)",
          border: "1px solid var(--amber-200, #fde68a)",
          display: "grid",
          placeItems: "center",
          marginBottom: "var(--s2)",
        }}
      >
        <Icon name="bolt" size={26} />
      </div>

      <span className="badge badge-warn" style={{ fontSize: "0.82rem", padding: "4px 12px" }}>
        {badge || t("under_maintenance_badge")}
      </span>

      <h2 className="h2" style={{ fontSize: compact ? "1.25rem" : "clamp(1.35rem, 2.2vw, 1.75rem)", margin: "4px 0" }}>
        {title}
      </h2>

      <p className="muted" style={{ maxWidth: 540, lineHeight: 1.65, fontSize: "0.94rem", margin: 0 }}>
        {description}
      </p>

      {showContact && (
        <div style={{ marginTop: "var(--s4)" }}>
          <EnquiryButtons />
        </div>
      )}

      {showBrowse && (
        <div style={{ marginTop: "var(--s2)" }}>
          <Link to="/products" className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
            <Icon name="stove" size={15} /> {t("nav_products")}
          </Link>
        </div>
      )}
    </div>
  );
}
