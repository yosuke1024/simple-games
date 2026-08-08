/**
 * Takuzu's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for takuzu's.
 *
 * The board itself carries no words. Its two values are the digits 0 and 1 —
 * ASCII, identical in every locale, and unambiguous to a screen reader
 * (docs/TAKUZU_RULES.md §1, §13) — so everything here is chrome.
 */
export const en = {
  takuzuName: 'Takuzu',
  takuzuBoardLabel: 'Takuzu board, {size} by {size}',
  takuzuCellEmpty: 'Empty, row {row}, column {col}',
  takuzuCellZero: '0, row {row}, column {col}',
  takuzuCellOne: '1, row {row}, column {col}',
  takuzuCellFixed: 'Fixed {digit}, row {row}, column {col}',
  /** Appended to a cell's label while its row or column breaks a rule (§9). */
  takuzuRuleBroken: 'breaks a rule',
  takuzuSizeLabel: '{n}×{n}',
  takuzuHintFound: 'The highlighted line settles the marked square.',
  takuzuHintBroken: 'The highlighted line breaks a rule.',
  takuzuHintNone: 'No certain move found right now.',
  takuzuSolvedTitle: 'Solved!',
  takuzuSolvedBody: 'Every row and column holds.',
  takuzuHintsUsed: 'Hints used',
  takuzuNewBestTime: 'Your fastest yet.',
  takuzuLevelsSolved: 'Levels solved',
  takuzuDailiesSolved: 'Dailies solved',
  takuzuDailyBacklogHint: 'Every earlier day stays open.',
  takuzuStep1Title: 'Never three in a row',
  takuzuStep1Body: 'Tap a square to cycle 0, 1, empty. The same digit may not sit three in a row.',
  takuzuStep2Title: 'Half and half',
  takuzuStep2Body: 'Every row and every column holds as many 0s as 1s.',
  takuzuStep3Title: 'No line twice',
  takuzuStep3Body: 'No two rows may read alike, and no two columns either.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type TakuzuMessages = Record<keyof typeof en, string>;
