"use client";

import Link from "next/link";
import type { IdentityView } from "@/lib/learn/home";

export default function IdentityPanel({ identity }: { identity: IdentityView }) {
  const { firstName, xp, careerTitle, nextCareerTitle, careerProgress, streak, skills, recentBadges } = identity;

  return (
    <div
      style={{
        background: "var(--bow-ink)",
        color: "var(--bow-paper)",
        borderRadius: 16,
        padding: "clamp(18px,3vw,26px)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: "var(--bow-orange)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {firstName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>
            Career Title
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, textTransform: "uppercase", lineHeight: 1.05 }}>
            {careerTitle}
          </div>
        </div>
      </div>

      {/* XP bar to next title */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-data)", fontSize: 11, opacity: 0.75, marginBottom: 6 }}>
          <span>{xp.toLocaleString()} XP</span>
          <span>{nextCareerTitle ? `Next: ${nextCareerTitle}` : "Top of the ladder"}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round(careerProgress * 100)}%`, background: "var(--bow-orange)", borderRadius: 999 }} />
        </div>
      </div>

      {/* Streak flame */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 13 }}>
        <span aria-hidden style={{ fontSize: 18 }}>🔥</span>
        <span>
          {streak.current} day{streak.current === 1 ? "" : "s"} streak
          {streak.longest > streak.current ? ` · best ${streak.longest}` : ""}
        </span>
      </div>

      {/* Recent badges */}
      {recentBadges.length > 0 && (
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 8 }}>
            Recent Badges
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recentBadges.map((b) => (
              <span
                key={b.id}
                title={b.name}
                style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              >
                {b.icon || "🏅"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skill levels */}
      {skills.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6 }}>
            Skills
          </div>
          {skills.map((s) => (
            <div key={s.slug}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 4 }}>
                <span>{s.icon ? `${s.icon} ` : ""}{s.label} · Level {s.level}</span>
                <span style={{ opacity: 0.6, fontFamily: "var(--font-data)", fontSize: 11 }}>{s.points} pts</span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(s.progress * 100)}%`, background: "var(--bow-positive, #3aa76d)", borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/badges"
        style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-orange)", textDecoration: "none" }}
      >
        View all badges →
      </Link>
    </div>
  );
}
