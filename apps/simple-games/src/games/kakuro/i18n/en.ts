/**
 * Kakuro's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for kakuro's.
 *
 * The board itself carries no words. Its digits and its sums are ASCII `0`-`9`
 * and its only symbol is one diagonal line, identical in every locale
 * (docs/KAKURO_RULES.md §1, docs/I18N_POLICY.md) — so everything here is
 * chrome, plus the words a screen reader hears where a sighted player sees a
 * split square with two numbers in it.
 *
 * THREE RULES THIS CATALOG IS HELD TO
 *
 * A clue is read in WORDS, never by naming the shape (§13). "Sigma", "slash"
 * or "diagonal" tells a listener nothing about which of the two sums runs
 * right and which runs down, and that is the only thing the square says. This
 * matters more here than the sign wording does in Futoshiki: drop Futoshiki's
 * signs and a box-less Sudoku is left, but drop Kakuro's clues and there is
 * nothing at all — the puzzle hands out no digits (§1).
 *
 * No technique is ever named (§6). "Fixed partition" and "naked pair" are
 * internal words; the hint speaks in plain sentences, which is both a limit on
 * how much text a screen has to hold and a way to avoid keeping a glossary
 * consistent across fourteen languages.
 *
 * The hint strings never name an axis. A deduction can come off a horizontal
 * run, a vertical one, or the crossing of the two, so any locale that wrote
 * "row" here would be wrong much of the time — the exact bug four of Takuzu's
 * locales shipped with.
 */
export const en = {
  kakuroName: 'Kakuro',
  /**
   * Free Play's three tiers (§9「フリープレイ」): levels 10 / 50 / 95 by
   * another name. The picker's words, not the game's — this game has no
   * difficulty type (§7), and the board shows its size, not a tier.
   */
  kakuroTier_easy: 'Easy',
  kakuroTier_medium: 'Medium',
  kakuroTier_hard: 'Hard',
  kakuroBoardLabel: 'Kakuro board, {size} by {size}',
  kakuroCellEmpty: 'Empty, row {row}, column {col}',
  kakuroCellEntry: '{value}, row {row}, column {col}',
  /** A square carrying at least one sum; the sums follow as their own words. */
  kakuroClueCell: 'Clue, row {row}, column {col}',
  /** A square carrying neither sum — a plain block in the grid (§1). */
  kakuroClueBlank: 'Blank, row {row}, column {col}',
  /**
   * One run, in words. Read on the clue square that carries the sum and again
   * on every white square inside the run, because in this game the clue lives
   * OUTSIDE the square being filled — a listener who is not told it here has
   * to travel to the clue and back for every square (§13).
   */
  kakuroClueRight: 'Right, sum {sum} across {n} cells',
  kakuroClueDown: 'Down, sum {sum} across {n} cells',
  /** Appended to a cell's label while it takes part in breaking a rule (§5). */
  kakuroRuleBroken: 'Breaks a rule',
  kakuroSizeLabel: '{n}×{n}',
  kakuroPadLabel: 'Number pad',
  kakuroPadNoteKey: 'Note {value}',
  kakuroErase: 'Erase',
  kakuroNotes: 'Notes',
  kakuroMistakes: 'Mistakes',
  kakuroHintsUsed: 'Hints used',
  kakuroHintPlacement: 'The highlighted cells leave one digit for the marked one.',
  kakuroHintElimination: 'The highlighted sums rule digits out of the marked cells.',
  kakuroHintBroken: 'The highlighted cells break a rule.',
  kakuroHintNone: 'Nothing can be worked out yet.',
  kakuroSolvedTitle: 'Solved!',
  kakuroSolvedBody: 'Every group adds up to its clue, with no digit used twice.',
  kakuroNewBestTime: 'Your fastest yet.',
  kakuroLevelsSolved: 'Levels solved',
  kakuroDailiesSolved: 'Dailies solved',
  kakuroDailyBacklogHint: 'Every earlier day stays open.',
  kakuroHighlightMistakes: 'Show mistakes',
  kakuroHighlightMistakesNote:
    'Marks a digit that does not match the solution. Broken rules are always marked.',
  kakuroStep1Title: 'Add up to the clue',
  kakuroStep1Body: 'Fill each group of cells with digits 1 to 9 that add up to its clue.',
  kakuroStep2Title: 'No digit twice',
  kakuroStep2Body: 'Within one group, no digit may be used more than once.',
  kakuroStep3Title: 'Narrow it down',
  kakuroStep3Body: 'Two cells adding to 16 can only be 7 and 9. Stuck? Take a hint.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type KakuroMessages = Record<keyof typeof en, string>;
