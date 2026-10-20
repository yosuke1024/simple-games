/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToePlayPlaceholder: 'Play a sample round',
  nestedTicTacToeFinishPlaceholder: 'Finish the sample round',
  nestedTicTacToeStep1Title: 'Step 1',
  nestedTicTacToeStep1Body: 'Placeholder. The first of at most three steps.',
  nestedTicTacToeStep2Title: 'Step 2',
  nestedTicTacToeStep2Body: 'Placeholder. What the player does next.',
  nestedTicTacToeStep3Title: 'Step 3',
  nestedTicTacToeStep3Body: 'Placeholder. How a round ends.',
  nestedTicTacToeResultTitle: 'Nice work',
  nestedTicTacToeResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type NestedTicTacToeMessages = Record<keyof typeof en, string>;
