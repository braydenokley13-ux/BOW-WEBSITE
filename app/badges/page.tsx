import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { getUserXp } from "@/lib/streak";
import { getBadgeShowcase, type BadgeView, type BadgeCategory } from "@/lib/badges";

const GOLD = "#C9A84C";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06-24 12:00:00" → "Jun 24, 2026". */
function formatEarned(s: string): string {
  const parts = s.slice(0, 10).split("-");
  if (parts.length !== 3) return s;
  const m = Number(parts[1]) - 1;
  return `${MONTHS[m] ?? parts[1]} ${Number(parts[2])}, ${parts[0]}`;
}

/** Teaser threshold shown on a LOCKED card (no exact name — discovery incentive). */
function thresholdHint(b: BadgeView): string {
  switch (b.category) {
    case "streak":
      return `Reach a ${b.threshold}-day streak`;
    case "accuracy":
      return `${b.threshold} correct answers`;
    case "volume":
      return `${b.threshold} questions answered`;
    case "difficulty":
      return b.threshold >= 3 ? "Nail an Executive question" : "Nail a Pro question";
    default:
      return "Hidden achievement";
  }
}

const CATEGORY_ACCENT: Record<BadgeCategory, string> = {
  streak: GOLD,
  accuracy: "#5fcf99",
  difficulty: "#b794f6",
  volume: "#7da2ff",
  special: "#ff8a5a",
};

function BadgeCard({ badge }: { badge: BadgeView }) {
  const accent = CATEGORY_ACCENT[badge.category];
  if (badge.earned) {
    return (
      <div style={{ background: "var(--bow-dark-surface)", border: `1px solid ${accent}`, borderRadius: 10, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 6, minHeight: 168 }}>
        <span aria-hidden style={{ fontSize: 40, lineHeight: 1 }}>{badge.icon}</span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", color: "#fff", marginTop: 4 }}>{badge.name}</span>
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "#9a9da6" }}>{badge.description}</span>
        <span style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: accent }}>
            {badge.earnedAt ? `Earned ${formatEarned(badge.earnedAt)}` : "Earned"}
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, color: GOLD }}>+{badge.xpReward} XP</span>
        </span>
      </div>
    );
  }
  return (
    <div style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-dark-border)", borderRadius: 10, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 6, minHeight: 168, opacity: 0.92 }}>
      <span aria-hidden style={{ fontSize: 40, lineHeight: 1, filter: "grayscale(1)", opacity: 0.35 }}>🔒</span>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em", color: "#6d7078", marginTop: 4, fontStyle: "italic" }}>{badge.lockedHint}</span>
      <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "#6d7078" }}>{thresholdHint(badge)}</span>
      <span style={{ marginTop: "auto", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#56585f" }}>
        Locked · {badge.category}
      </span>
    </div>
  );
}

export default async function BadgesPage() {
  const me = await requireRole("student");
  const showcase = getBadgeShowcase(me.id);
  const totalXp = getUserXp(me.id);

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD }}>
            BOW Achievements
          </span>
          <Link href="/dashboard" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6f8bff", textDecoration: "none" }}>
            ← Back to dashboard
          </Link>
        </div>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          Your Achievements
        </h1>

        {/* Summary strip */}
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "14px 0 30px" }}>
          <Stat value={`${showcase.totalEarned} / ${showcase.totalPossible}`} label="Badges earned" />
          <Stat value={`⚡ ${totalXp.toLocaleString()}`} label="Total XP" accent />
          <Stat value={`+${showcase.totalXp.toLocaleString()}`} label="XP from badges" />
        </div>

        {showcase.groups.map((group) => (
          <section key={group.category} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: CATEGORY_ACCENT[group.category], marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid var(--bow-dark-border)" }}>
              {group.label}
              <span style={{ color: "#6d7078", marginLeft: 8 }}>
                {group.badges.filter((b) => b.earned).length}/{group.badges.length}
              </span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
              {group.badges.map((b) => (
                <BadgeCard key={b.id} badge={b} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.4vw,38px)", lineHeight: 1, color: accent ? GOLD : "#fff" }}>{value}</div>
      <div style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6", marginTop: 6 }}>{label}</div>
    </div>
  );
}
