"use client";

/* ============================================================
 * components/learn/builder/inspectors/Stage6Inspectors.tsx — inspectors for
 * Stage 6's new block types: rank, categorize/drag_drop, match,
 * tradeoff_matrix, forecast, table, chart, timeline. Plain forms, same
 * pattern as ContentInspectors.tsx / QuestionInspector.tsx — no new UI
 * library, everything channels through formStyles.ts tokens.
 * ============================================================ */

import type { Block } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { fieldStyle, labelStyle, rowStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

function randId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

export function RankInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "rank" }>>) {
  function updateItem(i: number, label: string) {
    onChange({ items: block.items.map((it, idx) => (idx === i ? { ...it, label } : it)) });
  }
  function removeItem(i: number) {
    const id = block.items[i].id;
    onChange({ items: block.items.filter((_, idx) => idx !== i), correctOrder: block.correctOrder.filter((c) => c !== id) });
  }
  function addItem() {
    const id = randId("item");
    onChange({ items: [...block.items, { id, label: "" }], correctOrder: [...block.correctOrder, id] });
  }
  function moveCorrect(i: number, dir: -1 | 1) {
    const next = block.correctOrder.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ correctOrder: next });
  }
  const byId = new Map(block.items.map((it) => [it.id, it]));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      {block.items.map((item, i) => (
        <div key={item.id} style={rowStyle}>
          <input style={fieldStyle} value={item.label} onChange={(e) => updateItem(i, e.target.value)} />
          <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addItem}>+ Add item</Button>
      <div>
        <span style={labelStyle}>Correct order (top to bottom)</span>
        {block.correctOrder.map((id, i) => (
          <div key={id} style={{ ...rowStyle, alignItems: "center", padding: "4px 0" }}>
            <span style={{ fontSize: 13 }}>{i + 1}. {byId.get(id)?.label ?? id}</span>
            <Button variant="ghost" size="sm" onClick={() => moveCorrect(i, -1)}>Up</Button>
            <Button variant="ghost" size="sm" onClick={() => moveCorrect(i, 1)}>Down</Button>
          </div>
        ))}
      </div>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function CategorizeInspector({
  block,
  onChange,
}: BlockInspectorProps<Extract<Block, { type: "categorize" | "drag_drop" }>>) {
  function updateCategory(i: number, label: string) {
    onChange({ categories: block.categories.map((c, idx) => (idx === i ? { ...c, label } : c)) });
  }
  function addCategory() {
    onChange({ categories: [...block.categories, { id: randId("cat"), label: "" }] });
  }
  function removeCategory(i: number) {
    const id = block.categories[i].id;
    onChange({ categories: block.categories.filter((_, idx) => idx !== i), items: block.items.filter((it) => it.correctCategoryId !== id) });
  }
  function updateItem(i: number, patch: Partial<(typeof block.items)[number]>) {
    onChange({ items: block.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function addItem() {
    onChange({ items: [...block.items, { id: randId("item"), label: "", correctCategoryId: block.categories[0]?.id ?? "" }] });
  }
  function removeItem(i: number) {
    onChange({ items: block.items.filter((_, idx) => idx !== i) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Buckets</span>
        {block.categories.map((c, i) => (
          <div key={c.id} style={rowStyle}>
            <input style={fieldStyle} value={c.label} onChange={(e) => updateCategory(i, e.target.value)} />
            <Button variant="ghost" size="sm" onClick={() => removeCategory(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addCategory}>+ Add bucket</Button>
      </div>
      <div>
        <span style={labelStyle}>Items</span>
        {block.items.map((item, i) => (
          <div key={item.id} style={rowStyle}>
            <input style={fieldStyle} placeholder="Label" value={item.label} onChange={(e) => updateItem(i, { label: e.target.value })} />
            <select style={fieldStyle} value={item.correctCategoryId} onChange={(e) => updateItem(i, { correctCategoryId: e.target.value })}>
              {block.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label || c.id}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addItem}>+ Add item</Button>
      </div>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function MatchInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "match" }>>) {
  function updatePair(i: number, patch: Partial<(typeof block.pairs)[number]>) {
    onChange({ pairs: block.pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  }
  function addPair() {
    onChange({ pairs: [...block.pairs, { id: randId("pair"), left: "", right: "" }] });
  }
  function removePair(i: number) {
    onChange({ pairs: block.pairs.filter((_, idx) => idx !== i) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      {block.pairs.map((pair, i) => (
        <div key={pair.id} style={rowStyle}>
          <input style={fieldStyle} placeholder="Left" value={pair.left} onChange={(e) => updatePair(i, { left: e.target.value })} />
          <input style={fieldStyle} placeholder="Right (match)" value={pair.right} onChange={(e) => updatePair(i, { right: e.target.value })} />
          <Button variant="ghost" size="sm" onClick={() => removePair(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addPair}>+ Add pair</Button>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function TradeoffMatrixInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "tradeoff_matrix" }>>) {
  function updateCriterion(i: number, label: string) {
    onChange({ criteria: block.criteria.map((c, idx) => (idx === i ? { ...c, label } : c)) });
  }
  function addCriterion() {
    onChange({ criteria: [...block.criteria, { id: randId("crit"), label: "" }] });
  }
  function removeCriterion(i: number) {
    const id = block.criteria[i].id;
    onChange({
      criteria: block.criteria.filter((_, idx) => idx !== i),
      options: block.options.map((o) => {
        const values = { ...o.values };
        delete values[id];
        return { ...o, values };
      }),
    });
  }
  function updateOption(i: number, patch: Partial<(typeof block.options)[number]>) {
    onChange({ options: block.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  }
  function addOption() {
    onChange({ options: [...block.options, { id: randId("opt"), label: "", values: {}, effects: [] }] });
  }
  function removeOption(i: number) {
    onChange({ options: block.options.filter((_, idx) => idx !== i) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Criteria (columns)</span>
        {block.criteria.map((c, i) => (
          <div key={c.id} style={rowStyle}>
            <input style={fieldStyle} value={c.label} onChange={(e) => updateCriterion(i, e.target.value)} />
            <Button variant="ghost" size="sm" onClick={() => removeCriterion(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addCriterion}>+ Add criterion</Button>
      </div>
      <div>
        <span style={labelStyle}>Options (rows)</span>
        {block.options.map((opt, i) => (
          <div key={opt.id} style={{ border: "1px solid var(--bow-border, #eee)", borderRadius: 6, padding: 8, marginBottom: 6 }}>
            <input style={fieldStyle} placeholder="Option label" value={opt.label} onChange={(e) => updateOption(i, { label: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(block.criteria.length, 1)}, 1fr)`, gap: 6, marginTop: 6 }}>
              {block.criteria.map((c) => (
                <div key={c.id}>
                  <span style={labelStyle}>{c.label || c.id}</span>
                  <input
                    style={fieldStyle}
                    type="number"
                    value={opt.values[c.id] ?? ""}
                    onChange={(e) => updateOption(i, { values: { ...opt.values, [c.id]: Number(e.target.value) } })}
                  />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeOption(i)}>Remove option</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addOption}>+ Add option</Button>
      </div>
    </div>
  );
}

export function ForecastInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "forecast" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Target value</span>
          <input style={fieldStyle} type="number" value={block.correctValue} onChange={(e) => onChange({ correctValue: Number(e.target.value) })} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Tolerance band (+/-)</span>
          <input style={fieldStyle} type="number" value={block.tolerance} onChange={(e) => onChange({ tolerance: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <span style={labelStyle}>Unit</span>
        <select style={fieldStyle} value={block.unit} onChange={(e) => onChange({ unit: e.target.value as typeof block.unit })}>
          <option value="number">Number</option>
          <option value="currency">Currency</option>
          <option value="percent">Percent</option>
        </select>
      </div>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function TableInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "table" }>>) {
  function updateColumn(i: number, patch: Partial<(typeof block.columns)[number]>) {
    onChange({ columns: block.columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  function addColumn() {
    const key = randId("col");
    onChange({ columns: [...block.columns, { key, label: "" }] });
  }
  function removeColumn(i: number) {
    const key = block.columns[i].key;
    onChange({
      columns: block.columns.filter((_, idx) => idx !== i),
      rows: block.rows.map((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      }),
    });
  }
  function updateCell(rowIdx: number, key: string, value: string) {
    onChange({ rows: block.rows.map((r, idx) => (idx === rowIdx ? { ...r, [key]: value } : r)) });
  }
  function addRow() {
    onChange({ rows: [...block.rows, Object.fromEntries(block.columns.map((c) => [c.key, ""]))] });
  }
  function removeRow(i: number) {
    onChange({ rows: block.rows.filter((_, idx) => idx !== i) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Caption (optional)</span>
        <input style={fieldStyle} value={block.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Columns</span>
        {block.columns.map((c, i) => (
          <div key={c.key} style={rowStyle}>
            <input style={fieldStyle} placeholder="Label" value={c.label} onChange={(e) => updateColumn(i, { label: e.target.value })} />
            <Button variant="ghost" size="sm" onClick={() => removeColumn(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addColumn}>+ Add column</Button>
      </div>
      <div>
        <span style={labelStyle}>Rows</span>
        {block.rows.map((row, i) => (
          <div key={i} style={rowStyle}>
            {block.columns.map((c) => (
              <input key={c.key} style={fieldStyle} placeholder={c.label} value={String(row[c.key] ?? "")} onChange={(e) => updateCell(i, c.key, e.target.value)} />
            ))}
            <Button variant="ghost" size="sm" onClick={() => removeRow(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addRow}>+ Add row</Button>
      </div>
    </div>
  );
}

export function ChartInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "chart" }>>) {
  function updatePoint(i: number, patch: Partial<{ label: string; value: number }>) {
    onChange({ series: block.series.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  }
  function addPoint() {
    onChange({ series: [...block.series, { label: "", value: 0 }] });
  }
  function removePoint(i: number) {
    onChange({ series: block.series.filter((_, idx) => idx !== i) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Title (optional)</span>
        <input style={fieldStyle} value={block.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Chart kind</span>
        <select style={fieldStyle} value={block.chartKind} onChange={(e) => onChange({ chartKind: e.target.value as typeof block.chartKind })}>
          <option value="bar">Bar</option>
          <option value="line">Line</option>
        </select>
      </div>
      <div>
        <span style={labelStyle}>Data points</span>
        {block.series.map((s, i) => (
          <div key={i} style={rowStyle}>
            <input style={fieldStyle} placeholder="Label" value={s.label} onChange={(e) => updatePoint(i, { label: e.target.value })} />
            <input
              style={fieldStyle}
              type="number"
              placeholder="Value"
              value={typeof s.value === "number" ? s.value : ""}
              onChange={(e) => updatePoint(i, { value: Number(e.target.value) })}
            />
            <Button variant="ghost" size="sm" onClick={() => removePoint(i)}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addPoint}>+ Add point</Button>
      </div>
    </div>
  );
}

export function TimelineInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "timeline" }>>) {
  function updateEvent(i: number, patch: Partial<(typeof block.events)[number]>) {
    onChange({ events: block.events.map((ev, idx) => (idx === i ? { ...ev, ...patch } : ev)) });
  }
  function addEvent() {
    onChange({ events: [...block.events, { label: "", when: "" }] });
  }
  function removeEvent(i: number) {
    onChange({ events: block.events.filter((_, idx) => idx !== i) });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {block.events.map((ev, i) => (
        <div key={i} style={{ border: "1px solid var(--bow-border, #eee)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <input style={fieldStyle} placeholder="When" value={ev.when} onChange={(e) => updateEvent(i, { when: e.target.value })} />
          <input style={fieldStyle} placeholder="Label" value={ev.label} onChange={(e) => updateEvent(i, { label: e.target.value })} />
          <input style={fieldStyle} placeholder="Description (optional)" value={ev.description ?? ""} onChange={(e) => updateEvent(i, { description: e.target.value })} />
          <Button variant="ghost" size="sm" onClick={() => removeEvent(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addEvent}>+ Add event</Button>
    </div>
  );
}
