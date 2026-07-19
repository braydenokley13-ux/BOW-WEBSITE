"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createStudent } from "@/app/actions/students";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  outline: "none",
  width: "100%",
  borderRadius: 4,
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  display: "block",
  marginBottom: 6,
};

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
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620 }}>
      <div>
        <label style={labelStyle} htmlFor="ns-name">Name</label>
        <input id="ns-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="ns-age">Age</label>
          <input id="ns-age" type="number" min={0} style={inputStyle} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ns-grade">Grade</label>
          <input id="ns-grade" style={inputStyle} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ns-email">Student email</label>
          <input id="ns-email" type="email" autoComplete="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 14 }}>
        <span style={{ ...labelStyle, marginBottom: 10 }}>Guardian</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 14 }}>
          <input aria-label="Guardian name" autoComplete="name" placeholder="Name" style={inputStyle} value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
          <input aria-label="Guardian email" type="email" autoComplete="email" placeholder="Email" style={inputStyle} value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
          <input aria-label="Guardian phone" type="tel" autoComplete="tel" placeholder="Phone" style={inputStyle} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="ns-em">Emergency notes</label>
        <textarea id="ns-em" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={emergencyNotes} onChange={(e) => setEmergencyNotes(e.target.value)} />
      </div>
      {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create Student"}
        </Button>
      </div>
    </form>
  );
}
