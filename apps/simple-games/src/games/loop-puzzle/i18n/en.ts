/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzlePlayPlaceholder: 'Play a sample round',
  loopPuzzleFinishPlaceholder: 'Finish the sample round',
  loopPuzzleStep1Title: 'Step 1',
  loopPuzzleStep1Body: 'Placeholder. The first of at most three steps.',
  loopPuzzleStep2Title: 'Step 2',
  loopPuzzleStep2Body: 'Placeholder. What the player does next.',
  loopPuzzleStep3Title: 'Step 3',
  loopPuzzleStep3Body: 'Placeholder. How a round ends.',
  loopPuzzleResultTitle: 'Nice work',
  loopPuzzleResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type LoopPuzzleMessages = Record<keyof typeof en, string>;
