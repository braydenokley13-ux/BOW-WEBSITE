"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import {
  advanceInstructorDevelopmentItem,
  createInstructorDevelopmentItem,
  recordInstructorFeedback,
  resolveInstructorDevelopmentItem,
  revokeInstructorQualification,
  updateInstructorWorkforceProfile,
  upsertInstructorQualification,
} from "@/app/actions/instructor-quality";
import type {
  FeedbackContextOptions,
  NamedOption,
  QualificationOptionGroups,
} from "@/lib/instructor-workforce";

type QualificationKind = keyof QualificationOptionGroups;

interface Props {
  instructorId: string;
  instructorName: string;
  stage: string;
  progressionLevel: string;
  maxWeeklyClasses: number;
  developmentFocus: string | null;
  staffUsers: { id: string; name: string }[];
  qualificationOptions: QualificationOptionGroups;
  feedbackContextOptions: FeedbackContextOptions;
  qualifications: { id: string; kind: string; label: string; status: string }[];
  developmentItems: { id: string; title: string; kind: string; stage: string; status: string }[];
}

const QUALIFICATION_LABELS: Record<QualificationKind, string> = {
  curriculum: "Curriculum",
  age_group: "Age group",
  format: "Delivery format",
  role: "Teaching role",
  location: "Location",
  region: "Region",
};

const NEXT_STAGE_LABEL: Record<string, string | null> = {
  identified: "Plan created",
  concern_identified: "Plan created",
  planned: "In progress",
  plan_created: "In progress",
  in_progress: "Evidence review",
  evidence_review: null,
  recognized: null,
};

const SOURCE_OPTIONS = [
  ["staff_observation", "Staff observation"],
  ["partner", "Partner"],
  ["parent_guardian", "Parent or guardian"],
  ["student", "Student"],
  ["peer", "Instructor peer"],
  ["self", "Instructor self-reflection"],
] as const;

const DEVELOPMENT_OPTIONS = [
  ["goal", "Development goal"],
  ["coaching", "Coaching plan"],
  ["training", "Targeted training"],
  ["observation", "Follow-up observation"],
  ["concern", "Quality concern"],
  ["recognition", "Recognition"],
] as const;

function SelectOptions({ options, emptyLabel }: { options: NamedOption[]; emptyLabel?: string }) {
  return (
    <>
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </>
  );
}

export default function InstructorWorkforceActions({
  instructorId,
  instructorName,
  stage,
  progressionLevel,
  maxWeeklyClasses,
  developmentFocus,
  staffUsers,
  qualificationOptions,
  feedbackContextOptions,
  qualifications,
  developmentItems,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [profileLevel, setProfileLevel] = useState(progressionLevel);
  const [profileCapacity, setProfileCapacity] = useState(String(maxWeeklyClasses));
  const [profileFocus, setProfileFocus] = useState(developmentFocus ?? "");

  const [qualificationKind, setQualificationKind] = useState<QualificationKind>("curriculum");
  const [qualificationValue, setQualificationValue] = useState(qualificationOptions.curriculum[0]?.id ?? "");
  const [qualificationExpiry, setQualificationExpiry] = useState("");
  const [qualificationNotes, setQualificationNotes] = useState("");

  const [feedbackSource, setFeedbackSource] = useState<(typeof SOURCE_OPTIONS)[number][0]>("staff_observation");
  const [feedbackAuthor, setFeedbackAuthor] = useState("");
  const [feedbackClass, setFeedbackClass] = useState("");
  const [feedbackProgram, setFeedbackProgram] = useState("");
  const [feedbackPartner, setFeedbackPartner] = useState("");
  const [feedbackSession, setFeedbackSession] = useState("");
  const [curriculumRating, setCurriculumRating] = useState("");
  const [relationshipsRating, setRelationshipsRating] = useState("");
  const [reliabilityRating, setReliabilityRating] = useState("");
  const [leadershipRating, setLeadershipRating] = useState("");
  const [feedbackStrengths, setFeedbackStrengths] = useState("");
  const [feedbackConcerns, setFeedbackConcerns] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [feedbackFollowUp, setFeedbackFollowUp] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpOwner, setFollowUpOwner] = useState("");
  const [followUpDue, setFollowUpDue] = useState("");

  const [developmentKind, setDevelopmentKind] = useState<(typeof DEVELOPMENT_OPTIONS)[number][0]>("goal");
  const [developmentTitle, setDevelopmentTitle] = useState("");
  const [developmentOwner, setDevelopmentOwner] = useState("");
  const [developmentDue, setDevelopmentDue] = useState("");
  const [developmentNotes, setDevelopmentNotes] = useState("");
  const [resolutionItem, setResolutionItem] = useState<{ id: string; title: string } | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState("");

  const activeInstructor = !["inactive", "rejected"].includes(stage);
  const activeQualifications = qualifications.filter((qualification) => qualification.status === "approved");
  const openDevelopment = developmentItems.filter((item) => item.status === "open");
  const lowRating = [curriculumRating, relationshipsRating, reliabilityRating, leadershipRating].some(
    (value) => value !== "" && Number(value) <= 2,
  );
  const feedbackNeedsFollowUp = feedbackFollowUp || feedbackConcerns.trim().length > 0 || lowRating;
  const qualificationValues = qualificationOptions[qualificationKind];
  const canSaveFeedback =
    [curriculumRating, relationshipsRating, reliabilityRating, leadershipRating].some(Boolean) ||
    Boolean(feedbackStrengths.trim() || feedbackConcerns.trim() || feedbackBody.trim());

  const run = async (key: string, operation: () => Promise<{ ok: boolean; error?: string }>, success: string): Promise<boolean> => {
    setBusy(key);
    setMessage(null);
    try {
      const result = await operation();
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error ?? "The change could not be saved." });
        return false;
      }
      setMessage({ tone: "success", text: success });
      router.refresh();
      return true;
    } catch {
      setMessage({ tone: "error", text: "The change could not be saved. Refresh and try again." });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const changeQualificationKind = (kind: QualificationKind) => {
    setQualificationKind(kind);
    setQualificationValue(qualificationOptions[kind][0]?.id ?? "");
  };

  const ratingFields: { label: string; id: string; value: string; setter: (value: string) => void }[] = [
    { label: "Curriculum delivery", id: "feedback-curriculum", value: curriculumRating, setter: setCurriculumRating },
    { label: "Student & family relationships", id: "feedback-relationships", value: relationshipsRating, setter: setRelationshipsRating },
    { label: "Organization & reliability", id: "feedback-reliability", value: reliabilityRating, setter: setReliabilityRating },
    { label: "Leadership contribution", id: "feedback-leadership", value: leadershipRating, setter: setLeadershipRating },
  ];

  return (
    <section id="workforce-controls" className="ops-panel ops-panel--signal ops-anchor" aria-labelledby="workforce-controls-title">
      <div className="ops-section-head">
        <div>
          <span className="ops-label">Manager workspace</span>
          <h2 id="workforce-controls-title" className="ops-section-title">Turn evidence into action</h2>
        </div>
        <p className="ops-section-note">
          Approvals change staffing fit. Concerns create owned development and Work in the same transaction.
        </p>
      </div>

      {!activeInstructor && (
        <div className="ops-alert" data-tone="warning" style={{ marginBottom: 20 }}>
          <p className="ops-alert__title">Historical dossier</p>
          <p className="ops-body" style={{ marginTop: 5 }}>
            New approvals, feedback, and plans are locked because this instructor is {stage}. Existing approvals can be revoked and open plans can still be resolved.
          </p>
        </div>
      )}

      {message && (
        <p className={message.tone === "error" ? "ops-error" : "ops-success"} role={message.tone === "error" ? "alert" : "status"} aria-live="polite" style={{ marginBottom: 18 }}>
          {message.text}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <details open>
          <summary className="ops-record-name" style={{ cursor: "pointer", fontSize: 20 }}>Workforce profile</summary>
          <form
            className="ops-fields"
            style={{ marginTop: 18 }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "profile",
                () => updateInstructorWorkforceProfile({
                  instructorId,
                  progressionLevel: profileLevel,
                  maxWeeklyClasses: Number(profileCapacity),
                  developmentFocus: profileFocus,
                }),
                "Workforce profile updated.",
              );
            }}
          >
            <div className="ops-field">
              <label htmlFor="workforce-progression">Progression level</label>
              <select id="workforce-progression" value={profileLevel} onChange={(event) => setProfileLevel(event.target.value)} disabled={!activeInstructor || busy !== null}>
                <option value="instructor">Instructor</option>
                <option value="senior_instructor">Senior instructor</option>
                <option value="lead_instructor">Lead instructor</option>
                <option value="instructor_coach">Instructor coach</option>
                <option value="regional_leader">Regional leader</option>
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="workforce-capacity">Maximum weekly Classes</label>
              <input id="workforce-capacity" type="number" min={1} max={20} value={profileCapacity} onChange={(event) => setProfileCapacity(event.target.value)} disabled={!activeInstructor || busy !== null} required />
            </div>
            <div className="ops-field ops-field--wide">
              <label htmlFor="workforce-focus">Current development focus</label>
              <textarea id="workforce-focus" maxLength={1200} value={profileFocus} onChange={(event) => setProfileFocus(event.target.value)} disabled={!activeInstructor || busy !== null} placeholder="The one capability leadership is intentionally developing next." />
            </div>
            <div className="ops-form-footer ops-field--wide">
              <Button type="submit" size="sm" disabled={!activeInstructor || busy !== null}>
                {busy === "profile" ? "Saving…" : "Save Workforce Profile"}
              </Button>
            </div>
          </form>
        </details>

        <details>
          <summary className="ops-record-name" style={{ cursor: "pointer", fontSize: 20 }}>Teaching approvals</summary>
          <div style={{ marginTop: 18 }}>
            {activeQualifications.length > 0 && (
              <div className="ops-list" style={{ marginBottom: 20 }}>
                {activeQualifications.map((qualification) => (
                  <div className="ops-list-row ops-list-row--compact" key={qualification.id}>
                    <div>
                      <span className="ops-record-name" style={{ fontSize: 17 }}>{qualification.label}</span>
                      <span className="ops-record-meta">{qualification.kind.replace(/_/g, " ")} approval</span>
                    </div>
                    <span className="ops-body">Active in staffing recommendations</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => void run(
                        `revoke-${qualification.id}`,
                        () => revokeInstructorQualification(instructorId, qualification.id),
                        `${qualification.label} approval revoked.`,
                      )}
                      aria-label={`Revoke ${qualification.label} approval`}
                    >
                      {busy === `revoke-${qualification.id}` ? "Revoking…" : "Revoke"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <form
              className="ops-fields"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  "qualification",
                  () => upsertInstructorQualification({
                    instructorId,
                    kind: qualificationKind,
                    value: qualificationValue,
                    expiresOn: qualificationExpiry || null,
                    notes: qualificationNotes,
                  }),
                  "Teaching approval saved and staffing fit refreshed.",
                ).then((saved) => {
                  if (saved) {
                    setQualificationExpiry("");
                    setQualificationNotes("");
                  }
                });
              }}
            >
              <div className="ops-field">
                <label htmlFor="qualification-kind">Approval type</label>
                <select id="qualification-kind" value={qualificationKind} onChange={(event) => changeQualificationKind(event.target.value as QualificationKind)} disabled={!activeInstructor || busy !== null}>
                  {(Object.keys(QUALIFICATION_LABELS) as QualificationKind[]).map((kind) => (
                    <option value={kind} key={kind}>{QUALIFICATION_LABELS[kind]}</option>
                  ))}
                </select>
              </div>
              <div className="ops-field">
                <label htmlFor="qualification-value">Approved scope</label>
                <select id="qualification-value" value={qualificationValue} onChange={(event) => setQualificationValue(event.target.value)} disabled={!activeInstructor || busy !== null || qualificationValues.length === 0} required>
                  {qualificationValues.length === 0 ? <option value="">No available records</option> : <SelectOptions options={qualificationValues} />}
                </select>
              </div>
              <div className="ops-field">
                <label htmlFor="qualification-expiry">Expires on <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                <input id="qualification-expiry" type="date" aria-describedby="qualification-expiry-help" value={qualificationExpiry} onChange={(event) => setQualificationExpiry(event.target.value)} disabled={!activeInstructor || busy !== null} />
                <span id="qualification-expiry-help" className="ops-field__help">Calendar date only; device timezone does not change it.</span>
              </div>
              <div className="ops-field">
                <label htmlFor="qualification-notes">Approval evidence <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                <input id="qualification-notes" maxLength={1200} value={qualificationNotes} onChange={(event) => setQualificationNotes(event.target.value)} disabled={!activeInstructor || busy !== null} placeholder="Observation, prior Class, credential, or decision context" />
              </div>
              <div className="ops-form-footer ops-field--wide">
                <Button type="submit" size="sm" disabled={!activeInstructor || busy !== null || !qualificationValue}>
                  {busy === "qualification" ? "Approving…" : "Grant Approval"}
                </Button>
              </div>
            </form>
          </div>
        </details>

        <details>
          <summary className="ops-record-name" style={{ cursor: "pointer", fontSize: 20 }}>Record multidimensional feedback</summary>
          <form
            className="ops-fields"
            style={{ marginTop: 18 }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                "feedback",
                () => recordInstructorFeedback({
                  instructorId,
                  sourceType: feedbackSource,
                  authorName: feedbackAuthor,
                  classId: feedbackClass,
                  programId: feedbackProgram,
                  partnerOrgId: feedbackPartner,
                  sessionId: feedbackSession,
                  curriculumDelivery: curriculumRating ? Number(curriculumRating) : null,
                  studentFamilyRelationships: relationshipsRating ? Number(relationshipsRating) : null,
                  organizationReliability: reliabilityRating ? Number(reliabilityRating) : null,
                  leadershipContribution: leadershipRating ? Number(leadershipRating) : null,
                  strengths: feedbackStrengths,
                  concerns: feedbackConcerns,
                  body: feedbackBody,
                  followUpRequired: feedbackFollowUp,
                  followUpTitle,
                  followUpOwnerUserId: followUpOwner,
                  followUpDueOn: followUpDue || null,
                }),
                feedbackNeedsFollowUp ? "Feedback saved with owned development and Work follow-up." : "Feedback added to the quality record.",
              ).then((saved) => {
                if (!saved) return;
                setFeedbackAuthor("");
                setFeedbackClass("");
                setFeedbackProgram("");
                setFeedbackPartner("");
                setFeedbackSession("");
                setCurriculumRating("");
                setRelationshipsRating("");
                setReliabilityRating("");
                setLeadershipRating("");
                setFeedbackStrengths("");
                setFeedbackConcerns("");
                setFeedbackBody("");
                setFeedbackFollowUp(false);
                setFollowUpTitle("");
                setFollowUpOwner("");
                setFollowUpDue("");
              });
            }}
          >
            <div className="ops-field">
              <label htmlFor="feedback-source">Evidence source</label>
              <select id="feedback-source" value={feedbackSource} onChange={(event) => setFeedbackSource(event.target.value as typeof feedbackSource)} disabled={!activeInstructor || busy !== null}>
                {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="feedback-author">Source name {feedbackSource === "staff_observation" ? "(optional)" : ""}</label>
              <input id="feedback-author" maxLength={120} value={feedbackAuthor} onChange={(event) => setFeedbackAuthor(event.target.value)} disabled={!activeInstructor || busy !== null} required={feedbackSource !== "staff_observation"} placeholder={feedbackSource === "staff_observation" ? "Defaults to your name" : "Person or group providing the feedback"} />
            </div>

            <div className="ops-field">
              <label htmlFor="feedback-session">Class session <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
              <select
                id="feedback-session"
                value={feedbackSession}
                onChange={(event) => {
                  const sessionId = event.target.value;
                  setFeedbackSession(sessionId);
                  if (sessionId) {
                    // A session is the most specific source of truth. Clear
                    // broader manual context so stale selections cannot
                    // contradict the session's canonical Class/Program/partner.
                    setFeedbackClass("");
                    setFeedbackProgram("");
                    setFeedbackPartner("");
                  }
                }}
                disabled={!activeInstructor || busy !== null}
              >
                <SelectOptions options={feedbackContextOptions.sessions} emptyLabel="No specific session" />
              </select>
              <span className="ops-field__help">A session automatically resolves its Class, Program, and partner.</span>
            </div>
            <div className="ops-field">
              <label htmlFor="feedback-class">Class <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
              <select id="feedback-class" value={feedbackClass} onChange={(event) => setFeedbackClass(event.target.value)} disabled={!activeInstructor || busy !== null || Boolean(feedbackSession)}>
                <SelectOptions options={feedbackContextOptions.classes} emptyLabel="No specific Class" />
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="feedback-program">Program <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
              <select id="feedback-program" value={feedbackProgram} onChange={(event) => setFeedbackProgram(event.target.value)} disabled={!activeInstructor || busy !== null || Boolean(feedbackSession)}>
                <SelectOptions options={feedbackContextOptions.programs} emptyLabel="No specific Program" />
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="feedback-partner">Partner <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
              <select id="feedback-partner" value={feedbackPartner} onChange={(event) => setFeedbackPartner(event.target.value)} disabled={!activeInstructor || busy !== null || Boolean(feedbackSession)}>
                <SelectOptions options={feedbackContextOptions.partners} emptyLabel="No specific partner" />
              </select>
            </div>

            <fieldset className="ops-field ops-field--wide" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ops-field__label" style={{ marginBottom: 9 }}>Ratings (1–5, leave unknown dimensions blank)</legend>
              <div className="ops-fields">
                {ratingFields.map(({ label, id, value, setter }) => (
                  <div className="ops-field" key={id}>
                    <label htmlFor={id}>{label}</label>
                    <select id={id} value={value} onChange={(event) => setter(event.target.value)} disabled={!activeInstructor || busy !== null}>
                      <option value="">Not observed</option>
                      {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="ops-field ops-field--wide">
              <label htmlFor="feedback-body">Evidence summary</label>
              <textarea id="feedback-body" maxLength={4000} value={feedbackBody} onChange={(event) => setFeedbackBody(event.target.value)} disabled={!activeInstructor || busy !== null} placeholder="What was observed or reported? Keep this factual and decision-useful." />
            </div>
            <div className="ops-field">
              <label htmlFor="feedback-strengths">Strengths</label>
              <textarea id="feedback-strengths" maxLength={2000} value={feedbackStrengths} onChange={(event) => setFeedbackStrengths(event.target.value)} disabled={!activeInstructor || busy !== null} />
            </div>
            <div className="ops-field">
              <label htmlFor="feedback-concerns">Concerns</label>
              <textarea id="feedback-concerns" maxLength={2000} value={feedbackConcerns} onChange={(event) => setFeedbackConcerns(event.target.value)} disabled={!activeInstructor || busy !== null} />
              <span className="ops-field__help">Any concern or rating of 1–2 requires an owner and due date.</span>
            </div>
            <div className="ops-field ops-field--wide">
              <label style={{ display: "flex", gap: 8, alignItems: "center", textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={feedbackFollowUp} onChange={(event) => setFeedbackFollowUp(event.target.checked)} disabled={!activeInstructor || busy !== null} />
                Open coaching follow-up even without a concern
              </label>
            </div>
            {feedbackNeedsFollowUp && (
              <>
                <div className="ops-field">
                  <label htmlFor="feedback-followup-title">Follow-up title <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
                  <input id="feedback-followup-title" maxLength={180} value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} disabled={!activeInstructor || busy !== null} placeholder={`Quality follow-up: ${instructorName}`} />
                </div>
                <div className="ops-field">
                  <label htmlFor="feedback-followup-owner">Follow-up owner</label>
                  <select id="feedback-followup-owner" value={followUpOwner} onChange={(event) => setFollowUpOwner(event.target.value)} disabled={!activeInstructor || busy !== null} required>
                    <SelectOptions options={staffUsers.map((user) => ({ id: user.id, label: user.name }))} emptyLabel="Choose an owner" />
                  </select>
                </div>
                <div className="ops-field">
                  <label htmlFor="feedback-followup-due">Follow-up due date</label>
                  <input id="feedback-followup-due" type="date" aria-describedby="feedback-followup-due-help" value={followUpDue} onChange={(event) => setFollowUpDue(event.target.value)} disabled={!activeInstructor || busy !== null} required />
                  <span id="feedback-followup-due-help" className="ops-field__help">Calendar date only; device timezone does not change it.</span>
                </div>
              </>
            )}
            <div className="ops-form-footer ops-field--wide">
              <Button type="submit" size="sm" disabled={!activeInstructor || busy !== null || !canSaveFeedback || (feedbackNeedsFollowUp && (!followUpOwner || !followUpDue))}>
                {busy === "feedback" ? "Recording…" : feedbackNeedsFollowUp ? "Record + Open Follow-Up" : "Record Feedback"}
              </Button>
            </div>
          </form>
        </details>

        <details>
          <summary className="ops-record-name" style={{ cursor: "pointer", fontSize: 20 }}>Development &amp; recognition</summary>
          <div style={{ marginTop: 18 }}>
            {openDevelopment.length > 0 && (
              <div className="ops-list" style={{ marginBottom: 22 }}>
                {openDevelopment.map((item) => {
                  const nextLabel = NEXT_STAGE_LABEL[item.stage] ?? null;
                  return (
                    <div className="ops-list-row ops-list-row--compact" key={item.id}>
                      <div>
                        <span className="ops-record-name" style={{ fontSize: 17 }}>{item.title}</span>
                        <span className="ops-record-meta">{item.kind.replace(/_/g, " ")}</span>
                      </div>
                      <span className="ops-body">{item.stage.replace(/_/g, " ")}</span>
                      <div className="ops-actions">
                        {nextLabel && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!activeInstructor || busy !== null}
                            onClick={() => void run(
                              `advance-${item.id}`,
                              () => advanceInstructorDevelopmentItem(instructorId, item.id),
                              `${item.title} advanced to ${nextLabel.toLowerCase()}.`,
                            )}
                          >
                            {busy === `advance-${item.id}` ? "Advancing…" : `Advance to ${nextLabel}`}
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => { setResolutionOutcome(""); setResolutionItem({ id: item.id, title: item.title }); }}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <form
              className="ops-fields"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  "development",
                  () => createInstructorDevelopmentItem({
                    instructorId,
                    kind: developmentKind,
                    title: developmentTitle,
                    ownerUserId: developmentOwner,
                    dueOn: developmentDue || null,
                    notes: developmentNotes,
                  }),
                  developmentKind === "concern" ? "Concern saved with atomic Work follow-up." : `${developmentKind === "recognition" ? "Recognition" : "Development item"} recorded.`,
                ).then((saved) => {
                  if (saved) {
                    setDevelopmentTitle("");
                    setDevelopmentDue("");
                    setDevelopmentNotes("");
                  }
                });
              }}
            >
              <div className="ops-field">
                <label htmlFor="development-kind">Record type</label>
                <select id="development-kind" value={developmentKind} onChange={(event) => setDevelopmentKind(event.target.value as typeof developmentKind)} disabled={!activeInstructor || busy !== null}>
                  {DEVELOPMENT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="ops-field">
                <label htmlFor="development-title">Title</label>
                <input id="development-title" maxLength={180} value={developmentTitle} onChange={(event) => setDevelopmentTitle(event.target.value)} disabled={!activeInstructor || busy !== null} required placeholder="A clear outcome, capability, or contribution" />
              </div>
              <div className="ops-field">
                <label htmlFor="development-owner">Owner</label>
                <select id="development-owner" value={developmentOwner} onChange={(event) => setDevelopmentOwner(event.target.value)} disabled={!activeInstructor || busy !== null} required>
                  <SelectOptions options={staffUsers.map((user) => ({ id: user.id, label: user.name }))} emptyLabel="Choose an owner" />
                </select>
              </div>
              <div className="ops-field">
                <label htmlFor="development-due">Due date {developmentKind === "recognition" ? "(optional)" : ""}</label>
                <input id="development-due" type="date" aria-describedby="development-due-help" value={developmentDue} onChange={(event) => setDevelopmentDue(event.target.value)} disabled={!activeInstructor || busy !== null} required={developmentKind !== "recognition"} />
                <span id="development-due-help" className="ops-field__help">Calendar date only; device timezone does not change it.</span>
              </div>
              <div className="ops-field ops-field--wide">
                <label htmlFor="development-notes">Evidence and plan</label>
                <textarea id="development-notes" maxLength={4000} value={developmentNotes} onChange={(event) => setDevelopmentNotes(event.target.value)} disabled={!activeInstructor || busy !== null} required={developmentKind === "concern"} placeholder={developmentKind === "recognition" ? "What contribution should leadership recognize?" : "What evidence supports this item, and what will better look like?"} />
              </div>
              <div className="ops-form-footer ops-field--wide">
                <Button type="submit" size="sm" disabled={!activeInstructor || busy !== null || !developmentTitle.trim() || !developmentOwner || (developmentKind !== "recognition" && !developmentDue)}>
                  {busy === "development" ? "Recording…" : developmentKind === "concern" ? "Open Concern + Work" : "Add to Dossier"}
                </Button>
              </div>
            </form>
          </div>
        </details>
      </div>

      <Modal open={resolutionItem !== null} onClose={() => setResolutionItem(null)} title="Resolve Development Item" dismissible={busy === null}>
        <p className="ops-body" style={{ marginBottom: 14 }}>
          Document the observable outcome for <strong>{resolutionItem?.title}</strong>. If this item created Work, that Work item closes in the same transaction.
        </p>
        <div className="ops-field">
          <label htmlFor="development-resolution">Resolution outcome</label>
          <textarea id="development-resolution" maxLength={2000} value={resolutionOutcome} onChange={(event) => setResolutionOutcome(event.target.value)} disabled={busy !== null} autoFocus />
        </div>
        <div style={{ marginTop: 14 }}>
          <Button
            full
            disabled={busy !== null || resolutionOutcome.trim().length < 3 || !resolutionItem}
            onClick={() => {
              if (!resolutionItem) return;
              void run(
                `resolve-${resolutionItem.id}`,
                () => resolveInstructorDevelopmentItem(instructorId, resolutionItem.id, resolutionOutcome),
                `${resolutionItem.title} resolved with a documented outcome.`,
              ).then((saved) => {
                if (saved) {
                  setResolutionItem(null);
                  setResolutionOutcome("");
                }
              });
            }}
          >
            {busy?.startsWith("resolve-") ? "Resolving…" : "Record Outcome + Resolve"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
