import type { Metadata } from "next";
import Link from "next/link";
import SimulationLibraryView from "@/components/site/SimulationLibraryView";
import { getSimulationCatalog } from "@/lib/simulations-catalog";

/**
 * /simulations — the public simulation library.
 *
 * This page exists because the simulations already worked and nobody could
 * find them. They were live on GitHub Pages and linked from nowhere, which
 * made the gap a linking problem rather than a building one, and therefore the
 * cheapest large win available.
 *
 * Unlike the other marketing routes it does NOT read its copy from the CMS.
 * That is deliberate. The whole point of the page is that it reliably reaches
 * the simulations, so it must not gain a runtime dependency that can fail —
 * a database wobble would put the library back exactly where it started. The
 * catalog is vendored (`npm run sync:simulations`) and the framing copy is
 * short enough to live here honestly.
 */

export const metadata: Metadata = {
  title: "Simulations · BOW Sports Capital",
  description:
    "Every BOW economics simulation a student can open today — salary caps, scarcity, draft strategy and risk, played as a decision rather than read as a worksheet. Free, no login.",
  alternates: { canonical: "/simulations" },
};

export default function SimulationsPage() {
  const catalog = getSimulationCatalog();
  const playable = catalog.simulations.filter((s) => s.availability === "available").length;

  return (
    <>
      {/* HERO */}
      <section
        style={{
          background: "var(--bow-ink)",
          color: "var(--bow-on-ink)",
          padding: "clamp(48px,6vw,88px) clamp(18px,4vw,40px) clamp(40px,5vw,64px)",
        }}
      >
        <div className="bow-container-wide">
          <p
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--bow-on-ink-subtle)",
              margin: "0 0 14px",
            }}
          >
            The Simulation Library
          </p>
          <h1
            style={{
              margin: "0 0 18px",
              fontSize: "clamp(32px,5vw,54px)",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              maxWidth: "18ch",
            }}
          >
            Economics you play, not economics you read.
          </h1>
          <p
            style={{
              margin: "0 0 28px",
              fontSize: "clamp(16px,1.5vw,19px)",
              lineHeight: 1.6,
              color: "var(--bow-on-ink-muted)",
              maxWidth: "60ch",
            }}
          >
            {playable} simulations you can open right now, in a browser, with no login and no
            account. You take a role, face a decision with a real tradeoff, and live with what it
            does to your numbers.
          </p>

          <dl
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "clamp(20px,4vw,52px)",
              margin: 0,
              paddingTop: 24,
              borderTop: "1px solid var(--bow-dark-border)",
            }}
          >
            <Stat value={String(playable)} label="Playable today" />
            <Stat value="Free" label="No login, no cost" />
            <Stat value="5–60 min" label="Fits a class period" />
          </dl>
        </div>
      </section>

      {/* LIBRARY */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <SimulationLibraryView
            simulations={catalog.simulations}
            labelMeaning={catalog.label.meaning}
          />
        </div>
      </section>

      {/* ONWARD */}
      <section
        style={{
          background: "var(--surface-raised)",
          borderTop: "1px solid var(--border-rule)",
          padding: "clamp(40px,5vw,64px) clamp(18px,4vw,40px)",
        }}
      >
        <div className="bow-container-wide">
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(22px,2.5vw,30px)", letterSpacing: "-0.01em" }}>
            Teaching with these
          </h2>
          <p style={{ margin: "0 0 24px", color: "var(--bow-slate)", fontSize: 16, maxWidth: "62ch" }}>
            Every simulation is built around a named economic concept. These three pages make that
            concept teachable rather than incidental.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Onward
              href="/concept-map"
              title="Concept Map"
              body="Which economic ideas BOW teaches, and which simulations reach each one."
            />
            <Onward
              href="/glossary"
              title="Glossary"
              body="Every term in the curriculum in plain English, from salary cap to opportunity cost."
            />
            <Onward
              href="/programs"
              title="Programs"
              body="How these simulations sit inside a taught track, with an instructor."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    // Column-reverse keeps the DOM order correct for assistive tech (term then
    // definition) while showing the number above its label.
    <div style={{ display: "flex", flexDirection: "column-reverse" }}>
      <dt
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bow-on-ink-subtle)",
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: "0 0 4px", fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
        {value}
      </dd>
    </div>
  );
}

function Onward({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      style={{
        flex: "1 1 260px",
        display: "block",
        padding: "20px 22px",
        border: "1px solid var(--border-rule)",
        borderRadius: 12,
        textDecoration: "none",
        color: "var(--text-primary)",
        background: "var(--bow-paper)",
      }}
    >
      <span style={{ display: "block", fontSize: 17, marginBottom: 6, fontWeight: 600 }}>
        {title} <span aria-hidden="true">→</span>
      </span>
      <span style={{ display: "block", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{body}</span>
    </Link>
  );
}
