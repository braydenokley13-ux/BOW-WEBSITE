"use client";

import { useState, useTransition } from "react";
import Badge from "@/components/ds/Badge";
import Button from "@/components/ds/Button";
import ConfirmSubmitButton from "./ConfirmSubmitButton";
import ReasonSubmitButton from "./ReasonSubmitButton";
import type { RegistrationDetail } from "@/lib/program-admin";
import {
  adminExtendReservation,
  adminPlaceInClass,
  adminSendManualOffer,
  approveRequirement,
  confirmEligibility,
  confirmSeat,
  moveToWaitlist,
  rejectIneligible,
  releaseRegistrationSeat,
  restoreRegistration,
  returnRequirementForCorrection,
  updateAdminNotes,
  waiveRequirement,
} from "@/app/actions/registration-admin";

function fmt(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RegistrationDetailPanel({
  detail,
  classId,
}: {
  detail: RegistrationDetail;
  /** The program id is implicit in the page this panel is rendered on; kept
   * off the props here since nothing below needs to link elsewhere with it. */
  programId?: string;
  classId: string | null;
}) {
  const [notes, setNotes] = useState(detail.adminNotes ?? "");
  const [pending, startTransition] = useTransition();
  const [notesSaved, setNotesSaved] = useState(false);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase" }}>Status</div>
          <Badge status="info">{detail.statusLabel}</Badge>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase" }}>Grade</div>
          <div>{detail.grade ?? "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase" }}>Class</div>
          <div>{detail.className ?? "Not placed"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase" }}>Reservation</div>
          <div>{fmt(detail.reservationExpiresAt)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase" }}>Account activation</div>
          <div>{detail.activationState ?? "Not started"}</div>
        </div>
        {detail.duplicateReviewStatus === "open" && (
          <div>
            <Badge status="warning">Possible duplicate child</Badge>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase", marginBottom: 4 }}>Guardians</div>
        {detail.guardians.map((g) => (
          <div key={g.personId} style={{ fontSize: 14 }}>
            {g.name} {g.isPrimary ? "(primary)" : ""} — {g.email ?? "no email"} {g.status !== "active" ? `· ${g.status}` : ""}
          </div>
        ))}
      </div>

      {/* Admin decisions — every button below routes through lib/enrollment.ts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {["under_review", "pending", "submitted"].includes(detail.status) && (
          <>
            <ConfirmSubmitButton
              action={() => confirmEligibility(detail.id)}
              confirmMessage={`Confirm eligibility for ${detail.studentName}? This gives them a seat immediately.`}
            >
              Confirm eligibility
            </ConfirmSubmitButton>
            <ReasonSubmitButton
              action={(reason) => rejectIneligible(detail.id, reason)}
              promptLabel="Why is this registration ineligible? (sent to the family)"
              variant="ghost"
            >
              Reject as ineligible
            </ReasonSubmitButton>
          </>
        )}

        {["seat_reserved", "requirements_pending"].includes(detail.status) && (
          <ReasonSubmitButton
            action={(reason) => adminExtendReservation(detail.id, 72, reason)}
            promptLabel="Reason for extending this reservation (72 hours added):"
            variant="secondary"
          >
            Extend reservation 72h
          </ReasonSubmitButton>
        )}

        {["seat_reserved", "requirements_pending"].includes(detail.status) && (
          <ConfirmSubmitButton
            action={() => confirmSeat(detail.id)}
            confirmMessage={`Confirm this seat for ${detail.studentName}? Any outstanding required forms must already be approved or waived.`}
          >
            Confirm seat
          </ConfirmSubmitButton>
        )}

        {detail.status === "waitlisted" && (
          <ReasonSubmitButton
            action={(reason) => adminSendManualOffer(detail.id, reason)}
            promptLabel="Internal reason for offering this seat to this family:"
            confirmMessage={`Send a waitlist offer to ${detail.studentName}'s family? This takes a seat and starts the offer's expiration clock.`}
          >
            Send waitlist offer
          </ReasonSubmitButton>
        )}

        {["confirmed", "seat_reserved", "requirements_pending"].includes(detail.status) && (
          <ReasonSubmitButton
            action={(reason) => moveToWaitlist(detail.id, reason)}
            promptLabel="Why is this registration moving to the waitlist? (releases the seat)"
          >
            Move to waitlist
          </ReasonSubmitButton>
        )}

        {classId && detail.classId !== classId && detail.holdsSeat && (
          <ReasonSubmitButton
            action={(reason) => adminPlaceInClass(detail.id, classId, reason)}
            promptLabel="Reason for this class placement:"
            confirmMessage="Place this student in the program's primary class?"
          >
            Place in class
          </ReasonSubmitButton>
        )}

        {!["withdrawn", "cancelled", "expired", "declined", "completed"].includes(detail.status) && (
          <>
            <ReasonSubmitButton
              action={(reason) => releaseRegistrationSeat(detail.id, "withdrawn", reason)}
              promptLabel="Reason for withdrawing this registration:"
              confirmMessage={`Withdraw ${detail.studentName}'s registration? This releases the seat.`}
              variant="ghost"
            >
              Withdraw
            </ReasonSubmitButton>
            <ReasonSubmitButton
              action={(reason) => releaseRegistrationSeat(detail.id, "cancelled", reason)}
              promptLabel="Reason for cancelling this registration:"
              confirmMessage={`Cancel ${detail.studentName}'s registration? This releases the seat.`}
              variant="ghost"
            >
              Cancel
            </ReasonSubmitButton>
          </>
        )}

        {["withdrawn", "cancelled", "declined", "expired"].includes(detail.status) && (
          <ReasonSubmitButton
            action={(reason) => restoreRegistration(detail.id, reason)}
            promptLabel="Reason for restoring this registration to the waitlist:"
          >
            Restore to waitlist
          </ReasonSubmitButton>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase", marginBottom: 4 }}>Requirements</div>
        {detail.requirements.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>This program has no requirements attached to this registration.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {detail.requirements.map((r) => (
              <div key={r.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <strong>{r.prompt}</strong>{" "}
                    {r.blocksConfirmation && <Badge status="warning">Blocks confirmation</Badge>}
                    <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
                      Status: {r.status} · Visibility: {r.visibility} {r.dueAt ? `· Due ${fmt(r.dueAt)}` : ""}
                    </div>
                    {r.response && <div style={{ fontSize: 13, marginTop: 4 }}>Response: {r.response}</div>}
                  </div>
                  {!["approved", "waived"].includes(r.status) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <ConfirmSubmitButton
                        action={() => approveRequirement(r.id, null)}
                        confirmMessage="Approve this requirement's response?"
                        size="sm"
                      >
                        Approve
                      </ConfirmSubmitButton>
                      <ReasonSubmitButton
                        action={(note) => returnRequirementForCorrection(r.id, note)}
                        promptLabel="What needs to be corrected? (sent to the family)"
                        size="sm"
                        variant="ghost"
                      >
                        Return for correction
                      </ReasonSubmitButton>
                      {!["medical", "waiver", "emergency_contact"].includes(r.kind) && (
                        <ReasonSubmitButton
                          action={(reason) => waiveRequirement(r.id, reason)}
                          promptLabel="Why waive this requirement?"
                          size="sm"
                          variant="ghost"
                        >
                          Waive
                        </ReasonSubmitButton>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase", marginBottom: 4 }}>Admin notes</div>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaved(false);
          }}
          rows={3}
          style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
        />
        <div style={{ marginTop: 6 }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateAdminNotes(detail.id, notes);
                setNotesSaved(result.ok);
              })
            }
          >
            {pending ? "Saving…" : notesSaved ? "Saved" : "Save notes"}
          </Button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase", marginBottom: 4 }}>Audit history</div>
        <div style={{ display: "grid", gap: 4, maxHeight: 220, overflowY: "auto" }}>
          {detail.auditEvents.map((a) => (
            <div key={a.id} style={{ fontSize: 12, color: "var(--bow-slate)" }}>
              {fmt(a.createdAt)} — {a.actorLabel}: {a.action} {a.previousState ? `(${a.previousState} → ${a.newState})` : ""}{" "}
              {a.reason ? `— ${a.reason}` : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
