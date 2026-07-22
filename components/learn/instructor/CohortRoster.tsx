"use client";

/* ============================================================
 * components/learn/instructor/CohortRoster.tsx — Stage 8 follow-up.
 *
 * Per-student lesson status table for one cohort, backed by the NEW
 * attempt tables (learn_attempts/mastery/assignment_progress via
 * lib/learn/instructorConsole.ts), plus release controls wired to
 * app/actions/learn-release.ts: release a node to the whole cohort, a
 * single student override, or a timed open (opens_at).
 * ============================================================ */

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import { releaseToScope, revokeFromScope } from "@/app/actions/learn-release";
import type { RosterStudent, ReleasableMapNode } from "@/lib/learn/instructorConsole";

const statusLabel: Record<RosterStudent["lessons"][number]["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const statusColor: Record<RosterStudent["lessons"][number]["status"], string> = {
  not_started: "var(--bow-slate)",
  in_progress: "var(--bow-blue)",
  completed: "var(--bow-positive)",
};

function fmtTime(ts: number | null): string {
  if (!ts) return "No activity yet";
  return new Date(ts).toLocaleString();
}

export default function CohortRoster({
  cohortId,
  students,
  releasableNodes,
}: {
  cohortId: string;
  students: RosterStudent[];
  releasableNodes: ReleasableMapNode[];
}) {
  const [nodeId, setNodeId] = useState(releasableNodes[0]?.id ?? "");
  const [studentOverride, setStudentOverride] = useState<string>("");
  const [opensAt, setOpensAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function doRelease(scopeType: "cohort" | "student", scopeId: string) {
    if (!nodeId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await releaseToScope({
        nodeId,
        scopeType,
        scopeId,
        opensAt: opensAt ? new Date(opensAt).getTime() : null,
      });
      setMessage(result.ok ? { kind: "ok", text: "Released." } : { kind: "error", text: result.error });
    });
  }

  function doRevoke(scopeType: "cohort" | "student", scopeId: string) {
    if (!nodeId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await revokeFromScope({ nodeId, scopeType, scopeId });
      setMessage(result.ok ? { kind: "ok", text: "Revoked." } : { kind: "error", text: result.error });
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 20 }}>
        <h2 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: 16, textTransform: "uppercase" }}>Release controls</h2>
        {releasableNodes.length === 0 ? (
          <p style={{ margin: 0, color: "var(--bow-slate)", fontSize: 14 }}>
            No map nodes are set to &ldquo;instructor release&rdquo; yet — set a node&rsquo;s unlock policy in the
            Career Map editor first.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Node
              <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border-rule)", borderRadius: 4 }}>
                {releasableNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.lessonTitle}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Opens at (optional)
              <input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border-rule)", borderRadius: 4 }} />
            </label>
            <Button variant="emphasis" size="sm" disabled={pending} onClick={() => doRelease("cohort", cohortId)} aria-label="Release to whole cohort">
              Release to cohort
            </Button>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => doRevoke("cohort", cohortId)} aria-label="Revoke from whole cohort">
              Revoke from cohort
            </Button>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Student override
              <select value={studentOverride} onChange={(e) => setStudentOverride(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border-rule)", borderRadius: 4 }}>
                <option value="">Choose a student…</option>
                {students.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" size="sm" disabled={pending || !studentOverride} onClick={() => doRelease("student", studentOverride)} aria-label="Release to selected student only">
              Release to student
            </Button>
            <Button variant="ghost" size="sm" disabled={pending || !studentOverride} onClick={() => doRevoke("student", studentOverride)} aria-label="Revoke selected student override">
              Revoke override
            </Button>
          </div>
        )}
        {message && (
          <p role="status" style={{ marginTop: 10, marginBottom: 0, color: message.kind === "error" ? "var(--bow-negative)" : "var(--bow-positive)", fontSize: 13 }}>
            {message.text}
          </p>
        )}
      </div>

      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-rule)", textAlign: "left" }}>
              <th style={{ padding: "10px 14px" }}>Student</th>
              <th style={{ padding: "10px 14px" }}>Last activity</th>
              {students[0]?.lessons.map((l) => (
                <th key={l.lessonId} style={{ padding: "10px 14px" }}>{l.lessonTitle}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.userId} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{s.name}</td>
                <td style={{ padding: "10px 14px", color: "var(--bow-slate)" }}>{fmtTime(s.lastActivityAt)}</td>
                {s.lessons.map((l) => (
                  <td key={l.lessonId} style={{ padding: "10px 14px" }}>
                    <span style={{ color: statusColor[l.status], fontWeight: 600 }}>{statusLabel[l.status]}</span>
                    {l.bestScore != null && (
                      <span style={{ color: "var(--bow-slate)" }}>
                        {" "}
                        · {l.bestScore}/100{l.bestStars != null ? ` · ${"★".repeat(l.bestStars)}` : ""}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={2 + (students[0]?.lessons.length ?? 0)} style={{ padding: 20, color: "var(--bow-slate)" }}>
                  No enrolled students in this cohort yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
