import { SectionHeader } from "@/components/ds";
import ProgramFinderClient from "@/components/site/programs/ProgramFinderClient";
import { listDiscoveryPrograms } from "@/lib/program-discovery";

export const metadata = {
  title: "Find a Program",
  description: "Answer a few short questions and see which BOW Sports Capital programs fit your student.",
};

// listDiscoveryPrograms() reads live program data from the database; it must
// not run at build time (no DB access during prerender), so this route is
// rendered per-request instead of statically.
export const dynamic = "force-dynamic";

export default async function ProgramFinderPage() {
  const programs = await listDiscoveryPrograms();

  return (
    <div data-screen-label="Program Finder">
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(40px,6vw,72px) clamp(18px,4vw,40px) clamp(28px,4vw,44px)" }}>
        <div className="bow-container">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            Find a Program
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,5vw,56px)", lineHeight: 0.96, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "18ch" }}>
            A few questions, a real list of fits.
          </h1>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.3vw,18px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 560 }}>
            This is a straightforward match against each program&apos;s grade range, format, and schedule — not an
            algorithm making a decision for you.
          </p>
        </div>
      </section>
      <section style={{ background: "var(--bow-paper)", padding: "clamp(32px,5vw,56px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ maxWidth: 760 }}>
          <SectionHeader kicker="Guided Finder" title="Tell us about your student" style={{ marginBottom: 24 }} />
          <ProgramFinderClient programs={programs} />
        </div>
      </section>
    </div>
  );
}
