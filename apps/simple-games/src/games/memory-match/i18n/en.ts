/**
 * Memory Match's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for memory-match's.
 */
export const en = {
  memoryMatchName: 'Memory Match',
  memoryChooseBoard: 'Choose a board',
  memoryDifficulty_easy: 'Easy',
  memoryDifficulty_medium: 'Medium',
  memoryDifficulty_hard: 'Hard',
  memoryBoardNote: '{cols}×{rows} · {pairs} pairs',
  memoryConfirmSwitchTitle: 'Replace the game in progress?',
  memoryConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  memoryBoardLabel: 'Memory board, {cols} by {rows}',
  memoryCardDown: 'Face down, row {row}, column {col}',
  memoryCardUp: 'Symbol {n}, row {row}, column {col}',
  memoryCardMatched: 'Matched, symbol {n}, row {row}, column {col}',
  memoryPairsLabel: 'Pairs',
  memoryClearTitle: 'All pairs found!',
  memoryClearBody: 'Every card is face up.',
  memoryNewBestMoves: 'Your fewest moves yet.',
  memoryNewBestTime: 'Your fastest yet.',
  memoryBestMoves: 'Fewest moves',
  memoryDailiesCleared: 'Days cleared',
  memoryDailyBacklogHint: 'Every earlier day stays open.',
  memoryStep1Title: 'Flip two cards',
  memoryStep1Body: 'Tap one card, then another. A matching pair stays face up.',
  memoryStep2Title: 'No rush to remember',
  memoryStep2Body: 'A missed pair stays visible until your next flip. Take your time.',
  memoryStep3Title: 'Match every pair',
  memoryStep3Body: 'Clear the whole board. Retrying the same board is always free.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type MemoryMatchMessages = Record<keyof typeof en, string>;
