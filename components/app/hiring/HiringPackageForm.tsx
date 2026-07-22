"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import { createHiringPackage } from "@/app/actions/people-work";

export default function HiringPackageForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({ roleTitle: "", openingTitle: "", slug: "", targetHeadcount: 1, neededBy: "", summary: "", timeCommitment: "", includeScreen: false, includeMiniTeach: false });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null);
    const result = await createHiringPackage(fields);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Draft could not be created.");
    setOpen(false); router.refresh();
  };
  return <><Button variant="emphasis" onClick={() => setOpen(true)}>Create Hiring Package</Button><Modal open={open} onClose={() => !busy && setOpen(false)} title="Create a role, process, need, and opening" maxWidth={680} dismissible={!busy}><form onSubmit={submit}>
    <p className="ops-body" style={{ marginBottom: 16 }}>This creates a configurable draft package. It does not publish anything.</p>
    <div className="ops-fields">
      <div className="ops-field"><label htmlFor="package-role">Role title</label><input id="package-role" required maxLength={160} value={fields.roleTitle} onChange={(event) => setFields((value) => ({ ...value, roleTitle: event.target.value }))} /></div>
      <div className="ops-field"><label htmlFor="package-opening">Opening title</label><input id="package-opening" required maxLength={160} value={fields.openingTitle} onChange={(event) => setFields((value) => ({ ...value, openingTitle: event.target.value }))} /></div>
      <div className="ops-field"><label htmlFor="package-slug">Public URL name</label><input id="package-slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="curriculum-contributor" value={fields.slug} onChange={(event) => setFields((value) => ({ ...value, slug: event.target.value }))} /></div>
      <div className="ops-field"><label htmlFor="package-target">People needed</label><input id="package-target" type="number" min={1} max={100000} required value={fields.targetHeadcount} onChange={(event) => setFields((value) => ({ ...value, targetHeadcount: Number(event.target.value) }))} /></div>
      <div className="ops-field"><label htmlFor="package-needed">Needed by</label><input id="package-needed" type="date" value={fields.neededBy} onChange={(event) => setFields((value) => ({ ...value, neededBy: event.target.value }))} /></div>
      <div className="ops-field"><label htmlFor="package-summary">Public summary</label><textarea id="package-summary" required rows={3} maxLength={500} value={fields.summary} onChange={(event) => setFields((value) => ({ ...value, summary: event.target.value }))} /></div>
      <div className="ops-field"><label htmlFor="package-commitment">Time commitment</label><input id="package-commitment" required maxLength={200} placeholder="2–4 hours per week" value={fields.timeCommitment} onChange={(event) => setFields((value) => ({ ...value, timeCommitment: event.target.value }))} /></div>
    </div>
    <fieldset className="ops-field" style={{ marginTop: 14 }}><legend>Optional configured stages</legend><label><input type="checkbox" checked={fields.includeScreen} onChange={(event) => setFields((value) => ({ ...value, includeScreen: event.target.checked }))} /> Add candidate screen</label><label><input type="checkbox" checked={fields.includeMiniTeach} onChange={(event) => setFields((value) => ({ ...value, includeMiniTeach: event.target.checked }))} /> Add mini-teach</label></fieldset>
    {error && <p role="alert" className="ops-error" style={{ marginTop: 12 }}>{error}</p>}
    <div style={{ marginTop: 16 }}><Button type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : "Create Draft Package"}</Button></div>
  </form></Modal></>;
}
