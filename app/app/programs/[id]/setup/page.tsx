import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { PageHeader, PageSection, Badge } from "@/components/ds";
import { registrationReadiness } from "@/lib/program-admin";
import {
  saveProgramBasics,
  saveProgramCapacity,
  saveProgramCommunication,
  saveProgramCompletion,
  saveProgramRegistration,
  saveProgramSchedule,
  saveProgramWaitlist,
} from "@/app/actions/program-setup";
import OpenRegistrationButton from "@/components/admin/enrollment/OpenRegistrationButton";
import DuplicateSetupButton from "@/components/admin/enrollment/DuplicateSetupButton";

interface ProgramRow {
  id: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  internal_description: string | null;
  audience: string | null;
  delivery_format: string | null;
  grade_min: number | null;
  grade_max: number | null;
  experience_level: string | null;
  location_id: string | null;
  schedule_timezone: string | null;
  start_date: string | null;
  end_date: string | null;
  schedule_label: string | null;
  schedule_day: number | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  capacity: number | null;
  minimum_enrollment: number | null;
  registration_deadline: string | null;
  registration_mode: string;
  is_public: boolean;
  public_status: string | null;
  registration_opens_at: string | null;
  reservation_enabled: boolean;
  reservation_hours: number;
  waitlist_mode: string;
  waitlist_offer_hours: number;
  confirmation_message: string | null;
  next_steps_message: string | null;
  support_contact: string | null;
  what_to_bring: string | null;
  completion_min_attendance: number | null;
  completion_requires_instructor: boolean;
  completion_requires_admin: boolean;
  certificate_enabled: boolean;
  feedback_enabled: boolean;
  recommended_next_program_id: string | null;
  prerequisite_program_id: string | null;
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: 8,
  border: "1px solid var(--border-rule)",
  borderRadius: 6,
  fontFamily: "inherit",
  fontSize: 14,
};
const fieldLabel: React.CSSProperties = { fontSize: 12, color: "var(--bow-slate)" };
const checkboxLabel: React.CSSProperties = { fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };

export default async function ProgramSetupPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const db = getDb();
  const program = (await db.prepare("SELECT * FROM programs WHERE id = ?").get(id)) as ProgramRow | undefined;
  if (!program) notFound();

  const locations = (await db.prepare("SELECT id, name FROM locations ORDER BY name").all()) as { id: string; name: string }[];
  const readiness = await registrationReadiness(id);

  return (
    <div>
      <PageHeader
        eyebrow="Programs · Setup"
        title={program.name}
        context="A program starts as a draft — every section below saves independently and incomplete work is fine."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <DuplicateSetupButton sourceProgramId={id} programName={program.name} />
            <Link href={`/app/programs/${id}/enrollment`} className="bow-button bow-button-secondary bow-button-sm">
              Enrollment
            </Link>
          </div>
        }
      />

      {readiness && (
        <PageSection title="Registration readiness" noRule>
          <div style={{ marginBottom: 8 }}>
            <Badge status={readiness.state === "blocked" ? "negative" : readiness.state === "almost_ready" ? "warning" : "positive"}>
              {readiness.state.replace("_", " ")}
            </Badge>
          </div>
          {readiness.blockers.length === 0 && readiness.warnings.length === 0 && (
            <p style={{ color: "var(--bow-slate)" }}>Nothing is blocking registration from opening.</p>
          )}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {[...readiness.blockers, ...readiness.warnings].map((b) => (
              <li key={b.key} style={{ marginBottom: 6 }}>
                <strong>{b.label}</strong> — {b.why}{" "}
                <Link href={b.fixHref} style={{ textDecoration: "underline" }}>
                  Fix ({b.owner})
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}>
            <OpenRegistrationButton
              programId={id}
              programName={program.name}
              hasBlockers={readiness.blockers.length > 0}
              blockerLabels={readiness.blockers.map((b) => b.label)}
              capacity={program.capacity}
            />
          </div>
        </PageSection>
      )}

      <PageSection title="Basics">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramBasics(id, formData);
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={fieldLabel}>
            Program name
            <input name="name" defaultValue={program.name} required style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Short public description (shown on the family listing)
            <textarea name="shortDescription" defaultValue={program.short_description ?? ""} rows={2} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Long public description
            <textarea name="longDescription" defaultValue={program.long_description ?? ""} rows={4} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Internal description (staff only)
            <textarea name="internalDescription" defaultValue={program.internal_description ?? ""} rows={2} style={inputStyle} />
          </label>
          <div style={grid2}>
            <label style={fieldLabel}>
              Delivery format
              <select name="deliveryFormat" defaultValue={program.delivery_format ?? "in_person"} style={inputStyle}>
                <option value="in_person">In person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <label style={fieldLabel}>
              Track / audience
              <input name="track" defaultValue={program.audience ?? ""} style={inputStyle} />
            </label>
            <label style={fieldLabel}>
              Experience level
              <input name="experienceLevel" defaultValue={program.experience_level ?? ""} style={inputStyle} />
            </label>
            <label style={fieldLabel}>
              Grade min (K = kindergarten)
              <input name="gradeMin" defaultValue={program.grade_min != null ? (program.grade_min <= 0 ? "K" : String(program.grade_min)) : ""} style={inputStyle} />
            </label>
            <label style={fieldLabel}>
              Grade max
              <input name="gradeMax" defaultValue={program.grade_max != null ? String(program.grade_max) : ""} style={inputStyle} />
            </label>
            <label style={fieldLabel}>
              Location
              <select name="locationId" defaultValue={program.location_id ?? ""} style={inputStyle}>
                <option value="">No location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabel}>
              Timezone (IANA, e.g. America/Chicago)
              <input name="timezone" defaultValue={program.schedule_timezone ?? ""} style={inputStyle} />
            </label>
          </div>
          <div>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save basics
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Schedule">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramSchedule(id, formData);
          }}
          style={grid2}
        >
          <label style={fieldLabel}>
            Start date
            <input type="date" name="startDate" defaultValue={program.start_date ?? ""} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            End date
            <input type="date" name="endDate" defaultValue={program.end_date ?? ""} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Recurring pattern
            <input name="recurringPattern" defaultValue={program.schedule_label ?? ""} style={inputStyle} placeholder="e.g. Weekly on Tuesdays" />
          </label>
          <label style={fieldLabel}>
            Session start time
            <input type="time" name="sessionStartTime" defaultValue={program.schedule_start_time ?? ""} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Session end time
            <input type="time" name="sessionEndTime" defaultValue={program.schedule_end_time ?? ""} style={inputStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save schedule
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Capacity">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramCapacity(id, formData);
          }}
          style={grid2}
        >
          <label style={fieldLabel}>
            Program capacity
            <input type="number" name="capacity" defaultValue={program.capacity ?? ""} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Minimum enrollment
            <input type="number" name="minimumEnrollment" defaultValue={program.minimum_enrollment ?? 1} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Registration deadline
            <input type="date" name="registrationDeadline" defaultValue={program.registration_deadline ?? ""} style={inputStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save capacity
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Registration">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramRegistration(id, formData);
          }}
          style={grid2}
        >
          <label style={fieldLabel}>
            Registration mode
            <select name="registrationMode" defaultValue={program.registration_mode} style={inputStyle}>
              <option value="immediate">Immediate confirm</option>
              <option value="approval">Reservation / admin review</option>
            </select>
          </label>
          <label style={fieldLabel}>
            Public availability
            <select name="publicStatus" defaultValue={program.public_status ?? "coming_soon"} style={inputStyle}>
              <option value="coming_soon">Coming soon</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label style={fieldLabel}>
            Registration opens at
            <input type="date" name="registrationOpensAt" defaultValue={program.registration_opens_at ?? ""} style={inputStyle} />
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="isPublic" defaultChecked={program.is_public} /> Publicly listed
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="reservationEnabled" defaultChecked={program.reservation_enabled} /> Hold a seat while requirements are completed
          </label>
          <label style={fieldLabel}>
            Reservation window (hours)
            <input type="number" name="reservationHours" defaultValue={program.reservation_hours} style={inputStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save registration
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Waitlist">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramWaitlist(id, formData);
          }}
          style={grid2}
        >
          <label style={fieldLabel}>
            Waitlist mode
            <select name="waitlistMode" defaultValue={program.waitlist_mode} style={inputStyle}>
              <option value="disabled">Disabled</option>
              <option value="automatic">Automatic — offer the next family as seats open</option>
              <option value="manual">Manual — staff selects who to offer</option>
            </select>
          </label>
          <label style={fieldLabel}>
            Offer expiration (hours)
            <input type="number" name="waitlistOfferHours" defaultValue={program.waitlist_offer_hours} style={inputStyle} />
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save waitlist
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Family communication">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramCommunication(id, formData);
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={fieldLabel}>
            Confirmation message
            <textarea name="confirmationMessage" defaultValue={program.confirmation_message ?? ""} rows={2} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Next steps message
            <textarea name="nextStepsMessage" defaultValue={program.next_steps_message ?? ""} rows={2} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Support contact
            <input name="supportContact" defaultValue={program.support_contact ?? ""} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            What to bring
            <textarea
              name="whatToBring"
              defaultValue={program.what_to_bring ?? ""}
              rows={2}
              style={inputStyle}
              placeholder="e.g. Cleats, shin guards, a water bottle"
            />
          </label>
          <div>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save communication
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="Completion">
        <form
          action={async (formData: FormData) => {
            "use server";
            await saveProgramCompletion(id, formData);
          }}
          style={grid2}
        >
          <label style={fieldLabel}>
            Minimum attendance (%)
            <input type="number" name="completionMinAttendance" defaultValue={program.completion_min_attendance ?? ""} style={inputStyle} />
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="completionRequiresInstructor" defaultChecked={program.completion_requires_instructor} /> Instructor confirmation required
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="completionRequiresAdmin" defaultChecked={program.completion_requires_admin} /> Admin approval required
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="certificateEnabled" defaultChecked={program.certificate_enabled} /> Issue certificate on completion
          </label>
          <label style={checkboxLabel}>
            <input type="checkbox" name="feedbackEnabled" defaultChecked={program.feedback_enabled} /> Collect feedback
          </label>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="bow-button bow-button-primary bow-button-md">
              Save completion
            </button>
          </div>
        </form>
      </PageSection>
    </div>
  );
}
