"use client";

/* ============================================================
 * components/learn/builder/AchievementEditor.tsx — Stage 9 achievement
 * editor: list every badge (system + custom), create/edit custom badges
 * with a dropdown-built rule (no JSON typed by hand), disable custom
 * badges. System badges are copy-editable only (name/description/icon/
 * locked hint) and flagged as such.
 * ============================================================ */

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge, Button } from "@/components/ds";
import Modal from "@/components/ds/Modal";
import {
  listAchievementBadges,
  createAchievementBadge,
  updateAchievementBadge,
  setAchievementBadgeActive,
  listLessonsForRulePicker,
  listModulesForRulePicker,
  listTracksForRulePicker,
  listVariablesForRulePicker,
  type AchievementBadgeRow,
  type AchievementBadgeInput,
} from "@/app/actions/learn-achievements";
import type { AchievementRule } from "@/lib/learn/achievements";
import { fieldStyle, labelStyle, selectStyle } from "./formStyles";

const RULE_TYPES: { value: AchievementRule["type"]; label: string }[] = [
  { value: "lesson_complete", label: "Complete a specific lesson" },
  { value: "track_complete", label: "Complete every lesson in a track" },
  { value: "module_complete", label: "Complete every lesson in a module" },
  { value: "variable_threshold", label: "A lesson variable crosses a threshold" },
  { value: "score_gte", label: "Score at or above a target" },
  { value: "stars_total_gte", label: "Reach a lifetime star total" },
  { value: "lessons_completed_gte", label: "Reach a lifetime lessons-completed count" },
];

type PickerLesson = { id: string; title: string };
type PickerModule = { id: string; title: string };
type PickerTrack = { id: string; title: string };
type PickerVariable = { key: string; label: string; lessonTitle: string };

function defaultRuleFor(type: AchievementRule["type"], lessons: PickerLesson[], modules: PickerModule[], tracks: PickerTrack[], variables: PickerVariable[]): AchievementRule {
  switch (type) {
    case "lesson_complete":
      return { type, lessonId: lessons[0]?.id ?? "" };
    case "track_complete":
      return { type, trackId: tracks[0]?.id ?? "" };
    case "module_complete":
      return { type, moduleId: modules[0]?.id ?? "" };
    case "variable_threshold":
      return { type, variableId: variables[0]?.key ?? "", gte: 0 };
    case "score_gte":
      return { type, score: 90 };
    case "stars_total_gte":
      return { type, n: 10 };
    case "lessons_completed_gte":
      return { type, n: 5 };
  }
}

interface RuleBuilderProps {
  rule: AchievementRule;
  onChange: (rule: AchievementRule) => void;
  lessons: PickerLesson[];
  modules: PickerModule[];
  tracks: PickerTrack[];
  variables: PickerVariable[];
}

function RuleBuilder({ rule, onChange, lessons, modules, tracks, variables }: RuleBuilderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <span style={labelStyle}>Rule type</span>
        <select
          style={selectStyle}
          value={rule.type}
          onChange={(e) => onChange(defaultRuleFor(e.target.value as AchievementRule["type"], lessons, modules, tracks, variables))}
        >
          {RULE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {rule.type === "lesson_complete" && (
        <>
          <div>
            <span style={labelStyle}>Lesson</span>
            <select style={selectStyle} value={rule.lessonId} onChange={(e) => onChange({ ...rule, lessonId: e.target.value })}>
              <option value="" disabled>Choose a lesson…</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Minimum stars (optional)</span>
            <select
              style={selectStyle}
              value={rule.minStars ?? ""}
              onChange={(e) => onChange({ ...rule, minStars: e.target.value === "" ? undefined : Number(e.target.value) })}
            >
              <option value="">Any</option>
              <option value="1">1 star</option>
              <option value="2">2 stars</option>
              <option value="3">3 stars</option>
            </select>
          </div>
        </>
      )}

      {rule.type === "track_complete" && (
        <div>
          <span style={labelStyle}>Track</span>
          <select style={selectStyle} value={rule.trackId} onChange={(e) => onChange({ ...rule, trackId: e.target.value })}>
            <option value="" disabled>Choose a track…</option>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      )}

      {rule.type === "module_complete" && (
        <div>
          <span style={labelStyle}>Module</span>
          <select style={selectStyle} value={rule.moduleId} onChange={(e) => onChange({ ...rule, moduleId: e.target.value })}>
            <option value="" disabled>Choose a module…</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
      )}

      {rule.type === "variable_threshold" && (
        <>
          <div>
            <span style={labelStyle}>Variable</span>
            <select style={selectStyle} value={rule.variableId} onChange={(e) => onChange({ ...rule, variableId: e.target.value })}>
              <option value="" disabled>Choose a variable…</option>
              {variables.map((v) => <option key={`${v.lessonTitle}:${v.key}`} value={v.key}>{v.label} ({v.lessonTitle})</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>At least (gte, optional)</span>
              <input
                style={fieldStyle}
                type="number"
                value={rule.gte ?? ""}
                onChange={(e) => onChange({ ...rule, gte: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>At most (lte, optional)</span>
              <input
                style={fieldStyle}
                type="number"
                value={rule.lte ?? ""}
                onChange={(e) => onChange({ ...rule, lte: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
          </div>
        </>
      )}

      {rule.type === "score_gte" && (
        <>
          <div>
            <span style={labelStyle}>Lesson (optional — leave unscoped for any lesson)</span>
            <select style={selectStyle} value={rule.lessonId ?? ""} onChange={(e) => onChange({ ...rule, lessonId: e.target.value || undefined })}>
              <option value="">Any lesson</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Minimum score (0-100)</span>
            <input style={fieldStyle} type="number" min={0} max={100} value={rule.score} onChange={(e) => onChange({ ...rule, score: Number(e.target.value) })} />
          </div>
        </>
      )}

      {rule.type === "stars_total_gte" && (
        <div>
          <span style={labelStyle}>Lifetime stars needed</span>
          <input style={fieldStyle} type="number" min={0} value={rule.n} onChange={(e) => onChange({ ...rule, n: Number(e.target.value) })} />
        </div>
      )}

      {rule.type === "lessons_completed_gte" && (
        <div>
          <span style={labelStyle}>Lessons completed needed</span>
          <input style={fieldStyle} type="number" min={0} value={rule.n} onChange={(e) => onChange({ ...rule, n: Number(e.target.value) })} />
        </div>
      )}
    </div>
  );
}

interface FormState {
  name: string;
  description: string;
  icon: string;
  lockedHint: string;
  rarity: "" | "common" | "rare" | "legendary";
  xpReward: number;
  rule: AchievementRule;
}

function emptyForm(lessons: PickerLesson[]): FormState {
  return {
    name: "",
    description: "",
    icon: "🏅",
    lockedHint: "",
    rarity: "",
    xpReward: 25,
    rule: { type: "lesson_complete", lessonId: lessons[0]?.id ?? "" },
  };
}

function formFromBadge(b: AchievementBadgeRow, lessons: PickerLesson[], modules: PickerModule[], tracks: PickerTrack[], variables: PickerVariable[]): FormState {
  return {
    name: b.name,
    description: b.description,
    icon: b.icon,
    lockedHint: b.lockedHint ?? "",
    rarity: (b.rarity as FormState["rarity"]) ?? "",
    xpReward: b.xpReward,
    rule: b.rule ?? defaultRuleFor("lesson_complete", lessons, modules, tracks, variables),
  };
}

const EMOJI_CHOICES = ["🏅", "🏆", "💰", "🎯", "🚀", "⭐", "🔥", "💎", "📈", "🧠", "👔", "🎓"];

export default function AchievementEditor({ initialBadges }: { initialBadges: AchievementBadgeRow[] }) {
  const [badges, setBadges] = useState(initialBadges);
  const [lessons, setLessons] = useState<PickerLesson[]>([]);
  const [modules, setModules] = useState<PickerModule[]>([]);
  const [tracks, setTracks] = useState<PickerTrack[]>([]);
  const [variables, setVariables] = useState<PickerVariable[]>([]);
  const [editing, setEditing] = useState<AchievementBadgeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void Promise.all([listLessonsForRulePicker(), listModulesForRulePicker(), listTracksForRulePicker(), listVariablesForRulePicker()]).then(
      ([l, m, t, v]) => {
        if (l.ok) setLessons(l.lessons);
        if (m.ok) setModules(m.modules);
        if (t.ok) setTracks(t.tracks);
        if (v.ok) setVariables(v.variables);
      },
    );
  }, []);

  const systemBadges = useMemo(() => badges.filter((b) => b.source === "system"), [badges]);
  const customBadges = useMemo(() => badges.filter((b) => b.source === "custom"), [badges]);

  async function refresh() {
    const res = await listAchievementBadges();
    if (res.ok) setBadges(res.badges);
  }

  function openCreate() {
    setError(null);
    setCreating(true);
    setEditing(null);
    setForm(emptyForm(lessons));
  }

  function openEdit(badge: AchievementBadgeRow) {
    setError(null);
    setCreating(false);
    setEditing(badge);
    setForm(formFromBadge(badge, lessons, modules, tracks, variables));
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setForm(null);
    setError(null);
  }

  function submit() {
    if (!form) return;
    setError(null);
    const input: AchievementBadgeInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      icon: form.icon.trim() || "🏅",
      lockedHint: form.lockedHint.trim(),
      rarity: form.rarity || undefined,
      xpReward: form.xpReward,
      rule: form.rule,
    };
    if (!input.name) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      const result = creating ? await createAchievementBadge(input) : await updateAchievementBadge(editing!.id, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeModal();
      await refresh();
    });
  }

  function toggleActive(badge: AchievementBadgeRow) {
    startTransition(async () => {
      await setAchievementBadgeActive(badge.id, !badge.active);
      await refresh();
    });
  }

  const isSystem = !creating && editing?.source === "system";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Custom badges</h2>
          <Button variant="emphasis" onClick={openCreate}>+ New badge</Button>
        </div>
        {customBadges.length === 0 ? (
          <p style={{ color: "var(--bow-muted-text, #767a85)" }}>No custom badges yet — create one with a rule below.</p>
        ) : (
          <BadgeList badges={customBadges} onEdit={openEdit} onToggle={toggleActive} isPending={isPending} />
        )}
      </div>

      <div>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>System badges</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
          Copy-editable only — category, threshold, and XP are fixed by the built-in streak/accuracy/volume engine.
        </p>
        <BadgeList badges={systemBadges} onEdit={openEdit} onToggle={undefined} isPending={isPending} />
      </div>

      <Modal open={creating || editing !== null} onClose={closeModal} title={creating ? "New badge" : `Edit ${editing?.name ?? ""}`} maxWidth={560}>
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isSystem && (
              <Badge status="warning">System badge — name/description/icon/hint only</Badge>
            )}
            <div>
              <span style={labelStyle}>Name</span>
              <input style={fieldStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <span style={labelStyle}>Description</span>
              <textarea style={{ ...fieldStyle, minHeight: 60 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <span style={labelStyle}>Icon (emoji)</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {EMOJI_CHOICES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, icon: emoji })}
                    aria-label={`Use ${emoji}`}
                    style={{
                      fontSize: 18, width: 34, height: 34, borderRadius: 8,
                      border: form.icon === emoji ? "2px solid var(--bow-orange-solid)" : "1px solid var(--bow-border, #d7d7db)",
                      background: "var(--bow-surface, #fff)", cursor: "pointer",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input style={fieldStyle} value={form.icon} maxLength={8} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Or type any emoji" />
            </div>
            <div>
              <span style={labelStyle}>Locked hint</span>
              <input style={fieldStyle} value={form.lockedHint} onChange={(e) => setForm({ ...form, lockedHint: e.target.value })} placeholder="Teaser shown before it's earned…" />
            </div>

            {!isSystem && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <span style={labelStyle}>XP reward</span>
                    <input style={fieldStyle} type="number" min={0} max={1000} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={labelStyle}>Rarity (optional)</span>
                    <select style={selectStyle} value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value as FormState["rarity"] })}>
                      <option value="">None</option>
                      <option value="common">Common</option>
                      <option value="rare">Rare</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid var(--bow-border, #eee)", paddingTop: 12 }}>
                  <span style={{ ...labelStyle, marginBottom: 8 }}>Award rule</span>
                  <RuleBuilder rule={form.rule} onChange={(rule) => setForm({ ...form, rule })} lessons={lessons} modules={modules} tracks={tracks} variables={variables} />
                </div>
              </>
            )}

            {error && <p role="alert" style={{ color: "var(--bow-negative, #b3261e)", margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button variant="emphasis" onClick={submit} disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function BadgeList({
  badges,
  onEdit,
  onToggle,
  isPending,
}: {
  badges: AchievementBadgeRow[];
  onEdit: (b: AchievementBadgeRow) => void;
  onToggle: ((b: AchievementBadgeRow) => void) | undefined;
  isPending: boolean;
}) {
  if (badges.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {badges.map((b) => (
        <div
          key={b.id}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
            border: "1px solid var(--bow-border, #e5e3dd)", borderRadius: 10,
            opacity: b.active ? 1 : 0.55,
          }}
        >
          <span style={{ fontSize: 22 }}>{b.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>{b.name}</strong>
              {b.source === "system" && <Badge status="neutral">System</Badge>}
              {b.ruleInvalid && <Badge status="negative">Invalid rule</Badge>}
              {!b.active && <Badge status="neutral">Disabled</Badge>}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>{b.description || "—"}</p>
            {b.rule && <p style={{ margin: "2px 0 0", fontSize: 12, fontFamily: "var(--font-data)", color: "var(--bow-muted-text, #767a85)" }}>{describeRule(b.rule)}</p>}
          </div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12 }}>+{b.xpReward} XP</span>
          <Button variant="secondary" onClick={() => onEdit(b)}>Edit</Button>
          {onToggle && (
            <Button variant="secondary" onClick={() => onToggle(b)} disabled={isPending}>
              {b.active ? "Disable" : "Enable"}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function describeRule(rule: AchievementRule): string {
  switch (rule.type) {
    case "lesson_complete":
      return `Complete lesson${rule.minStars ? ` (≥${rule.minStars}★)` : ""}`;
    case "track_complete":
      return "Complete every lesson in a track";
    case "module_complete":
      return "Complete every lesson in a module";
    case "variable_threshold":
      return `Variable ${rule.variableId}${rule.gte !== undefined ? ` ≥ ${rule.gte}` : ""}${rule.lte !== undefined ? ` ≤ ${rule.lte}` : ""}`;
    case "score_gte":
      return `Score ≥ ${rule.score}${rule.lessonId ? " on a specific lesson" : ""}`;
    case "stars_total_gte":
      return `Lifetime stars ≥ ${rule.n}`;
    case "lessons_completed_gte":
      return `Lessons completed ≥ ${rule.n}`;
  }
}
