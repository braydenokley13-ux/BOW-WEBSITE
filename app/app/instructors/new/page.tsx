import { SectionHeader } from "@/components/ds";
import NewInstructorForm from "@/components/app/hiring/NewInstructorForm";

export default function NewInstructorPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Instructors" title="Add Applicant" level={1} />
      <NewInstructorForm />
    </div>
  );
}
