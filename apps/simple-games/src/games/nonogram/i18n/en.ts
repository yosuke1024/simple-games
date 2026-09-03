/**
 * Nonogram's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for nonogram's.
 */
export const en = {
  nonoName: 'Nonogram',
  nonoBoardLabel: 'Nonogram board, {size} by {size}',
  nonoCellBlank: 'Blank, row {row}, column {col}',
  nonoCellFilled: 'Painted, row {row}, column {col}',
  nonoCellCrossed: 'Crossed, row {row}, column {col}',
  nonoRowClueLabel: 'Row {n}: {clue}',
  nonoColClueLabel: 'Column {n}: {clue}',
  nonoSizeLabel: '{n}×{n}',
  // Free Play tiers (docs/NONOGRAM_RULES.md §6「フリープレイ」): the
  // picker's three labels, and the note on a suspended free board.
  nonoTier_easy: 'Easy',
  nonoTier_medium: 'Medium',
  nonoTier_hard: 'Hard',
  nonoXMode: 'X Mode',
  nonoXModeNote: 'Tap crosses out; long-press paints.',
  nonoHintFound: 'The highlighted line decides a square.',
  nonoHintBroken: 'The highlighted line no longer fits its clue.',
  nonoHintNone: 'No certain move found right now.',
  nonoSolvedTitle: 'Solved!',
  nonoSolvedBody: 'Every clue reads true.',
  nonoHintsUsed: 'Hints used',
  nonoNewBestTime: 'Your fastest yet.',
  nonoLevelsSolved: 'Levels solved',
  nonoDailiesSolved: 'Dailies solved',
  nonoDailyBacklogHint: 'Every earlier day stays open.',
  nonoStep1Title: 'Numbers are runs',
  nonoStep1Body:
    'Each number is a run of painted squares in order, with at least one gap between runs.',
  nonoStep2Title: 'Cross out what cannot be',
  nonoStep2Body: 'Mark the squares that stay empty with a cross to narrow the line down.',
  nonoStep3Title: 'Satisfy every line',
  nonoStep3Body:
    'When every row and column reads true, the board is done. Guessing is never needed.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type NonogramMessages = Record<keyof typeof en, string>;
