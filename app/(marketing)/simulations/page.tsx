import type { Metadata } from "next";
import Link from "next/link";
import SimulationLibrary from "@/components/site/SimulationLibrary";
import { SIMULATIONS, PLAYABLE_COUNT, programs } from "@/lib/simulation-library";
import { SITE_URL } from "@/lib/cms/metadata";

/**
 * /simulations — the public simulation library.
 *
 * Unlike the other marketing routes this page does NOT go through
 * `ContentPage`. That is a deliberate trade rather than an oversight: a
 * CMS-backed page renders "this page is still being written" until someone
 * publishes a document for its slug, and this page's whole job is to be the
 * one place where everything BOW has built actually opens. It should work the
 * moment it deploys, with no database round-trip and no editorial step.
 *
 * The catalog itself is generated data (see lib/simulation-library.ts), so the
 * only copy held here is the framing. Moving that framing into the CMS later
 * is a small, safe change; starting there would have shipped an empty page.
 */

export const metadata: Metadata = {
  title: "Simulation Library — BOW Sports Capital",
  description:
    "Sports-business economics simulations students can play in a browser. Filter by program, subject, concept, grade, sport, duration and format. Free, no account.",
  alternates: { canonical: `${SITE_URL}/simulations` },
  openGraph: {
    title: "Simulation Library — BOW Sports Capital",
    description: "Economics and financial literacy, played rather than read. Free to try, no account needed.",
    url: `${SITE_URL}/simulations`,
    type: "website",
  },
};

export default function SimulationsPage() {
  const programList = programs();

  return (
    <>
      <section className="bow-section bow-section-ink bow-front-office">
        <div className="bow-container" style={{ position: "relative" }}>
          <span className="bow-eyebrow" style={{ color: "var(--bow-orange)" }}>Simulation Library</span>
          <h1 className="bow-display">Economics, played rather than read.</h1>
          <p className="bow-lead" style={{ maxWidth: "46ch" }}>
            Every simulation here opens in a browser. No install, no account, nothing to set up
            before a class can start.
          </p>
          <div
            style={{
              marginTop: "clamp(24px,3vw,36px)",
              paddingTop: "clamp(18px,2.5vw,26px)",
              borderTop: "1px solid var(--bow-dark-border, #2a2a2f)",
              display: "flex",
              flexWrap: "wrap",
              gap: "12px 32px",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--bow-on-ink-muted)",
              }}
            >
              {PLAYABLE_COUNT} ready to play · free · no account
            </span>
            <p style={{ margin: 0, maxWidth: "62ch", fontSize: 14.5, color: "var(--bow-on-ink-subtle)" }}>
              <strong style={{ color: "#fff" }}>Everything here is Beta.</strong>{" "}
              These simulations are built and playable, and we are still learning how they work in
              real classrooms. If you run one, <Link href="/contact" className="bow-link" style={{ color: "#fff" }}>tell us what happened</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="bow-section bow-section-paper" style={{ paddingBottom: 0 }}>
        <div className="bow-container-wide">
          <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Programs</span>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
              marginTop: 16,
            }}
          >
            {programList.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--border-rule)",
                  borderLeft: p.building ? "3px solid var(--bow-blue)" : undefined,
                  borderRadius: 6,
                  background: "var(--bow-white)",
                  padding: "16px 18px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    fontSize: 19,
                    lineHeight: 1.1,
                  }}
                >
                  {p.name}
                  {p.building && (
                    <span
                      style={{
                        display: "inline-block",
                        marginLeft: 8,
                        verticalAlign: "0.12em",
                        fontFamily: "var(--font-data)",
                        fontSize: 9.5,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        background: "var(--bow-blue-tint)",
                        color: "var(--bow-blue)",
                        padding: "3px 6px",
                        borderRadius: 3,
                      }}
                    >
                      In development
                    </span>
                  )}
                </p>
                <p style={{ margin: "5px 0 9px", fontSize: 13, color: "var(--bow-slate)" }}>{p.note}</p>
                <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12 }}>{p.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bow-section bow-section-paper">
        <div className="bow-container-wide">
          <SimulationLibrary simulations={SIMULATIONS} />

          <p
            style={{
              borderTop: "1px solid var(--border-rule)",
              marginTop: "clamp(36px,5vw,56px)",
              paddingTop: 20,
              maxWidth: "70ch",
              fontSize: 13.5,
              color: "var(--bow-slate)",
            }}
          >
            <strong style={{ color: "var(--bow-ink)" }}>About these labels.</strong> Every simulation
            is marked Beta because each one is built and playable but none has yet been studied with
            a class. We would rather say that plainly than imply a track record we have not earned.
            Durations and grade bands appear only where the simulation itself states one — a blank is
            a blank, not a guess. Work marked “In development” is real and underway, and carries no
            launch link precisely because there is nothing to open yet.
          </p>
        </div>
      </section>
    </>
  );
}
