"use client";

/* ============================================================
 * components/learn/builder/SkillsPanel.tsx — lesson-level skill effects:
 * "this lesson can grow Skill X by up to N points on a great attempt" (plan
 * §5 — skills are progression attributes, not psychometrics; growth is
 * capped per lesson via learn_skill_events, not authored here). No
 * dedicated skills management page exists yet (Stage 7), so this panel can
 * also create a new skill inline the first time an author needs one.
 * ============================================================ */

import { useEffect, useState } from "react";
import type { SkillEffect } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { createSkill, listSkills } from "@/app/actions/learn-author";
import { fieldStyle, labelStyle, rowStyle } from "./formStyles";

export interface SkillsPanelProps {
  skills: SkillEffect[];
  onChange: (skills: SkillEffect[]) => void;
}

export default function SkillsPanel({ skills, onChange }: SkillsPanelProps) {
  const [catalog, setCatalog] = useState<{ id: string; label: string }[]>([]);
  const [newSkillLabel, setNewSkillLabel] = useState("");
  const [creating, setCreating] = useState(false);

  async function refreshCatalog() {
    const res = await listSkills();
    if (res.ok) setCatalog(res.skills);
  }

  useEffect(() => {
    void refreshCatalog();
  }, []);

  function update(index: number, patch: Partial<SkillEffect>) {
    onChange(skills.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function remove(index: number) {
    onChange(skills.filter((_, i) => i !== index));
  }
  function add() {
    const first = catalog.find((s) => !skills.some((se) => se.skillId === s.id));
    if (!first) return;
    onChange([...skills, { skillId: first.id, maxPoints: 5 }]);
  }

  async function handleCreateSkill() {
    const label = newSkillLabel.trim();
    if (!label) return;
    setCreating(true);
    const res = await createSkill(label);
    setCreating(false);
    if (res.ok) {
      setNewSkillLabel("");
      await refreshCatalog();
      onChange([...skills, { skillId: res.id, maxPoints: 5 }]);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
        Skills are progression attributes (Strategy, Analytics…) that only rise. This lesson can grow each listed
        skill by up to the given points on a strong first attempt — never re-farmed on replay without improvement.
      </p>
      {skills.map((effect, i) => {
        const label = catalog.find((c) => c.id === effect.skillId)?.label ?? effect.skillId;
        return (
          <div key={effect.skillId + i} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Skill</span>
              <select style={fieldStyle} value={effect.skillId} onChange={(e) => update(i, { skillId: e.target.value })}>
                <option value={effect.skillId}>{label}</option>
                {catalog.filter((c) => c.id !== effect.skillId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 120 }}>
              <span style={labelStyle}>Max points</span>
              <input
                style={fieldStyle}
                type="number"
                min={0}
                value={effect.maxPoints}
                onChange={(e) => update(i, { maxPoints: Number(e.target.value) })}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label={`Remove ${label}`}>
              Remove
            </Button>
          </div>
        );
      })}
      <Button variant="secondary" size="sm" onClick={add} disabled={catalog.length === 0 || catalog.every((c) => skills.some((s) => s.skillId === c.id))}>
        + Add skill effect
      </Button>

      <div style={{ borderTop: "1px solid var(--bow-border, #e4e4e7)", paddingTop: 12 }}>
        <span style={labelStyle}>New skill (no skills library yet — create one here)</span>
        <div style={rowStyle}>
          <input
            style={fieldStyle}
            placeholder="e.g. Strategy"
            value={newSkillLabel}
            onChange={(e) => setNewSkillLabel(e.target.value)}
          />
          <Button variant="secondary" size="sm" onClick={handleCreateSkill} disabled={creating || !newSkillLabel.trim()}>
            + Create skill
          </Button>
        </div>
      </div>
    </div>
  );
}
