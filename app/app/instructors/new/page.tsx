import NewInstructorForm from "@/components/app/hiring/NewInstructorForm";

export default function NewInstructorPage() {
  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Instructors · New applicant</span>
          <h1 className="ops-title">Add Applicant</h1>
          <p className="ops-summary">
            Record a referral or recruited applicant manually to start the hiring pipeline.
          </p>
        </div>
      </header>
      <NewInstructorForm />
    </main>
  );
}
