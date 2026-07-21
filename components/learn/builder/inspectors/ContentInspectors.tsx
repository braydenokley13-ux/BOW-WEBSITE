"use client";

/* ============================================================
 * components/learn/builder/inspectors/ContentInspectors.tsx — inspectors for
 * text/heading/callout/stat/comparison/image, the plain content blocks.
 * ============================================================ */

import type { Block } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { fieldStyle, labelStyle, rowStyle } from "../formStyles";

export interface BlockInspectorProps<B extends Block = Block> {
  block: B;
  onChange: (patch: Partial<B>) => void;
}

export function TextInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "text" }>>) {
  return (
    <div>
      <span style={labelStyle}>Body text</span>
      <textarea style={{ ...fieldStyle, minHeight: 100 }} value={block.body} onChange={(e) => onChange({ body: e.target.value })} />
    </div>
  );
}

export function HeadingInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "heading" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Heading text</span>
        <input style={fieldStyle} value={block.text} onChange={(e) => onChange({ text: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Level</span>
        <select style={fieldStyle} value={block.level} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })}>
          <option value={1}>Heading 1</option>
          <option value={2}>Heading 2</option>
          <option value={3}>Heading 3</option>
        </select>
      </div>
    </div>
  );
}

export function CalloutInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "callout" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Tone</span>
        <select style={fieldStyle} value={block.tone} onChange={(e) => onChange({ tone: e.target.value as typeof block.tone })}>
          <option value="info">Info</option>
          <option value="positive">Positive</option>
          <option value="warning">Warning</option>
          <option value="negative">Negative</option>
        </select>
      </div>
      <div>
        <span style={labelStyle}>Title (optional)</span>
        <input style={fieldStyle} value={block.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Body</span>
        <textarea style={{ ...fieldStyle, minHeight: 80 }} value={block.body} onChange={(e) => onChange({ body: e.target.value })} />
      </div>
    </div>
  );
}

export function StatInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "stat" }>>) {
  const isRef = typeof block.value === "object";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Label</span>
        <input style={fieldStyle} value={block.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Value (literal — variable binding not editable in this build)</span>
        <input
          style={fieldStyle}
          value={isRef ? "" : String(block.value)}
          disabled={isRef}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      </div>
    </div>
  );
}

export function ComparisonInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "comparison" }>>) {
  function update(i: number, patch: Partial<{ label: string; value: string | number; note?: string }>) {
    onChange({ items: block.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function remove(i: number) {
    onChange({ items: block.items.filter((_, idx) => idx !== i) });
  }
  function add() {
    onChange({ items: [...block.items, { label: "", value: "" }] });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {block.items.map((item, i) => (
        <div key={i} style={rowStyle}>
          <input style={fieldStyle} placeholder="Label" value={item.label} onChange={(e) => update(i, { label: e.target.value })} />
          <input
            style={fieldStyle}
            placeholder="Value"
            value={typeof item.value === "object" ? "" : String(item.value)}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <Button variant="ghost" size="sm" onClick={() => remove(i)}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={add}>
        + Add item
      </Button>
    </div>
  );
}

export function ImageInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "image" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Image URL</span>
        <input style={fieldStyle} value={block.src} onChange={(e) => onChange({ src: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Alt text</span>
        <input style={fieldStyle} value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Caption (optional)</span>
        <input style={fieldStyle} value={block.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} />
      </div>
    </div>
  );
}
