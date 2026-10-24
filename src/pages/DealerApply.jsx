import BrandApplyFlow from "../components/BrandApplyFlow";

export default function DealerApply() {
  return (
    <section className="sec" style={{ paddingTop: "clamp(var(--s4), 4vw, var(--s6))", minHeight: "85vh" }}>
      <div className="wrap" style={{ minWidth: 0, overflowX: "clip" }}>
        <BrandApplyFlow />
      </div>
    </section>
  );
}
