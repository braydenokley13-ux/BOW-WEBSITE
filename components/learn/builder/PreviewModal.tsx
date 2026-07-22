"use client";

/* ============================================================
 * components/learn/builder/PreviewModal.tsx — "Play as student" preview.
 *
 * Drives the same pure state machine as the real player
 * (components/learn/player/playerState.ts) and the same registry Player
 * components, but against the in-memory draft doc with a no-op persistence
 * sink and a mock attempt — no server actions, no DB writes. This is
 * distinct from the real DB-backed "Test as Student" mode (mode='test'
 * attempts via app/actions/learn-play.ts), which is a later-stage hook: the
 * same LessonPlayer component already supports that path once wired to a
 * real attemptId, so no separate integration is needed here beyond this
 * preview surface.
 * ============================================================ */

import { useMemo, useReducer, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import type { LessonDoc } from "@/lib/learn/types";
import {
  flattenBlocks,
  initPlayerState,
  isBlockVisible,
  playerReducer,
  progressFraction,
} from "@/components/learn/player/playerState";
import { getPlayerComponent, isAutoAdvanceType } from "@/components/learn/player/blockRegistry";

export interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  doc: LessonDoc;
}

type Width = "desktop" | "tablet" | "mobile";
const WIDTHS: Record<Width, number> = { desktop: 900, tablet: 620, mobile: 380 };

export default function PreviewModal({ open, onClose, doc }: PreviewModalProps) {
  const [width, setWidth] = useState<Width>("desktop");
  const [fullScreen, setFullScreen] = useState(false);
  const [state, dispatch] = useReducer(playerReducer, undefined, () => initPlayerState(doc));
  const flat = useMemo(() => flattenBlocks(doc), [doc]);
  const currentEntry = flat.find((f) => f.block.id === state.cursorBlockId);
  const fraction = progressFraction(doc, state);

  if (!open) return null;

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.keys(WIDTHS) as Width[]).map((w) => (
            <Button key={w} variant={width === w ? "primary" : "ghost"} size="sm" onClick={() => setWidth(w)}>
              {w}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setFullScreen((f) => !f)}>
          {fullScreen ? "Exit full screen" : "Play as student (full screen)"}
        </Button>
      </div>

      <div style={{ height: 3, background: "#e4e4e7", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${fraction * 100}%`, background: "var(--bow-orange-solid)" }} />
      </div>

      <div
        style={{
          width: WIDTHS[width],
          maxWidth: "100%",
          margin: "0 auto",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          padding: 20,
          overflowY: "auto",
          flex: 1,
        }}
      >
        {state.error ? (
          <p role="alert" style={{ color: "var(--bow-negative, #b3261e)" }}>
            {state.error}
          </p>
        ) : state.finished ? (
          <div>
            <h3>Lesson complete (preview)</h3>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              This is a no-op preview — no attempt, score, or XP is recorded. Use Publish + real play for authoritative results.
            </p>
          </div>
        ) : currentEntry && isBlockVisible(currentEntry.block, state.variables, state.responses) ? (
          <PreviewBlock entry={currentEntry} state={state} dispatch={dispatch} doc={doc} />
        ) : null}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 1000, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close preview
          </Button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Preview" maxWidth={980}>
      {body}
    </Modal>
  );
}

function PreviewBlock({
  entry,
  state,
  dispatch,
  doc,
}: {
  entry: ReturnType<typeof flattenBlocks>[number];
  state: ReturnType<typeof initPlayerState>;
  dispatch: React.Dispatch<Parameters<typeof playerReducer>[1]>;
  doc: LessonDoc;
}) {
  const { block } = entry;
  const Player = getPlayerComponent(block.type);
  const responseEntry = state.responses[block.id];
  const onChange = (value: unknown) => dispatch({ type: "SET_RESPONSE", doc, blockId: block.id, value });
  const onCommit = () => dispatch({ type: "COMMIT", doc, blockId: block.id });
  const onAdvance = () => dispatch({ type: "ADVANCE", doc, blockId: block.id });

  if (!Player) {
    return (
      <div>
        <p>Unsupported block type in preview: {block.type}</p>
        <Button variant="secondary" onClick={onAdvance}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* eslint-disable-next-line react-hooks/static-components -- stable registry lookup */}
      <Player
        block={block as never}
        value={responseEntry?.value}
        committed={Boolean(responseEntry?.committed)}
        feedback={responseEntry?.outcome?.feedback}
        variables={state.variables}
        onChange={onChange}
        onCommit={onCommit}
        onAdvance={onAdvance}
      />
      {isAutoAdvanceType(block.type) && (
        <Button variant="primary" onClick={onAdvance}>
          Continue
        </Button>
      )}
    </div>
  );
}
