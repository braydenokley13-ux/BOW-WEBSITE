import { Button, SectionHeader } from "@/components/ds";
import PodcastPlayer from "@/components/site/PodcastPlayer";
import { podcastAllEpisodes, podTakeaways } from "@/lib/podcast";

export const metadata = {
  title: "Podcast",
  description:
    "The BOW Sports Capital Podcast — the conversations behind the decisions. Each episode connects sports headlines, front-office strategy, and economics to the curriculum.",
};

export default function PodcastPage() {
  return (
    <div data-screen-label="Podcast">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)", overflow: "hidden", position: "relative" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: "-4%", top: "-8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,24vw,440px)", lineHeight: 0.8, color: "rgba(255,255,255,0.04)", pointerEvents: "none", letterSpacing: "-0.04em", textTransform: "uppercase" }}>Air</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>The BOW Sports Capital Podcast</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(36px,5.5vw,72px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "16ch", textWrap: "balance" }}>The conversations behind the decisions.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,21px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 600 }}>Each episode connects sports headlines, front-office strategy, and economics to the decisions students make throughout the curriculum. Not commentary — curriculum.</p>
        </div>
      </section>

      {/* ===== LATEST EPISODE ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)", display: "block", marginBottom: 20 }}>Latest Episode</span>
          <div style={{ background: "var(--bow-ink)", color: "#fff", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 0, border: "1px solid var(--bow-dark-border)" }}>
            <div style={{ padding: "clamp(24px,3.5vw,48px)", display: "flex", flexDirection: "column", gap: 18, borderRight: "1px solid var(--bow-dark-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 22, color: "var(--bow-blue)" }}>EP 08</span>
                <div style={{ height: 1, background: "var(--bow-dark-border)", flex: 1 }} />
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Revenue Economics</span>
              </div>
              <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.5vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Why Leagues Share Revenue</h2>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4" }}>How revenue sharing creates competitive balance — and why some owners hate it. The tradeoffs behind the rules every team has to live with.</p>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Runtime</span>
                  <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 16 }}>44 MIN</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Track</span>
                  <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 16 }}>Track 201</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Concept</span>
                  <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 16, color: "var(--bow-blue)" }}>Revenue Sharing</span>
                </div>
              </div>
              <div>
                <PodcastPlayer
                  episode="EP 08"
                  eyebrow="Revenue Economics · Latest episode"
                  title="Why Leagues Share Revenue"
                  desc="How revenue sharing creates competitive balance — and why some owners hate it. The tradeoffs behind the rules every team has to live with."
                  lengthSec={2640}
                  lengthLabel="44:00"
                  takeaways={podTakeaways}
                />
              </div>
            </div>
            <div style={{ padding: "clamp(20px,3vw,36px)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078", display: "block", marginBottom: 14 }}>Discussion Prompt</span>
              <div style={{ borderLeft: "4px solid var(--bow-blue)", paddingLeft: 16, marginBottom: 22 }}>
                <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: "clamp(17px,2vw,23px)", lineHeight: 1.25, color: "#fff" }}>If every team shares revenue equally, does it reduce the incentive to win? Defend your position.</p>
              </div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078", display: "block", marginBottom: 12 }}>Key Takeaways</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "#c8cad0" }}><span style={{ color: "var(--bow-blue)", fontFamily: "var(--font-data)", fontWeight: 700, flexShrink: 0 }}>01</span>Revenue sharing exists to prevent small-market collapse — not equalize ambition.</div>
                <div style={{ display: "flex", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "#c8cad0" }}><span style={{ color: "var(--bow-blue)", fontFamily: "var(--font-data)", fontWeight: 700, flexShrink: 0 }}>02</span>The teams that hate sharing the most are usually earning the most.</div>
                <div style={{ display: "flex", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "#c8cad0" }}><span style={{ color: "var(--bow-blue)", fontFamily: "var(--font-data)", fontWeight: 700, flexShrink: 0 }}>03</span>Incentive systems designed for fairness always have unintended consequences.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ALL EPISODES ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="All Episodes" title="The full episode list" style={{ marginBottom: 32 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {podcastAllEpisodes.map((ep) => (
              <div key={ep.num} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 18, alignItems: "start", padding: "22px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 16, color: "var(--bow-blue)", paddingTop: 4 }}>{ep.num}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{ep.topic}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{ep.track}{ep.module}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-blue)" }}>{ep.concept}</span>
                  </div>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(17px,1.8vw,22px)", lineHeight: 1.2 }}>{ep.title}</h3>
                  <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", lineHeight: 1.4 }}>{ep.desc}</p>
                </div>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", whiteSpace: "nowrap", paddingTop: 4 }}>{ep.runtime}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PODCAST IN THE CURRICULUM ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Podcast in the Curriculum</span>
            <h2 style={{ margin: "12px 0 16px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Every episode is the context before the simulation.</h2>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>BOW&apos;s podcast isn&apos;t commentary on top of the curriculum. It&apos;s the real-world sports-business context that makes the simulation matter. Students hear how the league actually thinks before they have to decide themselves.</p>
            <div style={{ marginTop: 24 }}>
              <Button href="/programs/track-101" variant="primary" size="md">Explore Track 101</Button>
            </div>
          </div>
          <div style={{ border: "1px solid var(--border-rule)" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-rule)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>How each episode connects</span>
            </div>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-rule)", display: "grid", gridTemplateColumns: "90px 1fr", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>Track</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 15 }}>Tagged to a specific lesson in the curriculum.</span>
            </div>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-rule)", display: "grid", gridTemplateColumns: "90px 1fr", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>Concept</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 15 }}>Built around the core economic idea of that lesson.</span>
            </div>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-rule)", display: "grid", gridTemplateColumns: "90px 1fr", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>Context</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 15 }}>Sports-business stories that make the simulation real.</span>
            </div>
            <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "90px 1fr", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>Extension</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 15 }}>Optional deeper read after the lesson debrief.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
