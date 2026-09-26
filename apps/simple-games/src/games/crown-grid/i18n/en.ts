/**
 * Crown Grid's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. The shell's en.ts
 * stays the source of truth for shared keys, this file for Crown Grid's.
 *
 * The board itself carries no words. Its two marks are a language-independent
 * crown SVG and the symbol × — identical in every locale — and the regions
 * are rounded tiles in colour, with an ink seam between them
 * (docs/CROWN_GRID_RULES.md §1, §13), so everything here is chrome. The
 * difficulty names are referenced statically (ui/difficultyKey.ts), never
 * assembled at runtime.
 */
export const en = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Choose a board',
  crownGridDifficulty_easy: 'Easy',
  crownGridDifficulty_medium: 'Medium',
  crownGridDifficulty_hard: 'Hard',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Replace the board in progress?',
  crownGridConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  crownGridBoardLabel: 'Crown Grid board, {size} by {size}',
  crownGridCellEmpty: 'Empty, row {row}, column {col}, region {region}',
  crownGridCellCross: 'Crossed out, row {row}, column {col}, region {region}',
  crownGridCellCrown: 'Crown, row {row}, column {col}, region {region}',
  /** Appended to a crown's label while it takes part in a broken rule (§5). */
  crownGridRuleBroken: 'breaks a rule',
  crownGridHintViolation: 'The highlighted crowns break a rule.',
  crownGridHintWrong: 'The marked crown cannot be right.',
  crownGridHintPlace: 'The marked square must hold a crown — the highlighted area shows why.',
  crownGridHintEliminate: 'No crown can go on the marked squares — the highlighted area shows why.',
  crownGridHintNone: 'No certain move found right now.',
  crownGridSolvedTitle: 'Solved!',
  crownGridSolvedBody: 'Every row, column and region holds one crown.',
  crownGridHintsUsed: 'Hints used',
  crownGridNewBestTime: 'Your fastest yet.',
  crownGridNewBoard: 'New board',
  crownGridDailySection: 'Daily',
  crownGridDailiesSolved: 'Days solved',
  crownGridDailyBacklogHint: 'Every earlier day stays open.',
  crownGridStep1Title: 'One crown each',
  crownGridStep1Body: 'Every row, every column and every colour holds exactly one crown.',
  crownGridStep2Title: 'Crowns never touch',
  crownGridStep2Body: 'No two crowns may sit next to each other, not even diagonally.',
  crownGridStep3Title: 'Tap and drag',
  crownGridStep3Body:
    'Tap a square to cycle ×, crown, empty; drag to mark several ×. Stuck? Ask for a hint.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type CrownGridMessages = Record<keyof typeof en, string>;
