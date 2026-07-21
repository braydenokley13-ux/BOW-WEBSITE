"use client";

import type { Block } from "@/lib/learn/types";
import { fieldStyle, labelStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

type MediaBlock = Extract<Block, { type: "media" }>;

export default function MediaInspector({ block, onChange }: BlockInspectorProps<MediaBlock>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Kind</span>
        <select style={fieldStyle} value={block.kind} onChange={(e) => onChange({ kind: e.target.value as MediaBlock["kind"] })}>
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="podcast">Podcast</option>
        </select>
      </div>
      <div>
        <span style={labelStyle}>Source URL</span>
        <input style={fieldStyle} value={block.src} onChange={(e) => onChange({ src: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Title (optional)</span>
        <input style={fieldStyle} value={block.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Completion requirement</span>
        <select
          style={fieldStyle}
          value={block.completion.mode}
          onChange={(e) => {
            const mode = e.target.value as MediaBlock["completion"]["mode"];
            onChange({
              completion:
                mode === "percent"
                  ? { mode, threshold: 0.8 }
                  : ({ mode } as MediaBlock["completion"]),
            });
          }}
        >
          <option value="none">None — always considered complete</option>
          <option value="started">Started playing</option>
          <option value="percent">Played a % through</option>
          <option value="finished">Finished</option>
        </select>
      </div>
      {block.completion.mode === "percent" && (
        <div>
          <span style={labelStyle}>Percent threshold (0–100)</span>
          <input
            style={fieldStyle}
            type="number"
            min={1}
            max={100}
            value={Math.round(block.completion.threshold * 100)}
            onChange={(e) => onChange({ completion: { mode: "percent", threshold: Number(e.target.value) / 100 } })}
          />
        </div>
      )}
    </div>
  );
}
