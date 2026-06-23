"use client";

import type { CSSProperties } from "react";
import DemoRequestForm from "@/components/partners/DemoRequestForm";

/* ============================================================
 * Partner / school landing page (Feature 5) — the full marketing
 * surface for a single partner org. Public, no login.
 *
 * Editorial / outreach tone (richer than the dashboard): a dark
 * var(--bow-ink) hero with white headline (like the CertificatePrompt
 * block in StudentDashboard.tsx), then "what your students get" and
 * "what your instructors get", a press coverage strip, and the public
 * "Request a Demo" form. All colors/fonts come from the design tokens.
 * ============================================================ */

export interface PartnerLandingProps {
  slug: string;
  name: string;
  typeLabel: string;
  customHeadline: string;
  customBody: string;
  studentBullets: string[];
  instructorBullets: string[];
  pressOutlets: string[];
}

const WRAP: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 clamp(20px,5vw,48px)" };

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "#fff" : "var(--bow-ink)";
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 900,
        fontSize: 20,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color,
      }}
    >
      BOW <span style={{ color: "var(--bow-orange)" }}>Sports Capital</span>
    </span>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "dark" | "light" }) {
  const dot = "var(--bow-orange)";
  const text = tone === "dark" ? "#cdd6e3" : "var(--bow-slate)";
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              marginTop: 7,
              width: 9,
              height: 9,
              background: dot,
              borderRadius: 2,
              transform: "rotate(45deg)",
            }}
          />
          <span style={{ fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,17.5px)", lineHeight: 1.55, color: text }}>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <span style={{ ...eyebrow, color: "var(--bow-blue)" }}>{kicker}</span>
      <h2
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: "clamp(28px,4vw,46px)",
          lineHeight: 0.96,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: "var(--bow-ink)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

export default function PartnerLanding({
  slug,
  name,
  typeLabel,
  customHeadline,
  customBody,
  studentBullets,
  instructorBullets,
  pressOutlets,
}: PartnerLandingProps) {
  return (
    <main style={{ background: "var(--bow-paper)", minHeight: "100vh" }}>
      {/* 1 + 2. Dark hero: wordmark + tagline, custom headline + body. */}
      <section style={{ background: "var(--bow-ink)", color: "#fff" }}>
        <div style={{ ...WRAP, paddingTop: "clamp(40px,7vw,80px)", paddingBottom: "clamp(48px,8vw,96px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: "clamp(40px,7vw,72px)" }}>
            <Wordmark tone="dark" />
            <span style={{ ...eyebrow, color: "#7e90a8" }}>The front office for the next generation</span>
          </div>

          <span style={{ ...eyebrow, color: "var(--bow-orange)" }}>
            {typeLabel} Partnership · {name}
          </span>
          <h1
            style={{
              margin: "16px 0 0",
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: "clamp(40px,7vw,88px)",
              lineHeight: 0.88,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: "#fff",
              maxWidth: "16ch",
            }}
          >
            {customHeadline}
          </h1>
          <p
            style={{
              margin: "26px 0 0",
              fontFamily: "var(--font-editorial)",
              fontSize: "clamp(17px,2vw,22px)",
              lineHeight: 1.55,
              color: "#cdd6e3",
              maxWidth: 720,
            }}
          >
            {customBody}
          </p>
          <div style={{ marginTop: "clamp(28px,4vw,40px)", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a
              href="#request-demo"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "14px 30px",
                background: "var(--bow-orange)",
                color: "var(--bow-ink)",
                borderRadius: 4,
                textDecoration: "none",
              }}
            >
              Request a Demo →
            </a>
          </div>
        </div>
      </section>

      {/* 3 + 4. What your students / instructors get. */}
      <section style={{ ...WRAP, paddingTop: "clamp(48px,8vw,88px)", paddingBottom: "clamp(24px,4vw,40px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "clamp(36px,5vw,64px)",
          }}
        >
          <div>
            <SectionHeading kicker="For your students" title="What your students get" />
            <BulletList items={studentBullets} tone="light" />
          </div>
          <div>
            <SectionHeading kicker="For your instructors" title="What your instructors get" />
            <BulletList items={instructorBullets} tone="light" />
          </div>
        </div>
      </section>

      {/* 5. Press coverage strip. */}
      <section style={{ borderTop: "1px solid var(--border-rule)", marginTop: "clamp(32px,5vw,56px)" }}>
        <div style={{ ...WRAP, paddingTop: "clamp(36px,5vw,56px)", paddingBottom: "clamp(36px,5vw,56px)" }}>
          <span style={{ ...eyebrow, color: "var(--bow-slate)" }}>As seen in</span>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "clamp(20px,4vw,48px)",
            }}
          >
            {pressOutlets.map((outlet) => (
              <span
                key={outlet}
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(16px,2vw,22px)",
                  letterSpacing: "0.01em",
                  textTransform: "uppercase",
                  color: "var(--bow-ink)",
                  opacity: 0.72,
                }}
              >
                {outlet}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Request a Demo — dark panel with the public form. */}
      <section id="request-demo" style={{ background: "var(--bow-ink)", color: "#fff" }}>
        <div style={{ ...WRAP, paddingTop: "clamp(48px,8vw,88px)", paddingBottom: "clamp(56px,9vw,104px)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "clamp(32px,5vw,64px)",
              alignItems: "start",
            }}
          >
            <div>
              <span style={{ ...eyebrow, color: "var(--bow-orange)" }}>Get started</span>
              <h2
                style={{
                  margin: "12px 0 0",
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: "clamp(30px,4.5vw,52px)",
                  lineHeight: 0.92,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color: "#fff",
                }}
              >
                Bring BOW to {name}.
              </h2>
              <p style={{ margin: "20px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#cdd6e3", maxWidth: 460 }}>
                Tell us a little about your program and we&apos;ll set up a walkthrough. No commitment — just a look at
                what BOW Sports Capital can do for your students and staff.
              </p>
            </div>
            <div>
              <DemoRequestForm orgSlug={slug} />
            </div>
          </div>

          <div style={{ marginTop: "clamp(48px,7vw,80px)", paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <Wordmark tone="dark" />
            <span style={{ ...eyebrow, color: "#7e90a8" }}>Read the game. Run the business. Make the decision.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
