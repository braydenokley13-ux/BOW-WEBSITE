"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createInstructorManually } from "@/app/actions/instructors";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "12px 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  width: "100%",
  borderRadius: 4,
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  display: "block",
  marginBottom: 6,
};

const SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "recruited", label: "Recruited" },
  { value: "other", label: "Other" },
];

export default function NewInstructorForm() {
  const router = useRouter();
  const [data, setData] = useState({ name: "", email: "", phone: "", source: "referral", notes: "" });
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "busy") return;
    if (!data.name.trim() || !/.+@.+\..+/.test(data.email)) {
      setError("Add a name and valid email.");
      setStatus("error");
      return;
    }
    setStatus("busy");
    setError(null);
    const res = await createInstructorManually({
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: data.source as "referral" | "recruited" | "other",
      answers: data.notes ? { notes: data.notes } : {},
    });
    if (res.ok) {
      router.push("/app/instructors");
    } else {
      setError(res.error === "exists" ? "An active instructor record already exists for this email." : res.error || "Something went wrong.");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="ni-name">Name</label>
          <input className="bow-field" id="ni-name" style={inputStyle} value={data.name} onChange={set("name")} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ni-email">Email</label>
          <input className="bow-field" id="ni-email" type="email" style={inputStyle} value={data.email} onChange={set("email")} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="ni-phone">Phone</label>
          <input className="bow-field" id="ni-phone" style={inputStyle} value={data.phone} onChange={set("phone")} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="ni-source">Source</label>
          <select className="bow-field" id="ni-source" style={inputStyle} value={data.source} onChange={set("source")}>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle} htmlFor="ni-notes">Notes</label>
        <textarea className="bow-field" id="ni-notes" rows={4} style={{ ...inputStyle, resize: "vertical" }} value={data.notes} onChange={set("notes")} />
      </div>
      {status === "error" && error && (
        <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>
      )}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={status === "busy"}>
          {status === "busy" ? "Adding…" : "Add Applicant"}
        </Button>
      </div>
    </form>
  );
}
