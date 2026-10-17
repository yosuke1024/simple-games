/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzlePlayPlaceholder: 'Play a sample round',
  unblockPuzzleFinishPlaceholder: 'Finish the sample round',
  unblockPuzzleStep1Title: 'Step 1',
  unblockPuzzleStep1Body: 'Placeholder. The first of at most three steps.',
  unblockPuzzleStep2Title: 'Step 2',
  unblockPuzzleStep2Body: 'Placeholder. What the player does next.',
  unblockPuzzleStep3Title: 'Step 3',
  unblockPuzzleStep3Body: 'Placeholder. How a round ends.',
  unblockPuzzleResultTitle: 'Nice work',
  unblockPuzzleResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type UnblockPuzzleMessages = Record<keyof typeof en, string>;
