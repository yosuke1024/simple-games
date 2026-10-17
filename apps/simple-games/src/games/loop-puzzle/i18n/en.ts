/**
 * Loop Puzzle's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. This
 * file is the source (`source` provenance, docs/LOOP_PUZZLE_RULES.md §14);
 * every other locale is measured against it.
 *
 * The board itself carries no words. Numbers are ASCII digits and the lines
 * and × marks are CSS / inline SVG (§1, §13), so everything here is chrome —
 * and the spoken names of edges and numbers, which a screen reader needs
 * where a sighted player reads the board. Every sentence is whole: variable
 * parts arrive through `{var}` placeholders, never by joining strings.
 */
export const en = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Choose a board',
  loopPuzzleDifficulty_easy: 'Easy',
  loopPuzzleDifficulty_medium: 'Medium',
  loopPuzzleDifficulty_hard: 'Hard',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Replace the board in progress?',
  loopPuzzleConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  loopPuzzleBoardLabel: 'Loop Puzzle board, {width} by {height}',
  /** Horizontal edges come in rows of dots; `row` is that row, `col` the edge's place in it (§13). */
  loopPuzzleEdgeHEmpty: 'Horizontal edge, row {row}, column {col}, empty',
  loopPuzzleEdgeHLine: 'Horizontal edge, row {row}, column {col}, line',
  loopPuzzleEdgeHCross: 'Horizontal edge, row {row}, column {col}, crossed out',
  /** Vertical edges come in rows of cells; `col` counts the columns of dots. */
  loopPuzzleEdgeVEmpty: 'Vertical edge, row {row}, column {col}, empty',
  loopPuzzleEdgeVLine: 'Vertical edge, row {row}, column {col}, line',
  loopPuzzleEdgeVCross: 'Vertical edge, row {row}, column {col}, crossed out',
  /** A number cell, read with its state against the lines drawn (§5). */
  loopPuzzleClueOpen: 'Number {n}, row {row}, column {col}',
  loopPuzzleClueMet: 'Number {n}, row {row}, column {col}, met',
  loopPuzzleClueTooMany: 'Number {n}, row {row}, column {col}, too many lines',
  loopPuzzleClueTooFew: 'Number {n}, row {row}, column {col}, cannot be met',
  /** Read after an element's own name, as its description. */
  loopPuzzleNoteHint: 'Marked by the hint',
  loopPuzzleNoteConflict: 'Breaks a rule',
  /** The board's one line of rule feedback (§5): what the marks break right now. */
  loopPuzzleConflictBranch: 'A dot has more than two lines.',
  loopPuzzleConflictDeadEnd: 'A line ends at a dot with no way on.',
  loopPuzzleConflictLoop: 'A closed loop leaves other lines outside it.',
  loopPuzzleConflictTooMany: 'A number has more lines than it shows.',
  loopPuzzleConflictTooFew: 'A number can no longer get enough lines.',
  loopPuzzleConflictClosed: 'The loop is closed, but a number does not match.',
  /** The hint (§6): what is marked on the board, and why. It never writes the mark. */
  loopPuzzleHintWrongLine: 'The marked line is not part of the loop.',
  loopPuzzleHintWrongCross: 'The loop runs along the marked ×.',
  loopPuzzleHintCellLine: 'The ringed number needs a line on the marked edge.',
  loopPuzzleHintCellCross: 'The ringed number leaves no line for the marked edge.',
  loopPuzzleHintDotLine: 'At the ringed dot, the loop must use the marked edge.',
  loopPuzzleHintDotCross: 'At the ringed dot, the marked edge cannot be a line.',
  loopPuzzleHintLoopCross: 'A line on the marked edge would close a loop too soon.',
  loopPuzzleHintClosedCross: 'The loop is closed, so the marked edge is not part of it.',
  loopPuzzleHintTrialLine: 'Without a line on the marked edge, a contradiction follows.',
  loopPuzzleHintTrialCross: 'A line on the marked edge leads to a contradiction.',
  loopPuzzleHintRevealLine: 'The marked edge is part of the loop.',
  loopPuzzleHintRevealCross: 'The marked edge is not part of the loop.',
  loopPuzzleHintNone: 'No hint right now.',
  loopPuzzleSolvedTitle: 'Solved!',
  loopPuzzleSolvedBody: 'One closed loop, every number met.',
  loopPuzzleHintsUsed: 'Hints used',
  loopPuzzleNewBestTime: 'Your fastest yet.',
  loopPuzzleNewBoard: 'New board',
  loopPuzzleSolvedCount: 'Puzzles solved',
  loopPuzzleDailySection: 'Daily',
  loopPuzzleDailiesCleared: 'Days cleared',
  loopPuzzleAllBoards: 'All boards',
  loopPuzzleStep1Title: 'One closed loop',
  loopPuzzleStep1Body: 'Join the dots into one closed loop that never branches or crosses itself.',
  loopPuzzleStep2Title: 'Read the numbers',
  loopPuzzleStep2Body: 'A number says how many of its four sides the loop uses.',
  loopPuzzleStep3Title: 'Tap an edge',
  loopPuzzleStep3Body:
    'Each tap on an edge turns it into a line, then × for “not on the loop”, then empty.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type LoopPuzzleMessages = Record<keyof typeof en, string>;
