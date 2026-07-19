"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { createInstructorManually } from "@/app/actions/instructors";

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
    <form onSubmit={onSubmit} className="ops-form">
      <div className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Applicant</h2>
          <p className="ops-form-section__help">Basic contact details for the instructor pipeline.</p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="ni-name">Name</label>
            <input id="ni-name" value={data.name} onChange={set("name")} />
          </div>
          <div className="ops-field">
            <label htmlFor="ni-email">Email</label>
            <input id="ni-email" type="email" value={data.email} onChange={set("email")} />
          </div>
          <div className="ops-field">
            <label htmlFor="ni-phone">Phone</label>
            <input id="ni-phone" value={data.phone} onChange={set("phone")} />
          </div>
          <div className="ops-field">
            <label htmlFor="ni-source">Source</label>
            <select id="ni-source" value={data.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="ni-notes">Notes</label>
            <textarea id="ni-notes" rows={4} value={data.notes} onChange={set("notes")} />
          </div>
        </div>
      </div>

      {status === "error" && error && <p className="ops-error">{error}</p>}

      <div className="ops-form-footer">
        <Button type="submit" variant="primary" size="md" disabled={status === "busy"}>
          {status === "busy" ? "Adding…" : "Add Applicant"}
        </Button>
      </div>
    </form>
  );
}
