"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { recordIntroduction, setIntroductionStatus } from "@/app/actions/flywheel";
import { Badge, Button } from "@/components/ds";
import { INTRODUCTION_TARGET_KINDS, type GrowthIntroduction } from "@/lib/flywheel-shared";

const STATUS_TONE: Record<GrowthIntroduction["status"], "positive" | "warning" | "negative" | "neutral"> = {
  suggested: "warning",
  contacted: "neutral",
  converted: "positive",
  declined: "negative",
};

const KIND_LABEL: Record<(typeof INTRODUCTION_TARGET_KINDS)[number], string> = {
  student: "Student(s)",
  instructor: "Future instructor",
  partner: "School / partner org",
  community: "Club / community",
};

/**
 * Tracks the introductions a person can unlock — their school, a club, a
 * future instructor — from suggestion through conversion. No quotas, no
 * gamification: just whether the door was opened and what happened.
 */
export default function IntroductionTracker({
  introducerType,
  introducerId,
  introductions,
}: {
  introducerType: GrowthIntroduction["introducerType"];
  introducerId: string;
  introductions: GrowthIntroduction[];
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const run = async (key: string, work: () => Promise<{ ok: boolean; error?: string }>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(key);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "The update failed. Nothing changed.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("The update failed. Nothing changed; try again.");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await run("add", () =>
      recordIntroduction({
        introducerType,
        introducerId,
        targetKind: String(data.get("targetKind") ?? ""),
        targetName: String(data.get("targetName") ?? ""),
        note: String(data.get("note") ?? ""),
      }),
    );
    if (ok) {
      form.reset();
      setAdding(false);
    }
  };

  return (
    <section className="ops-panel ops-panel--flat ops-anchor" aria-labelledby="introductions-heading">
      <div className="ops-section-head">
        <div>
          <span className="ops-label">Growth</span>
          <h2 className="ops-section-title" id="introductions-heading">Introductions</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding((value) => !value)}>
          {adding ? "Cancel" : "Record introduction"}
        </Button>
      </div>
      {error && <p className="ops-error" role="alert">{error}</p>}

      {adding && (
        <form className="ops-fields" onSubmit={submit} style={{ marginBottom: 18 }}>
          <div className="ops-field">
            <label htmlFor="intro-kind">Introduction to</label>
            <select id="intro-kind" name="targetKind" defaultValue="partner" required>
              {INTRODUCTION_TARGET_KINDS.map((kind) => (
                <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="intro-name">Who / what</label>
            <input id="intro-name" name="targetName" required minLength={2} placeholder="e.g. Lincoln High chess club" />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="intro-note">Context (optional)</label>
            <input id="intro-note" name="note" placeholder="How this came up, who to contact" />
          </div>
          <div className="ops-field ops-field--wide" style={{ alignItems: "flex-end" }}>
            <Button size="sm" type="submit" disabled={busy === "add"}>{busy === "add" ? "Saving…" : "Save introduction"}</Button>
          </div>
        </form>
      )}

      {introductions.length === 0 ? (
        !adding && (
          <p className="ops-body" style={{ margin: 0 }}>
            No introductions tracked yet. One warm door — a school, a club, a future instructor — is often worth a whole campaign.
          </p>
        )
      ) : (
        <div className="ops-list">
          {introductions.map((intro) => (
            <article className="ops-list-row ops-list-row--compact" key={intro.id}>
              <div>
                <span className="ops-record-name">{intro.targetName}</span>
                <span className="ops-record-meta">
                  {KIND_LABEL[intro.targetKind]}{intro.note ? ` · ${intro.note}` : ""}
                </span>
              </div>
              <Badge status={STATUS_TONE[intro.status]}>{intro.status}</Badge>
              <div className="ops-row-actions">
                {intro.status === "suggested" && (
                  <Button size="sm" variant="secondary" disabled={busy === intro.id} onClick={() => run(intro.id, () => setIntroductionStatus(intro.id, "contacted"))}>
                    Mark contacted
                  </Button>
                )}
                {intro.status === "contacted" && (
                  <>
                    <Button size="sm" variant="primary" disabled={busy === intro.id} onClick={() => run(intro.id, () => setIntroductionStatus(intro.id, "converted"))}>
                      Converted
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === intro.id} onClick={() => run(intro.id, () => setIntroductionStatus(intro.id, "declined"))}>
                      Declined
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
