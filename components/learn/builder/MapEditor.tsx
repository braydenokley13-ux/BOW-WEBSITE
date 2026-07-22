"use client";

/* ============================================================
 * components/learn/builder/MapEditor.tsx — Stage 7 follow-up: the Career
 * Map editor. Section CRUD, node CRUD (published lessons or bonus/
 * checkpoint/reward), drag-reorder within/between sections
 * (components/learn/dnd/SectionedSortable), a plain-language unlock-policy
 * inspector, branchGroup lane assignment, and the "unplaced published
 * lessons" tray (explicit add-to-section, never silent auto-placement).
 * ============================================================ */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/ds";
import { SectionedSortable } from "@/components/learn/dnd/SectionedSortable";
import {
  createMapSection,
  updateMapSection,
  deleteMapSection,
  createMapNode,
  deleteMapNode,
  updateMapNodeUnlock,
  updateMapNodeBranchGroup,
  moveMapNode,
  type MapEditorData,
  type MapEditorSection,
  type MapEditorNode,
} from "@/app/actions/learn-author";

const THEME_SWATCHES = [
  { label: "Orange", value: "#ff5a36" },
  { label: "Blue", value: "#3157ff" },
  { label: "Green", value: "#158a55" },
  { label: "Amber", value: "#e99a18" },
  { label: "Red", value: "#d63b3b" },
  { label: "Slate", value: "#6a6d75" },
];

const KIND_LABEL: Record<MapEditorNode["kind"], string> = {
  lesson: "Lesson",
  bonus_challenge: "Bonus Challenge",
  checkpoint: "Checkpoint",
  reward: "Reward",
};

const KIND_ICON: Record<MapEditorNode["kind"], string> = {
  lesson: "📘",
  bonus_challenge: "⭐",
  checkpoint: "🚩",
  reward: "🎁",
};

function panelStyle(): React.CSSProperties {
  return { border: "1px solid var(--border-rule, #d8d5ce)", borderRadius: 12, padding: 16, background: "var(--surface-page, #fff)" };
}

export default function MapEditor({ data, publishedLessons }: { data: MapEditorData; publishedLessons: { id: string; title: string }[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const trackId = data.tracks[0]?.id ?? null;

  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionSubtitle, setNewSectionSubtitle] = useState("");
  const [newSectionColor, setNewSectionColor] = useState(THEME_SWATCHES[0].value);

  function refresh() {
    router.refresh();
  }

  async function handleCreateSection() {
    if (!trackId || !newSectionTitle.trim()) return;
    const res = await createMapSection({ trackId, title: newSectionTitle.trim(), subtitle: newSectionSubtitle.trim() || undefined, theme: { color: newSectionColor } });
    if (res.ok) {
      setNewSectionTitle("");
      setNewSectionSubtitle("");
      refresh();
    } else {
      alert(res.error);
    }
  }

  async function handleMove(nodeId: string, toSectionId: string, toIndex: number) {
    // Optimistic-free: just await + refresh. Map editor traffic is low
    // enough that the round trip is imperceptible, and this keeps the
    // source of truth entirely server-side (no local sort-drift bugs).
    startTransition(async () => {
      const res = await moveMapNode(nodeId, toSectionId, toIndex);
      if (!res.ok) alert(res.error);
      refresh();
    });
  }

  const containers = data.sections.map((s) => ({ id: s.id, items: data.nodes.filter((n) => n.sectionId === s.id) }));

  if (!trackId) {
    return <p style={{ color: "var(--bow-slate)" }}>Create a track in the curriculum manager before building a map.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <UnplacedTray lessons={data.unplacedLessons} sections={data.sections} onPlaced={refresh} />

      <SectionedSortable
        containers={containers}
        getId={(n) => n.id}
        onMove={handleMove}
        renderContainer={(sectionId, children, isEmpty) => {
          const section = data.sections.find((s) => s.id === sectionId)!;
          return (
            <SectionPanel key={sectionId} section={section} onChanged={refresh}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: isEmpty ? 44 : undefined }}>
                {children}
                {isEmpty && <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", border: "1px dashed var(--border-rule)", borderRadius: 8, padding: "10px 12px" }}>Drop a node here, or add one below.</div>}
              </div>
              <AddNodeForm sectionId={sectionId} publishedLessons={publishedLessons} onAdded={refresh} />
            </SectionPanel>
          );
        }}
        renderItem={(node, drag) => (
          <NodeRow
            node={node}
            dragHandle={drag}
            allNodes={data.nodes}
            allSections={data.sections}
            onChanged={refresh}
          />
        )}
      />

      <div style={panelStyle()}>
        <h3 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: 16 }}>
          Add a Department Section
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "var(--font-data)" }}>
            Title
            <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} placeholder="e.g. Analytics Department" style={inputStyle()} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "var(--font-data)" }}>
            Subtitle (optional)
            <input value={newSectionSubtitle} onChange={(e) => setNewSectionSubtitle(e.target.value)} placeholder="e.g. Cap strategy & modeling" style={inputStyle()} />
          </label>
          <SwatchPicker value={newSectionColor} onChange={setNewSectionColor} />
          <Button onClick={handleCreateSection} disabled={!newSectionTitle.trim()}>Add Section</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- section panel ---------------- */

function SectionPanel({ section, onChanged, children }: { section: MapEditorSection; onChanged: () => void; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle ?? "");
  const color = (section.theme?.color as string) || THEME_SWATCHES[0].value;
  const [pickedColor, setPickedColor] = useState(color);

  async function save() {
    const res = await updateMapSection(section.id, { title: title.trim(), subtitle: subtitle.trim() || undefined, theme: { color: pickedColor } });
    if (!res.ok) { alert(res.error); return; }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete "${section.title}" and every node in it? This can't be undone.`)) return;
    const res = await deleteMapSection(section.id);
    if (!res.ok) alert(res.error);
    onChanged();
  }

  return (
    <div style={{ ...panelStyle(), borderLeft: `5px solid ${color}`, marginBottom: 18 }}>
      {editing ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle()} />
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" style={inputStyle()} />
          <SwatchPicker value={pickedColor} onChange={setPickedColor} />
          <Button onClick={save}>Save</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: 18 }}>{section.title}</h3>
            {section.subtitle && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--bow-slate)" }}>{section.subtitle}</p>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditing(true)} style={linkButtonStyle()}>Edit</button>
            <button onClick={remove} style={{ ...linkButtonStyle(), color: "var(--bow-negative)" }}>Delete</button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------------- node row + unlock inspector ---------------- */

function NodeRow({
  node,
  dragHandle,
  allNodes,
  allSections,
  onChanged,
}: {
  node: MapEditorNode;
  dragHandle: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined };
  allNodes: MapEditorNode[];
  allSections: MapEditorSection[];
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  async function remove() {
    if (!confirm("Remove this node from the map? The lesson itself is not deleted.")) return;
    const res = await deleteMapNode(node.id);
    if (!res.ok) alert(res.error);
    onChanged();
  }

  return (
    <div style={{ border: "1px solid var(--border-rule)", borderRadius: 10, background: "var(--surface-page, #fff)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <span {...dragHandle.attributes} {...dragHandle.listeners} style={{ cursor: "grab", padding: 4, color: "var(--bow-slate)" }} aria-label="Drag to reorder" title="Drag to reorder">⠿</span>
        <span aria-hidden>{KIND_ICON[node.kind]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{node.lessonTitle ?? KIND_LABEL[node.kind]}</div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--bow-slate)" }}>
            {KIND_LABEL[node.kind]}
            {node.layout?.branchGroup && node.layout.branchGroup !== "main" ? ` · Lane: ${String(node.layout.branchGroup)}` : ""}
          </div>
        </div>
        {hasUnlockPolicy(node.unlock) && <Badge status="info">Locked by rule</Badge>}
        <button onClick={() => setExpanded((v) => !v)} style={linkButtonStyle()}>{expanded ? "Close" : "Rules"}</button>
        <button onClick={remove} style={{ ...linkButtonStyle(), color: "var(--bow-negative)" }}>Remove</button>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-rule)", padding: 12 }}>
          <UnlockInspector node={node} allNodes={allNodes} allSections={allSections} onChanged={onChanged} />
          <BranchGroupField node={node} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function hasUnlockPolicy(u: MapEditorNode["unlock"]): boolean {
  return Boolean(u.requiresNodes?.length || u.minStarsTotal || u.minLevel || u.badgeId || u.requiresInstructorRelease || u.opensAt);
}

/** Plain-language unlock rules — no "jsonb", no field names, just checkboxes and numbers. */
function UnlockInspector({
  node,
  allNodes,
  allSections,
  onChanged,
}: {
  node: MapEditorNode;
  allNodes: MapEditorNode[];
  allSections: MapEditorSection[];
  onChanged: () => void;
}) {
  const [requiresNodes, setRequiresNodes] = useState<string[]>(node.unlock.requiresNodes ?? []);
  const [minStars, setMinStars] = useState(node.unlock.minStarsTotal ?? 0);
  const [minLevel, setMinLevel] = useState(node.unlock.minLevel ?? 0);
  const [instructorRelease, setInstructorRelease] = useState(Boolean(node.unlock.requiresInstructorRelease));
  const [opensAtLocal, setOpensAtLocal] = useState(node.unlock.opensAt ? toLocalInputValue(node.unlock.opensAt) : "");

  const otherNodes = allNodes.filter((n) => n.id !== node.id);
  const sectionTitle = (sectionId: string) => allSections.find((s) => s.id === sectionId)?.title ?? "";

  function toggleRequires(id: string) {
    setRequiresNodes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    const res = await updateMapNodeUnlock(node.id, {
      requiresNodes: requiresNodes.length ? requiresNodes : undefined,
      minStarsTotal: minStars > 0 ? minStars : undefined,
      minLevel: minLevel > 0 ? minLevel : undefined,
      requiresInstructorRelease: instructorRelease || undefined,
      opensAt: opensAtLocal ? new Date(opensAtLocal).getTime() : undefined,
    });
    if (!res.ok) alert(res.error);
    onChanged();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Must finish these first</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
          {otherNodes.length === 0 && <span style={{ fontSize: 12, color: "var(--bow-slate)" }}>No other nodes yet.</span>}
          {otherNodes.map((n) => (
            <label key={n.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={requiresNodes.includes(n.id)} onChange={() => toggleRequires(n.id)} />
              {n.lessonTitle ?? KIND_LABEL[n.kind]} <span style={{ color: "var(--bow-slate)", fontSize: 11 }}>({sectionTitle(n.sectionId)})</span>
            </label>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        Needs at least
        <input type="number" min={0} value={minStars} onChange={(e) => setMinStars(Number(e.target.value) || 0)} style={{ ...inputStyle(), width: 64 }} />
        total stars earned
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        Needs at least career level
        <input type="number" min={0} value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value) || 0)} style={{ ...inputStyle(), width: 64 }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={instructorRelease} onChange={(e) => setInstructorRelease(e.target.checked)} />
        Only unlock when an instructor releases it
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        Opens on
        <input type="datetime-local" value={opensAtLocal} onChange={(e) => setOpensAtLocal(e.target.value)} style={inputStyle()} />
      </label>
      <div>
        <Button onClick={save}>Save Rules</Button>
      </div>
    </div>
  );
}

function BranchGroupField({ node, onChanged }: { node: MapEditorNode; onChanged: () => void }) {
  const [value, setValue] = useState(String(node.layout?.branchGroup ?? "main"));
  async function save() {
    const res = await updateMapNodeBranchGroup(node.id, value);
    if (!res.ok) alert(res.error);
    onChanged();
  }
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      Branch lane
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="main" style={{ ...inputStyle(), width: 140 }} />
      <Button variant="ghost" onClick={save}>Save Lane</Button>
    </label>
  );
}

/* ---------------- add-node form ---------------- */

function AddNodeForm({ sectionId, publishedLessons, onAdded }: { sectionId: string; publishedLessons: { id: string; title: string }[]; onAdded: () => void }) {
  const [kind, setKind] = useState<MapEditorNode["kind"]>("lesson");
  const [lessonId, setLessonId] = useState(publishedLessons[0]?.id ?? "");

  async function add() {
    const res = await createMapNode({ sectionId, kind, lessonId: kind === "lesson" ? lessonId : undefined });
    if (!res.ok) { alert(res.error); return; }
    onAdded();
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border-rule)" }}>
      <select value={kind} onChange={(e) => setKind(e.target.value as MapEditorNode["kind"])} style={inputStyle()}>
        <option value="lesson">Lesson</option>
        <option value="bonus_challenge">Bonus Challenge</option>
        <option value="checkpoint">Checkpoint</option>
        <option value="reward">Reward</option>
      </select>
      {kind === "lesson" && (
        publishedLessons.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--bow-slate)" }}>No published lessons yet.</span>
        ) : (
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={inputStyle()}>
            {publishedLessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        )
      )}
      <Button variant="ghost" onClick={add} disabled={kind === "lesson" && !lessonId}>+ Add Node</Button>
    </div>
  );
}

/* ---------------- unplaced-lessons tray ---------------- */

function UnplacedTray({ lessons, sections, onPlaced }: { lessons: { id: string; title: string }[]; sections: MapEditorSection[]; onPlaced: () => void }) {
  const [pickedSection, setPickedSection] = useState<Record<string, string>>({});

  async function place(lessonId: string) {
    const sectionId = pickedSection[lessonId] ?? sections[0]?.id;
    if (!sectionId) { alert("Add a section first."); return; }
    const res = await createMapNode({ sectionId, kind: "lesson", lessonId });
    if (!res.ok) { alert(res.error); return; }
    onPlaced();
  }

  if (lessons.length === 0) return null;

  return (
    <div style={{ ...panelStyle(), borderColor: "var(--bow-warning, #e99a18)", background: "var(--bow-warning-tint, #fbf0db)" }}>
      <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase", fontSize: 15 }}>
        Published, not on the map yet ({lessons.length})
      </h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--bow-slate)" }}>
        These lessons are live but students can&apos;t reach them from the Career Map. Placement is never automatic — pick a department for each one.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lessons.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 600 }}>{l.title}</span>
            <select
              value={pickedSection[l.id] ?? sections[0]?.id ?? ""}
              onChange={(e) => setPickedSection((p) => ({ ...p, [l.id]: e.target.value }))}
              style={inputStyle()}
            >
              {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <Button variant="ghost" onClick={() => place(l.id)} disabled={sections.length === 0}>Add to Map</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function SwatchPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {THEME_SWATCHES.map((s) => (
        <button
          key={s.value}
          type="button"
          title={s.label}
          onClick={() => onChange(s.value)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: s.value,
            border: value === s.value ? "2px solid var(--bow-ink)" : "1px solid var(--border-rule)",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return { border: "1px solid var(--border-rule, #d8d5ce)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-interface)" };
}

function linkButtonStyle(): React.CSSProperties {
  return { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-blue)", padding: "4px 6px" };
}

function toLocalInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
