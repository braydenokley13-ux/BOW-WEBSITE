import { SectionHeader } from "@/components/ds";
import NewStudentForm from "@/components/app/students/NewStudentForm";

export default function NewStudentPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Students" title="New Student" />
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <NewStudentForm />
      </div>
    </div>
  );
}
