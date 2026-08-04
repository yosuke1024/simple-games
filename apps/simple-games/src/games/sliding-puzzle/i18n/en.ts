/**
 * Sliding Puzzle's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for sliding-puzzle's.
 */
export const en = {
  slideName: 'Sliding Puzzle',
  slideBoardLabel: 'Sliding puzzle board',
  slideTileLabel: '{value}, row {row}, column {col}',
  slideBlankLabel: 'Empty, row {row}, column {col}',
  slideSizeLabel: '{n}x{n}',
  slideMoves: 'Moves',
  slideBestMoves: 'Fewest moves',
  slideSolvedTitle: 'Solved!',
  slideSolvedBody: 'Every number is back in order.',
  slideNewBestMoves: 'Your fewest moves yet.',
  slideNewBestTime: 'Your fastest yet.',
  slideLevelsSolved: 'Levels solved',
  slideDailiesSolved: 'Dailies solved',
  slideDailyBacklogHint: 'Every earlier day stays open.',
  slideStep1Title: 'Tap next to the gap',
  slideStep1Body: 'Tap a tile beside the empty square and it slides into it.',
  slideStep2Title: 'A whole row moves',
  slideStep2Body: 'In the same row or column, every tile in between slides together.',
  slideStep3Title: 'Put 1 to the end in order',
  slideStep3Body: 'Line the numbers up in reading order with the gap at the bottom right.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SlidingPuzzleMessages = Record<keyof typeof en, string>;
