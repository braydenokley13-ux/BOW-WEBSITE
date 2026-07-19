import NewStudentForm from "@/components/app/students/NewStudentForm";

export default function NewStudentPage() {
  return (
    <main className="ops-page" style={{ maxWidth: 720 }}>
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Students</span>
          <h1 className="ops-title">New Student</h1>
        </div>
      </header>
      <div className="ops-panel">
        <NewStudentForm />
      </div>
    </main>
  );
}
