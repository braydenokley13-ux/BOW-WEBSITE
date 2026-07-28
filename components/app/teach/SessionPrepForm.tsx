"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { saveSessionPrep } from "@/app/actions/delivery";
import { PREP_CHECKLIST, prepStatusLabel, type PrepStatus } from "@/lib/delivery-shared";

export default function SessionPrepForm({
  sessionId,
  initialChecklist,
  initialBlockers,
  initialStatus,
}: {
  sessionId: string;
  initialChecklist: { key: string; label: string; done: boolean }[];
  initialBlockers: string;
  initialStatus: PrepStatus;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(initialChecklist.map((item) => [item.key, item.done])),
  );
  const [blockers, setBlockers] = useState(initialBlockers);
  const [status, setStatus] = useState<PrepStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (markReady: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await saveSessionPrep(sessionId, {
        checklist: checked,
        blockers,
        status: markReady ? "ready" : undefined,
      });
      if (res.ok) {
        if (res.status) setStatus(res.status);
        router.refresh();
      } else {
        setError(res.error || "Preparation could not be saved.");
      }
    } catch {
      setError("Preparation could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="ops-label">Your preparation</span>
        <Badge status={status === "ready" ? "positive" : status === "in_preparation" ? "warning" : "neutral"}>
          {prepStatusLabel(status)}
        </Badge>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PREP_CHECKLIST.map((item) => (
          <label key={item.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={Boolean(checked[item.key])}
              onChange={(e) => setChecked((prev) => ({ ...prev, [item.key]: e.target.checked }))}
              style={{ marginTop: 3 }}
            />
            <span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{item.label}</span>
              <span className="ops-body" style={{ display: "block", margin: 0 }}>{item.why}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="ops-field">
        <label htmlFor="prep-blockers">Blockers</label>
        <textarea
          id="prep-blockers"
          value={blockers}
          onChange={(e) => setBlockers(e.target.value)}
          placeholder="Anything in your way — missing materials, access issues, a schedule conflict"
          rows={3}
        />
      </div>

      {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => submit(false)}>
          {busy ? "Saving…" : "Save progress"}
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => submit(true)}>
          {busy ? "Saving…" : "Mark preparation ready"}
        </Button>
      </div>
    </div>
  );
}
