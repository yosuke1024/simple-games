/**
 * Number Path's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. The shell's en.ts
 * stays the source of truth for shared keys, this file for this game's.
 *
 * The board itself carries no words. Numbers are ASCII digits, walls are
 * thick edges and the path is a thick line — identical in every locale
 * (docs/NUMBER_PATH_RULES.md §1, §11) — so everything here is chrome.
 */
export const en = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Choose a board',
  numberPathDifficulty_easy: 'Easy',
  numberPathDifficulty_medium: 'Medium',
  numberPathDifficulty_hard: 'Hard',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path board, {width} by {height}',
  numberPathCellPlain: 'Row {row}, column {col}',
  numberPathCellNumber: 'Number {n}, row {row}, column {col}',
  /** Appended to a cell's label: where it stands on the path (§11). */
  numberPathOnPath: 'on the path, step {step}',
  numberPathOffPath: 'not on the path',
  numberPathHintNext: 'The marked square is the next step.',
  numberPathHintBack: 'The path has gone astray. Back up to the marked square.',
  numberPathHintNone: 'No hint right now.',
  /** Appended to the hinted cell's label, after its path status (§11). */
  numberPathHintMarked: 'hint',
  numberPathSolvedTitle: 'Solved!',
  numberPathSolvedBody: 'One line, every square, in order.',
  numberPathHintsUsed: 'Hints used',
  numberPathNewBestTime: 'Your fastest yet.',
  numberPathNewBoard: 'New board',
  numberPathSolvedCount: 'Boards solved',
  numberPathDailySection: 'Daily',
  numberPathDailiesSolved: 'Days solved',
  numberPathDailyBacklogHint: 'Every earlier day stays open.',
  numberPathStep1Title: 'Follow the numbers',
  numberPathStep1Body: 'Draw one line from 1, visiting the numbers in order.',
  numberPathStep2Title: 'Cover every square',
  numberPathStep2Body: 'The line passes through every square once and ends on the last number.',
  numberPathStep3Title: 'Walls block the way',
  numberPathStep3Body:
    'A thick edge cannot be crossed; to go back, drag along the line or tap a square on it.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type NumberPathMessages = Record<keyof typeof en, string>;
