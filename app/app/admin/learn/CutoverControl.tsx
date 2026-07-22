"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setLearnCutover } from "@/app/actions/learn-cutover";
import { Badge, Button } from "@/components/ds";

export default function CutoverControl({ enabled, publishedLessons, draftLessons }: {
  enabled: boolean;
  publishedLessons: number;
  draftLessons: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async () => {
    const next = !enabled;
    const warning = next
      ? `Enable the new student routes now? ${draftLessons} lesson draft(s) are still unpublished.`
      : "Roll students back to the legacy routes now? Playbook data and attempts will be preserved.";
    if (!window.confirm(warning)) return;
    setBusy(true);
    setError(null);
    const result = await setLearnCutover({ enabled: next, reason });
    if (!result.ok) setError(result.error);
    else {
      setReason("");
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <section className="ops-panel" style={{ padding: 18, marginBottom: 24 }} aria-labelledby="learn-cutover-heading">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 680 }}>
          <span className="ops-label">Runtime release control</span>
          <h2 id="learn-cutover-heading" className="ops-section-title">Student Cutover</h2>
          <p className="ops-body">
            {enabled ? "New student entry routes are live." : "Legacy student entry routes remain live."} This switch is stored in the database, audited, and changes without rebuilding the app.
          </p>
          <p className="ops-field__help">{publishedLessons} published lesson(s) · {draftLessons} draft lesson(s)</p>
        </div>
        <Badge status={enabled ? "positive" : "neutral"}>{enabled ? "Playbook On" : "Legacy On"}</Badge>
      </div>
      <div className="ops-field" style={{ marginTop: 12 }}>
        <label htmlFor="learn-cutover-reason">Release / rollback reason</label>
        <input id="learn-cutover-reason" value={reason} maxLength={2000} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit history" />
      </div>
      <Button size="sm" variant={enabled ? "secondary" : "primary"} disabled={busy || reason.trim().length < 10} onClick={change}>
        {busy ? "Changing…" : enabled ? "Roll Back to Legacy" : "Enable Playbook Cutover"}
      </Button>
      {draftLessons > 0 && !enabled && <p className="ops-field__help" style={{ marginTop: 8 }}>Keep this off until the lessons needed by the first live cohort have been interactively redesigned and published.</p>}
      {error && <p className="ops-error" role="alert">{error}</p>}
    </section>
  );
}
