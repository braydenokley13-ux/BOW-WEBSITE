import { Button, CapLine } from "@/components/ds";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <section
      className="bow-front-office"
      style={{
        background: "var(--bow-ink)",
        color: "#fff",
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        padding: "clamp(48px,8vw,120px) clamp(18px,4vw,40px)",
      }}
    >
      <div className="bow-container" style={{ width: "100%" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Off the Board
        </span>
        <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(56px,12vw,160px)", lineHeight: 0.84, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          404
        </h1>
        <CapLine weight={7} step={18} stepAt={0.4} style={{ maxWidth: 320, margin: "20px 0" }} />
        <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 520 }}>
          That page isn&apos;t on the depth chart. Head back to the front office and pick your next move.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Button href="/" variant="primary" size="lg">Back to Home</Button>
          <Button href="/programs" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>
            Explore Programs
          </Button>
        </div>
      </div>
    </section>
  );
}
