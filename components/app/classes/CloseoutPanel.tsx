"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateClassCloseout } from "@/app/actions/flywheel";
import { Badge } from "@/components/ds";
import { CLOSEOUT_FIELDS, type ClassCloseout } from "@/lib/flywheel-shared";

/**
 * Post-program closeout checklist. A completed class isn't finished until it
 * has produced its proof: feedback, testimonial, referral prompts, partner
 * follow-up, and a conscious repeat decision.
 */
export default function CloseoutPanel({ closeout }: { closeout: ClassCloseout }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busyField, setBusyField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneCount = CLOSEOUT_FIELDS.filter((field) => closeout.fields[field.key]).length;

  const toggle = async (field: (typeof CLOSEOUT_FIELDS)[number]["key"], checked: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyField(field);
    setError(null);
    try {
      const result = await updateClassCloseout(closeout.classId, field, checked);
      if (!result.ok) setError(result.error ?? "Could not update the closeout.");
      else router.refresh();
    } catch {
      setError("Could not update the closeout. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusyField(null);
    }
  };

  return (
    <section className="ops-panel ops-panel--signal ops-anchor" aria-labelledby="closeout-heading">
      <div className="ops-section-head">
        <div>
          <span className="ops-label">Closeout</span>
          <h2 className="ops-section-title" id="closeout-heading">Turn this class into growth</h2>
        </div>
        <Badge status={closeout.completedAt ? "positive" : doneCount > 0 ? "warning" : "neutral"}>
          {closeout.completedAt ? "Closed out" : `${doneCount}/${CLOSEOUT_FIELDS.length}`}
        </Badge>
      </div>
      {error && <p className="ops-error" role="alert">{error}</p>}
      <div className="ops-checklist">
        {CLOSEOUT_FIELDS.map((field) => {
          const checked = closeout.fields[field.key];
          return (
            <label className="ops-check" data-state={checked ? "complete" : undefined} key={field.key} style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={checked}
                disabled={busyField === field.key}
                onChange={(event) => toggle(field.key, event.currentTarget.checked)}
                style={{ width: 14, height: 14, marginTop: 3 }}
              />
              <span className="ops-check__name">{field.label}</span>
              <span className="ops-check__detail">{field.help}</span>
              <span aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </section>
  );
}
