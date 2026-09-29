/**
 * One plain sentence per hint shape — never a technique name
 * (docs/SUDOKU_6X6_RULES.md §5). Referenced statically so every key stays
 * greppable (docs/I18N_POLICY.md).
 */
import type { HintKind } from '../game';

export const HINT_MESSAGE = {
  onlyDigitForCell: 'sudoku6x6HintOnlyDigit',
  onlyCellForDigit: 'sudoku6x6HintOnlyCell',
  digitLockedToLine: 'sudoku6x6HintLockedLine',
  digitLockedToBox: 'sudoku6x6HintLockedBox',
  candidatesRuledOut: 'sudoku6x6HintRuledOut',
} as const satisfies Record<HintKind, string>;
