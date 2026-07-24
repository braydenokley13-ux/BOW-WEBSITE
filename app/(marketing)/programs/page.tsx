import Link from "next/link";
import { Button, SectionHeader } from "@/components/ds";
import PublicProgramCard from "@/components/site/PublicProgramCard";
import { listPublicPrograms } from "@/lib/operations";

export const metadata = {
  title: "Programs",
  description: "Real, upcoming BOW Sports Capital programs students can join today — plus the curriculum behind them.",
};

const CURRICULUM_OVERVIEW = [
  { num: "101", title: "Track 101", grades: "Grades 5–6", body: "How a sports business works — money, talent, and the cost of every choice.", href: "/programs/track-101", tone: "var(--bow-blue)" },
  { num: "201", title: "Track 201", grades: "Grades 7–8", body: "Run the front office: cap management, analytics, ownership, and the draft.", href: "/programs/track-201", tone: "var(--bow-orange)" },
  { num: "301", title: "Track 301", grades: "In Development", body: "Contract negotiation, franchise valuation, and ownership strategy — the advanced track BOW is building next.", href: "/programs/track-301", tone: "var(--bow-slate)" },
];

export default async function ProgramsPage() {
  const programs = await listPublicPrograms();

  return (
    <div data-screen-label="Programs">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,6vw,88px) clamp(18px,4vw,40px) clamp(36px,5vw,56px)", overflow: "hidden", position: "relative" }}>
        <div className="bow-container" style={{ position: "relative" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Programs</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(36px,6vw,76px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "18ch" }}>What can my student join?</h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,20px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 620 }}>Real programs, real dates. Register directly below — no account required.</p>
        </div>
      </section>

      {/* ===== UPCOMING PROGRAMS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,6vw,80px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="Join Now" title="Upcoming programs" style={{ marginBottom: 32 }} />
          {programs.length === 0 ? (
            <div style={{ border: "1px dashed var(--border-rule)", borderRadius: "var(--radius-control)", padding: "40px 28px", textAlign: "center", background: "#fff" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, color: "var(--bow-slate)" }}>
                No programs are open for registration right now.
              </p>
              <div style={{ marginTop: 18 }}>
                <Button href="/sign-up" variant="primary" size="md">Join the Interest List</Button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(16px,2vw,24px)" }}>
              {programs.map((program) => (
                <PublicProgramCard key={program.id} program={program} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CURRICULUM OVERVIEW ===== */}
      <section style={{ background: "#fff", padding: "clamp(40px,6vw,80px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="Explore the BOW Curriculum" title="What BOW teaches" style={{ marginBottom: 32 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
            {CURRICULUM_OVERVIEW.map((track) => (
              <Link key={track.num} href={track.href} className="bow-card" style={{ background: "#fff", padding: "26px 22px", display: "flex", flexDirection: "column", gap: 10, color: "var(--bow-ink)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 40, lineHeight: 0.8, letterSpacing: "-0.02em", color: track.tone }}>{track.num}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: track.tone }}>{track.grades}</span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)", flex: 1 }}>{track.body}</p>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: track.tone }}>Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
