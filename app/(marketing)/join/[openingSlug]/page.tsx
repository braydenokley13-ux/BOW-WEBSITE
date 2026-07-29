import { notFound } from "next/navigation";
import OpeningApplicationForm from "@/components/site/OpeningApplicationForm";
import { Badge, CapLine } from "@/components/ds";
import { getPublicOpening, publicEngagementLabel } from "@/lib/people-work";

// getPublicOpening() reads from the database; must not run at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ openingSlug: string }> }) {
  const { openingSlug } = await params;
  const opening = await getPublicOpening(openingSlug);
  return opening ? { title: `${opening.title} — Join BOW`, description: opening.summary } : { title: "Opening not found" };
}

export default async function OpeningPage({ params }: { params: Promise<{ openingSlug: string }> }) {
  const { openingSlug } = await params;
  const opening = await getPublicOpening(openingSlug);
  if (!opening) notFound();
  return (
    <div>
      <section className="bow-front-office" style={{ padding: "clamp(50px,7vw,90px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container">
          <span className="bow-eyebrow" style={{ color: "var(--bow-orange)" }}>BOW opening · Published terms</span>
          <h1 style={{ marginTop: 12, maxWidth: 850, fontFamily: "var(--font-editorial)", fontSize: "clamp(42px,6vw,76px)", lineHeight: .98 }}>{opening.title}</h1>
          <CapLine weight={6} step={18} stepAt={.5} style={{ marginTop: 22, maxWidth: 320 }} />
          <p style={{ marginTop: 22, maxWidth: 720, fontSize: 20, lineHeight: 1.55, color: "#b9bcc4" }}>{opening.summary}</p>
          <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 8 }}><Badge status="neutral">{publicEngagementLabel(opening.engagementTypes)}</Badge></div>
        </div>
      </section>
      <section style={{ padding: "clamp(48px,7vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(32px,6vw,72px)" }}>
          <div><span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>What you will own</span><p style={{ marginTop: 15, fontSize: 18, lineHeight: 1.65 }}>{opening.description}</p><ul style={{ marginTop: 22, paddingLeft: 22, display: "grid", gap: 10, lineHeight: 1.55 }}>{opening.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><span className="bow-eyebrow" style={{ color: "var(--bow-orange)" }}>Commitment and eligibility</span><p style={{ marginTop: 15, fontSize: 18, lineHeight: 1.65 }}>{opening.timeCommitment}</p><ul style={{ marginTop: 22, paddingLeft: 22, display: "grid", gap: 10, lineHeight: 1.55 }}>{opening.eligibility.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>
      <section style={{ padding: "clamp(48px,7vw,88px) clamp(18px,4vw,40px)", background: "#fff" }}>
        <div className="bow-container" style={{ maxWidth: 760 }}>
          <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Apply</span>
          <h2 style={{ marginTop: 10, marginBottom: 28, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(36px,5vw,58px)", textTransform: "uppercase" }}>Tell us how you would help students learn.</h2>
          <OpeningApplicationForm openingSlug={opening.slug} questions={opening.questions} />
        </div>
      </section>
    </div>
  );
}
