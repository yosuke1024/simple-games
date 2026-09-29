/**
 * Hint — implements docs/SUDOKU_6X6_RULES.md §5.
 *
 * A hint never fills a cell. It shows the next step logic allows and the unit
 * that justifies it, so the player learns the move instead of receiving the
 * answer. Technique names stay internal; the UI paraphrases them in plain
 * language (§5), which also keeps the wording translatable.
 */
import { toGrid, type Board } from './engine';
import { findStep, type Step, type Technique, type UnitRef } from './grader';
import type { Digit } from './types';

/**
 * How the UI should phrase a hint. One key per shape of explanation rather
 * than one per technique: both pairs read as the same plain sentence, and
 * fewer sentences is fewer things to translate.
 */
export type HintKind =
  | 'onlyDigitForCell'
  | 'onlyCellForDigit'
  | 'digitLockedToLine'
  | 'digitLockedToBox'
  | 'candidatesRuledOut';

export const HINT_KINDS: readonly HintKind[] = [
  'onlyDigitForCell',
  'onlyCellForDigit',
  'digitLockedToLine',
  'digitLockedToBox',
  'candidatesRuledOut',
];

export interface Hint {
  readonly kind: HintKind;
  /** Cells to highlight as the reason. */
  readonly focus: readonly number[];
  /** The unit to tint, when one justifies the step. */
  readonly unit?: UnitRef;
  /** The digit the hint is about, when it is about one. */
  readonly digit?: Digit;
  /** Set only for a placement: the cell the player should fill. */
  readonly target?: number;
  /** The technique behind it — for tests, never for display (§5). */
  readonly technique: Technique;
}

function hintFor(step: Step): Hint {
  if (step.kind === 'placement') {
    return {
      kind: step.technique === 'nakedSingle' ? 'onlyDigitForCell' : 'onlyCellForDigit',
      focus: [step.index],
      ...(step.unit ? { unit: step.unit } : {}),
      digit: step.digit,
      target: step.index,
      technique: step.technique,
    };
  }

  const kind: HintKind =
    step.technique === 'lockedCandidatesPointing'
      ? 'digitLockedToLine'
      : step.technique === 'lockedCandidatesClaiming'
        ? 'digitLockedToBox'
        : 'candidatesRuledOut';

  return {
    kind,
    focus: step.pattern,
    ...(step.unit ? { unit: step.unit } : {}),
    ...(step.digits.length === 1 ? { digit: step.digits[0]! } : {}),
    technique: step.technique,
  };
}

/**
 * The next hint for a board, or null when nothing is derivable. On a
 * generated puzzle this cannot happen while cells remain empty (§7: the
 * tier's techniques finish it), so null is only reached on a board the
 * player has contradicted — the screen then says so and changes nothing (§5).
 */
export function findHint(board: Board): Hint | null {
  const step = findStep(toGrid(board));
  return step === null ? null : hintFor(step);
}
