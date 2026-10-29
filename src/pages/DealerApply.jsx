import BrandApplyFlow from "../components/BrandApplyFlow";

export default function DealerApply() {
  return (
    <section className="sec" style={{ paddingTop: "clamp(var(--s3), 3vw, var(--s6))", minHeight: "85vh", overflowX: "clip" }}>
      <div className="wrap" style={{ minWidth: 0, maxWidth: 580, paddingInline: "clamp(12px, 3.5vw, 20px)", overflowX: "clip" }}>
        <BrandApplyFlow />
      </div>
    </section>
  );
}
