import { useLanguage } from "../data/i18n";
import UnderMaintenance from "../components/UnderMaintenance";

export default function Schemes() {
  const { t } = useLanguage();

  return (
    <>
      <section style={{ paddingTop: "var(--s6)" }}>
        <div className="wrap">
          <h1 className="d2">{t("schemes_title")}</h1>
          <p className="sub" style={{ marginTop: "var(--s2)" }}>
            {t("schemes_sub")}
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <UnderMaintenance
            title={t("schemes_maintenance_title")}
            description={t("schemes_maintenance_sub")}
            showContact={true}
            showBrowse={true}
          />
        </div>
      </section>
    </>
  );
}
