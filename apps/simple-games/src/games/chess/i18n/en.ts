/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  chessName: 'Chess',
  chessPlayPlaceholder: 'Play a sample round',
  chessFinishPlaceholder: 'Finish the sample round',
  chessStep1Title: 'Step 1',
  chessStep1Body: 'Placeholder. The first of at most three steps.',
  chessStep2Title: 'Step 2',
  chessStep2Body: 'Placeholder. What the player does next.',
  chessStep3Title: 'Step 3',
  chessStep3Body: 'Placeholder. How a round ends.',
  chessResultTitle: 'Nice work',
  chessResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ChessMessages = Record<keyof typeof en, string>;
