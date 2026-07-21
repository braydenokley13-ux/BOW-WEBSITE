/* ============================================================
 * components/learn/player/types.ts — shared Player component contract.
 *
 * Every block's Player component gets the same props shape so
 * blockRegistry.tsx can render any registered block uniformly from
 * LessonPlayer.tsx without a switch statement.
 * ============================================================ */

import type { Block } from "@/lib/learn/types";
import type { Variables } from "@/lib/learn/engine";

export interface BlockPlayerProps<B extends Block = Block> {
  block: B;
  /** Current (possibly uncommitted) response value for this block, if any. */
  value: unknown;
  /** Once true, the response is locked — render read-only / disabled controls. */
  committed: boolean;
  /** Feedback/outcome text to show once committed, if the block produced any. */
  feedback?: string;
  /** Live lesson variables (for content blocks bound to a variable ref, e.g. stat). */
  variables: Variables;
  /** Update the in-progress (uncommitted) response. */
  onChange: (value: unknown) => void;
  /** Commit the current response — locks it and fires consequence/advance. */
  onCommit: () => void;
  /** For content-only blocks with no response: advance immediately. */
  onAdvance?: () => void;
}
