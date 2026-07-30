/**
 * Hint — implements docs/SUDOKU_RULES.md §5.
 *
 * A hint never fills a cell. It shows the next step logic allows and the unit
 * that justifies it, so the player learns the move instead of receiving the
 * answer. Technique names stay internal; the UI paraphrases them in plain
 * language, which also keeps the wording translatable in every language
 * (docs/I18N_POLICY.md).
 */
import { toGrid, type Board } from './engine';
import { findStep, type Step, type Technique, type UnitRef } from './grader';
import type { Digit } from './types';

/**
 * How the UI should phrase a hint. One key per shape of explanation rather
 * than one per technique: several techniques share the same plain sentence,
 * and fewer sentences is fewer things to translate.
 */
export type HintKind =
  | 'onlyDigitForCell'
  | 'onlyCellForDigit'
  | 'digitLockedToLine'
  | 'digitLockedToBox'
  | 'candidatesRuledOut';

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
  /** The technique behind it — for statistics and tests, not for display. */
  readonly technique: Technique;
}

function hintFor(step: Step): Hint {
  if (step.kind === 'placement') {
    return step.technique === 'nakedSingle'
      ? {
          kind: 'onlyDigitForCell',
          focus: [step.index],
          digit: step.digit,
          target: step.index,
          technique: step.technique,
        }
      : {
          kind: 'onlyCellForDigit',
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
 * The next hint for a board, or null when nothing is derivable. On a puzzle
 * generated for a tier this cannot happen while cells remain empty (§7
 * guarantees the tier's techniques finish it), so null is only reached on a
 * finished board or one the player has contradicted.
 */
export function findHint(board: Board): Hint | null {
  const step = findStep(toGrid(board));
  return step === null ? null : hintFor(step);
}
