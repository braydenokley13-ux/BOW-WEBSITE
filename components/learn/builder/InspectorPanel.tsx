"use client";

/* ============================================================
 * components/learn/builder/InspectorPanel.tsx — RIGHT panel: per-block
 * settings form for the selected block, plus lesson-level tabs
 * (Variables / Scoring / Results).
 * ============================================================ */

import { useState } from "react";
import type { LessonDoc } from "@/lib/learn/types";
import InspectorRouter from "./inspectors/InspectorRouter";
import VariablesPanel from "./VariablesPanel";
import ScoringPanel from "./ScoringPanel";
import SkillsPanel from "./SkillsPanel";
import ResultsPanel from "./ResultsPanel";
import { fieldStyle, labelStyle } from "./formStyles";
import type { BuilderAction, Selection } from "./builderReducer";

type Tab = "block" | "variables" | "scoring" | "skills" | "results";

export interface InspectorPanelProps {
  doc: LessonDoc;
  selection: Selection;
  dispatch: (action: BuilderAction) => void;
}

export default function InspectorPanel({ doc, selection, dispatch }: InspectorPanelProps) {
  const [tab, setTab] = useState<Tab>("block");
  const phase = doc.phases.find((p) => p.id === selection.phaseId);
  const block = phase?.blocks.find((b) => b.id === selection.blockId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--bow-border, #e4e4e7)", padding: "0 8px" }}>
        {(["block", "variables", "scoring", "skills", "results"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "10px 12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: tab === id ? "2px solid var(--bow-orange-solid)" : "2px solid transparent",
              color: tab === id ? "inherit" : "var(--bow-muted-text, #767a85)",
              fontWeight: tab === id ? 700 : 500,
            }}
          >
            {id}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {tab === "block" &&
          (block && phase ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <span style={labelStyle}>Block ID</span>
                <input style={{ ...fieldStyle, opacity: 0.6 }} value={block.id} readOnly />
              </div>
              <InspectorRouter
                block={block}
                doc={doc}
                variables={doc.variables}
                onChange={(patch) => dispatch({ type: "UPDATE_BLOCK", phaseId: phase.id, blockId: block.id, patch })}
              />
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
              Select a block on the canvas to edit its settings.
            </p>
          ))}
        {tab === "variables" && (
          <VariablesPanel variables={doc.variables} onChange={(variables) => dispatch({ type: "SET_VARIABLES", variables })} />
        )}
        {tab === "scoring" && (
          <ScoringPanel scoring={doc.scoring} onChange={(scoring) => dispatch({ type: "SET_SCORING", scoring })} />
        )}
        {tab === "skills" && (
          <SkillsPanel skills={doc.skills} onChange={(skills) => dispatch({ type: "SET_SKILLS", skills })} />
        )}
        {tab === "results" && (
          <ResultsPanel results={doc.results} onChange={(results) => dispatch({ type: "SET_RESULTS", results })} />
        )}
      </div>
    </div>
  );
}
