import Link from "next/link";
import type { PublicProfile } from "@/lib/profile";
import RankBadge from "@/components/profile/RankBadge";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--bow-dark-border)", borderRadius: 6, padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, lineHeight: 1, color: accent ?? "#fff" }}>{value}</div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{label}</div>
    </div>
  );
}

/**
 * The public, shareable student profile (Feature 3). No reflections or personal
 * data — just the achievement record students put on college applications.
 */
export default function PublicProfileView({ profile }: { profile: PublicProfile }) {
  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", padding: "clamp(28px,5vw,64px) clamp(16px,4vw,32px) 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Sports Capital
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a9da6" }}>
            Verified Credential
          </span>
        </div>

        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a9da6" }}>
          {profile.cohortName}
        </span>
        <h1 style={{ margin: "8px 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(38px,6vw,68px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          {profile.name}
        </h1>

        <div style={{ marginBottom: 26 }}>
          <RankBadge rank={profile.rank} dark />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 30 }}>
          <Stat label="BOW Score" value={String(profile.bowScore)} accent="#6f8bff" />
          <Stat label="Track 101 modules" value={`${profile.modulesCompleted}/${profile.totalModules}`} />
          <Stat label="Track 201 modules" value={`${profile.modules201Completed}/${profile.total201Modules}`} />
          <Stat label="Econ Quiz (MC)" value={profile.quizScorePct === null ? "—" : `${profile.quizScorePct}%`} />
          <Stat label="Track 101 cert" value={profile.certificateEarned ? "Earned" : "In progress"} accent={profile.certificateEarned ? "#5fcf99" : undefined} />
          <Stat label="Track 201 cert" value={profile.track201CertificateEarned ? "Earned" : "—"} accent={profile.track201CertificateEarned ? "#5fcf99" : undefined} />
          <Stat label="Simulation Room" value={profile.simulationCompleted ? "Complete" : "Not yet"} accent={profile.simulationCompleted ? "#5fcf99" : undefined} />
          <Stat label="The Front Office" value={profile.eastfieldCompleted ? "Complete" : "Not yet"} accent={profile.eastfieldCompleted ? "#5fcf99" : undefined} />
          <Stat label="Discussion posts" value={String(profile.discussionPosts)} />
        </div>

        <div style={{ borderTop: "1px solid var(--bow-dark-border)", paddingTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.6, color: "#9a9da6", maxWidth: 420 }}>
            {profile.name.split(" ")[0]} is learning the business of sports — economics, finance, and strategy — by running the front office.
          </p>
          <Link href="/join" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "none", background: "var(--bow-orange)", color: "#fff", borderRadius: 4, textDecoration: "none", flexShrink: 0 }}>
            Start Your Track 101
          </Link>
        </div>
      </div>
    </div>
  );
}
