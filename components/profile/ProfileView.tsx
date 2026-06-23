import Link from "next/link";
import type { ProfileData } from "@/lib/profile";
import RankBadge from "@/components/profile/RankBadge";
import ShareButton from "@/components/profile/ShareButton";

const fmtDate = (ts: number | null): string =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, lineHeight: 1, color: accent ?? "var(--bow-ink)" }}>{value}</div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{label}</div>
    </div>
  );
}

/** The private student profile — everything they've done in BOW (Feature 3). */
export default function ProfileView({ data }: { data: ProfileData }) {
  const sharePath = `/profile/${data.studentId}`;

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            Your BOW Profile
          </span>
          <Link href="/dashboard" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}>
            ← Dashboard
          </Link>
        </div>

        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          {data.name}
        </h1>
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          {data.cohortName} · {data.trackTitle} · Joined {fmtDate(data.createdAt)}
        </p>

        <div style={{ marginBottom: 24 }}>
          <RankBadge rank={data.rank} />
        </div>

        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
          <Stat label="BOW Score" value={String(data.bowScore)} accent="var(--bow-blue)" />
          <Stat label="Modules complete" value={`${data.modulesCompleted}/${data.totalModules}`} />
          <Stat label="Econ Quiz (MC)" value={data.quizScorePct === null ? "—" : `${data.quizScorePct}%`} />
          <Stat label="BOW Daily answered" value={String(data.scenarioCount)} />
          <Stat label="Reflections" value={String(data.reflectionCount)} />
          <Stat label="Certificate" value={data.certificateEarned ? "Earned" : "In progress"} accent={data.certificateEarned ? "var(--bow-positive)" : undefined} />
          <Stat label="Simulation Room" value={data.simulationCompleted ? "Complete" : "Not yet"} accent={data.simulationCompleted ? "var(--bow-positive)" : undefined} />
        </div>

        {/* MODULES */}
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
          Track 101 modules
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {data.modules.map((m) => (
            <div key={m.ordinal} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: `4px solid ${m.completed ? "var(--bow-positive)" : "var(--bow-inactive)"}`, borderRadius: 6, padding: "14px 18px" }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>M{String(m.ordinal).padStart(2, "0")}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{m.title}</span>
              </span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.04em", color: m.completed ? "var(--bow-positive)" : "var(--bow-slate)" }}>
                {m.completed ? `✓ Completed ${fmtDate(m.completedAt)}` : "Not yet"}
              </span>
            </div>
          ))}
        </div>

        {/* REFLECTIONS */}
        {data.reflectionExcerpts.length > 0 && (
          <>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
              Reflection highlights
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {data.reflectionExcerpts.map((r, i) => (
                <div key={i} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "14px 18px" }}>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 6 }}>{r.title}</div>
                  <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-ink)", fontStyle: "italic" }}>“{r.excerpt}”</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SHARE */}
        <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(20px,3vw,30px)" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Share your record</span>
          <h2 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,3vw,32px)", lineHeight: 0.98, textTransform: "uppercase" }}>
            Put it on the application.
          </h2>
          <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 520 }}>
            Your public profile shows your rank, modules, certificate, and quiz score — no reflections or personal details. Share the link on a college application or send it to a parent.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ShareButton path={sharePath} />
            <Link href={sharePath} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", borderRadius: 4, textDecoration: "none" }}>
              View Public Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
