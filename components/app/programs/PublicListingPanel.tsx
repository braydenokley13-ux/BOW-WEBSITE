"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { setProgramPublicListing } from "@/app/actions/programs";
import type { FullCapacityBehavior, Program, PublicProgramStatus, RegistrationMode } from "@/lib/operations-shared";
import { publicStatusLabel } from "@/lib/operations-shared";

interface Props {
  programId: string;
  program: Pick<
    Program,
    | "isPublic"
    | "publicStatus"
    | "shortDescription"
    | "longDescription"
    | "gradeRange"
    | "imageUrl"
    | "registrationMode"
    | "fullCapacityBehavior"
    | "registrationDeadline"
  >;
}

const fieldStyle: CSSProperties = {
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "var(--font-interface)",
  width: "100%",
};

export default function PublicListingPanel({ programId, program }: Props) {
  const router = useRouter();
  const [shortDescription, setShortDescription] = useState(program.shortDescription ?? "");
  const [longDescription, setLongDescription] = useState(program.longDescription ?? "");
  const [gradeRange, setGradeRange] = useState(program.gradeRange ?? "");
  const [imageUrl, setImageUrl] = useState(program.imageUrl ?? "");
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(program.registrationMode);
  const [fullCapacityBehavior, setFullCapacityBehavior] = useState<FullCapacityBehavior>(program.fullCapacityBehavior);
  const [registrationDeadline, setRegistrationDeadline] = useState(program.registrationDeadline ?? "");
  const [publicStatus, setPublicStatus] = useState<PublicProgramStatus>(program.publicStatus ?? "coming_soon");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (isPublic: boolean) => {
    setBusy(isPublic ? "publish" : "draft");
    setError(null);
    const result = await setProgramPublicListing(programId, {
      isPublic,
      publicStatus: isPublic ? publicStatus : program.publicStatus,
      shortDescription: shortDescription || null,
      longDescription: longDescription || null,
      gradeRange: gradeRange || null,
      imageUrl: imageUrl || null,
      registrationMode,
      fullCapacityBehavior,
      registrationDeadline: registrationDeadline || null,
    });
    if (!result.ok) {
      setError(result.error ?? "The public listing could not be saved.");
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge status={program.isPublic ? "positive" : "neutral"}>{program.isPublic ? "Public" : "Draft"}</Badge>
        {program.isPublic && <span className="ops-record-meta">Visible on /programs as “{publicStatusLabel(program.publicStatus ?? "coming_soon")}”</span>}
      </div>

      <div className="ops-fields">
        <div className="ops-field ops-field--wide">
          <label htmlFor="pl-short">Short description (shown on the public program card)</label>
          <textarea id="pl-short" style={{ ...fieldStyle, minHeight: 64 }} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={400} />
        </div>
        <div className="ops-field ops-field--wide">
          <label htmlFor="pl-long">Longer description (optional)</label>
          <textarea id="pl-long" style={{ ...fieldStyle, minHeight: 90 }} value={longDescription} onChange={(e) => setLongDescription(e.target.value)} maxLength={8000} />
        </div>
        <div className="ops-field">
          <label htmlFor="pl-grades">Grade range</label>
          <input id="pl-grades" style={fieldStyle} value={gradeRange} onChange={(e) => setGradeRange(e.target.value)} placeholder="5–8" />
        </div>
        <div className="ops-field">
          <label htmlFor="pl-image">Image URL</label>
          <input id="pl-image" style={fieldStyle} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div className="ops-field">
          <label htmlFor="pl-status">Public status</label>
          <select id="pl-status" style={fieldStyle} value={publicStatus} onChange={(e) => setPublicStatus(e.target.value as PublicProgramStatus)}>
            <option value="coming_soon">Coming Soon</option>
            <option value="open">Open</option>
            <option value="full">Full</option>
            <option value="closed">Closed</option>
          </select>
          <span className="ops-field__help">Automatically shows as Full once registrations reach capacity.</span>
        </div>
        <div className="ops-field">
          <label htmlFor="pl-mode">Registration mode</label>
          <select id="pl-mode" style={fieldStyle} value={registrationMode} onChange={(e) => setRegistrationMode(e.target.value as RegistrationMode)}>
            <option value="immediate">Immediate — submitting confirms enrollment</option>
            <option value="approval">Approval required — you confirm each registration</option>
          </select>
        </div>
        <div className="ops-field">
          <label htmlFor="pl-full">When capacity is reached</label>
          <select id="pl-full" style={fieldStyle} value={fullCapacityBehavior} onChange={(e) => setFullCapacityBehavior(e.target.value as FullCapacityBehavior)}>
            <option value="waitlist">Allow waitlist</option>
            <option value="close">Close registration</option>
            <option value="continue">Keep accepting</option>
          </select>
        </div>
        <div className="ops-field">
          <label htmlFor="pl-deadline">Registration deadline</label>
          <input id="pl-deadline" type="date" style={fieldStyle} value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} />
        </div>
      </div>

      {error && <p className="ops-error" role="alert">{error}</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => save(false)}>
          {busy === "draft" ? "Saving…" : "Save Draft"}
        </Button>
        <Button type="button" variant="emphasis" disabled={busy !== null} onClick={() => save(true)}>
          {busy === "publish" ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </div>
  );
}
