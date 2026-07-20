"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { createStudent } from "@/app/actions/students";

export default function NewStudentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [email, setEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createStudent({
      name,
      age: age ? Number(age) : undefined,
      grade: grade || undefined,
      email: email || undefined,
      guardianName: guardianName || undefined,
      guardianEmail: guardianEmail || undefined,
      guardianPhone: guardianPhone || undefined,
      emergencyNotes: emergencyNotes || undefined,
    });
    if (res.ok && res.id) router.push(`/app/students/${res.id}`);
    else {
      setError(res.error ?? "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="ops-form">
      <div className="ops-form-section">
        <div>
          <h3 className="ops-form-section__title">Student</h3>
          <p className="ops-form-section__help">Who is being enrolled.</p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="ns-name">Name</label>
            <input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="ns-age">Age</label>
            <input id="ns-age" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="ns-grade">Grade</label>
            <input id="ns-grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="ns-email">Student email</label>
            <input id="ns-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="ns-em">Emergency notes</label>
            <textarea id="ns-em" rows={3} value={emergencyNotes} onChange={(e) => setEmergencyNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ops-form-section">
        <div>
          <h3 className="ops-form-section__title">Guardian</h3>
          <p className="ops-form-section__help">Primary contact for this student.</p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="ns-guardian-name">Name</label>
            <input id="ns-guardian-name" autoComplete="name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="ns-guardian-email">Email</label>
            <input id="ns-guardian-email" type="email" autoComplete="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="ns-guardian-phone">Phone</label>
            <input id="ns-guardian-phone" type="tel" autoComplete="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p role="alert" className="ops-error">{error}</p>}
      <div className="ops-form-footer">
        <Button type="submit" variant="primary" size="md" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create Student"}
        </Button>
      </div>
    </form>
  );
}
