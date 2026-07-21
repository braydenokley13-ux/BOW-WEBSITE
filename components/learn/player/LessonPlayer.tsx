"use client";

/* ============================================================
 * components/learn/player/LessonPlayer.tsx — Stage 2 thin player.
 *
 * Phase stepper (Briefing→Learn→Decision→Consequence→FollowUp→Challenge),
 * progress bar, variable HUD (ds/DataStrip), useReducer over
 * {cursor, variables, responses, path} (components/learn/player/playerState.ts),
 * client-optimistic grading via lib/learn/engine, server-authoritative
 * persistence via app/actions/learn-play.ts. Dark `.bow-front-office`
 * treatment for the play surface per plan §3.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LessonDoc } from "@/lib/learn/types";
import DataStrip, { type DataItem } from "@/components/ds/DataStrip";
import Button from "@/components/ds/Button";
import { getPlayerComponent, isAutoAdvanceType } from "./blockRegistry";
import {
  flattenBlocks,
  initPlayerState,
  isBlockVisible,
  playerReducer,
  progressFraction,
  type ResponseEntry,
} from "./playerState";
import { submitResponse, completeAttempt } from "@/app/actions/learn-play";

export interface LessonPlayerProps {
  lessonId: string;
  attemptId: string;
  doc: LessonDoc;
  /** For a resumed in_progress attempt — already-committed responses/variables/path. */
  resume?: {
    responses?: Record<string, ResponseEntry>;
    variables?: Record<string, number>;
    path?: string[];
  };
}

function unitLabel(unit: string | undefined): DataItem["tone"] {
  if (unit === "currency") return "positive";
  if (unit === "percent") return "info";
  return undefined;
}

export default function LessonPlayer({ lessonId, attemptId, doc, resume }: LessonPlayerProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(playerReducer, undefined, () => initPlayerState(doc, resume));
  const [instanceKeys, setInstanceKeys] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [finishError, setFinishError] = useState<string | null>(null);

  const flat = useMemo(() => flattenBlocks(doc), [doc]);
  const currentEntry = flat.find((f) => f.block.id === state.cursorBlockId);
  const currentPhaseIndex = currentEntry?.phaseIndex ?? doc.phases.length - 1;
  const currentVisible = currentEntry ? isBlockVisible(currentEntry.block, state.variables, state.responses) : true;

  const commitResponse = useCallback(
    (blockId: string, value: unknown) => {
      dispatch({ type: "SET_RESPONSE", doc, blockId, value });
      dispatch({ type: "COMMIT", doc, blockId });
      const instanceKey = instanceKeys[blockId] ?? 0;
      setInstanceKeys((prev) => ({ ...prev, [blockId]: instanceKey + 1 }));
      // Server-authoritative persistence — fire and forget from the player's
      // perspective; completeAttempt recomputes from persisted responses
      // regardless of what the client believed, so a transient failure here
      // is caught at completion time, not silently trusted.
      startTransition(() => {
        void submitResponse(attemptId, blockId, instanceKey, value);
      });
    },
    [doc, attemptId, instanceKeys],
  );

  const advanceContent = useCallback(
    (blockId: string) => {
      dispatch({ type: "ADVANCE", doc, blockId });
    },
    [doc],
  );

  const handleFinish = useCallback(() => {
    startTransition(async () => {
      const result = await completeAttempt(attemptId);
      if (!result.ok) {
        setFinishError(result.error);
        return;
      }
      router.push(`/dashboard/lesson/${lessonId}/results/${attemptId}`);
    });
  }, [attemptId, lessonId, router]);

  // The reducer's own visibleIf skip loop only runs at COMMIT/ADVANCE time;
  // if the *current* cursor block itself is hidden (e.g. a variable changed
  // upstream in a way that toggled a later visibleIf before this block was
  // reached), skip it here rather than rendering it or mutating state mid-render.
  useEffect(() => {
    if (!state.finished && currentEntry && !currentVisible) {
      advanceContent(currentEntry.block.id);
    }
  }, [state.finished, currentEntry, currentVisible, advanceContent]);

  if (state.error) {
    return (
      <div className="bow-front-office" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 480, textAlign: "center", color: "#fff" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>This lesson can’t load right now</h2>
          <p style={{ marginTop: 12, color: "#9a9da6", fontSize: 14 }}>{state.error}</p>
          <Button variant="secondary" href="/dashboard" style={{ marginTop: 20 }}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const fraction = progressFraction(doc, state);
  const variableItems: DataItem[] = doc.variables.filter((v) => v.visible !== false).map((v) => ({
    label: v.label,
    value:
      v.unit === "currency"
        ? `$${Math.round(state.variables[v.key] ?? v.initial).toLocaleString()}`
        : v.unit === "percent"
          ? `${Math.round(state.variables[v.key] ?? v.initial)}%`
          : String(Math.round(state.variables[v.key] ?? v.initial)),
    tone: unitLabel(v.unit),
  }));

  return (
    <div className="bow-front-office" style={{ minHeight: "100vh", background: "var(--bow-ink)", color: "#fff", paddingBottom: 96 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(20px,4vw,40px) clamp(16px,4vw,24px)" }}>
        {/* Phase stepper */}
        <ol
          aria-label="Lesson progress"
          style={{ display: "flex", gap: 6, listStyle: "none", padding: 0, margin: "0 0 20px", flexWrap: "wrap" }}
        >
          {doc.phases.map((phase, i) => (
            <li
              key={phase.id}
              aria-current={i === currentPhaseIndex ? "step" : undefined}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: 3,
                background: i === currentPhaseIndex ? "var(--bow-orange-solid)" : i < currentPhaseIndex ? "#2a2d36" : "transparent",
                border: i > currentPhaseIndex ? "1px solid var(--bow-dark-border)" : "none",
                color: i > currentPhaseIndex ? "#6c6f78" : "#fff",
              }}
            >
              {phase.kind}
            </li>
          ))}
        </ol>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={Math.round(fraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: 4, background: "var(--bow-dark-border)", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}
        >
          <div style={{ height: "100%", width: `${fraction * 100}%`, background: "var(--bow-orange-solid)", transition: "width 200ms ease" }} />
        </div>

        {/* Variable HUD */}
        {variableItems.length > 0 && (
          <DataStrip items={variableItems} dark dense style={{ marginBottom: 24 }} />
        )}

        {/* Current block */}
        {state.finished ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "flex-start" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, margin: 0 }}>Lesson complete</h2>
            <p style={{ color: "#9a9da6", fontSize: 15 }}>Submit to see your score, stars, and XP.</p>
            {finishError && (
              <p role="alert" style={{ color: "var(--bow-negative)", fontSize: 14 }}>
                {finishError}
              </p>
            )}
            <Button variant="emphasis" onClick={handleFinish} disabled={isPending} aria-label="See results">
              {isPending ? "Scoring…" : "See Results"}
            </Button>
          </div>
        ) : currentEntry && currentVisible ? (
          <BlockFrame
            entry={currentEntry}
            state={state}
            onChangeResponse={(value) => dispatch({ type: "SET_RESPONSE", doc, blockId: currentEntry.block.id, value })}
            onCommit={() => commitResponse(currentEntry.block.id, state.responses[currentEntry.block.id]?.value)}
            onAdvance={() => advanceContent(currentEntry.block.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

function BlockFrame({
  entry,
  state,
  onChangeResponse,
  onCommit,
  onAdvance,
}: {
  entry: ReturnType<typeof flattenBlocks>[number];
  state: ReturnType<typeof initPlayerState>;
  onChangeResponse: (value: unknown) => void;
  onCommit: () => void;
  onAdvance: () => void;
}) {
  const { block } = entry;
  const Player = getPlayerComponent(block.type);
  const responseEntry = state.responses[block.id];

  if (!Player) {
    // Graceful malformed-doc fallback: an unregistered block type never
    // crashes the player — it renders a skip control instead.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ color: "#9a9da6", fontSize: 14 }}>
          This block type (“{block.type}”) isn’t supported in this build yet.
        </p>
        <Button variant="secondary" onClick={onAdvance} aria-label="Skip">
          Continue
        </Button>
      </div>
    );
  }

  if (isAutoAdvanceType(block.type)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* eslint-disable-next-line react-hooks/static-components -- Player
            is a stable lookup into blockRegistry.PLAYER_COMPONENTS, not a
            component created per render. */}
        <Player
          block={block as never}
          value={responseEntry?.value}
          committed={Boolean(responseEntry?.committed)}
          feedback={responseEntry?.outcome?.feedback}
          variables={state.variables}
          onChange={onChangeResponse}
          onCommit={onCommit}
          onAdvance={onAdvance}
        />
        <Button variant="primary" onClick={onAdvance} aria-label="Continue">
          Continue
        </Button>
      </div>
    );
  }

  return (
    // Player is a stable lookup into blockRegistry.PLAYER_COMPONENTS, not a
    // component created per render.
    // eslint-disable-next-line react-hooks/static-components
    <Player
      block={block as never}
      value={responseEntry?.value}
      committed={Boolean(responseEntry?.committed)}
      feedback={responseEntry?.outcome?.feedback}
      variables={state.variables}
      onChange={onChangeResponse}
      onCommit={onCommit}
      onAdvance={onAdvance}
    />
  );
}
