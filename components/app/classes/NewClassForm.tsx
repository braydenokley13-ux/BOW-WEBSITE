"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createClass } from "@/app/actions/classes";

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

interface Props {
  curricula: { id: string; title: string }[];
  organizations: { id: string; name: string }[];
}

export default function NewClassForm({ curricula, organizations }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [curriculumId, setCurriculumId] = useState(curricula[0]?.id ?? "");
  const [partnerOrgId, setPartnerOrgId] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createClass({
      title,
      curriculumId,
      partnerOrgId: partnerOrgId || undefined,
      location: location || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      ageRange: ageRange || undefined,
      capacity: capacity ? Number(capacity) : undefined,
    });
    if (res.ok && res.id) router.push(`/app/classes/${res.id}`);
    else {
      setError(res.error ?? "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 620 }}>
      <div>
        <label style={labelStyle} htmlFor="nc-title">Title</label>
        <input id="nc-title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="nc-curriculum">Curriculum</label>
          <select id="nc-curriculum" style={inputStyle} value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
            {curricula.length === 0 && <option value="">No curricula yet</option>}
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="nc-org">Partner organization</label>
          <select id="nc-org" style={inputStyle} value={partnerOrgId} onChange={(e) => setPartnerOrgId(e.target.value)}>
            <option value="">None</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="nc-loc">Location</label>
          <input id="nc-loc" style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="nc-age">Age range</label>
          <input id="nc-age" style={inputStyle} value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14 }}>
        <div>
          <label style={labelStyle} htmlFor="nc-start">Start date</label>
          <input id="nc-start" type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="nc-end">End date</label>
          <input id="nc-end" type="date" style={inputStyle} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="nc-cap">Capacity</label>
          <input id="nc-cap" type="number" min={0} style={inputStyle} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
      </div>
      {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={busy || !curriculumId}>
          {busy ? "Creating…" : "Create Class"}
        </Button>
      </div>
    </form>
  );
}
