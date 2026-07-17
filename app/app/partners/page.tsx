import { SectionHeader } from "@/components/ds";

export default function PartnersPage() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px)", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Partners" />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 560 }}>
        Partner organizations BOW runs classes with. This surface ships in Phase B.
      </p>
    </div>
  );
}
