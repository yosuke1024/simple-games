/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  snakeName: 'Snake',
  snakePlayPlaceholder: 'Play a sample round',
  snakeFinishPlaceholder: 'Finish the sample round',
  snakeStep1Title: 'Step 1',
  snakeStep1Body: 'Placeholder. The first of at most three steps.',
  snakeStep2Title: 'Step 2',
  snakeStep2Body: 'Placeholder. What the player does next.',
  snakeStep3Title: 'Step 3',
  snakeStep3Body: 'Placeholder. How a round ends.',
  snakeResultTitle: 'Nice work',
  snakeResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SnakeMessages = Record<keyof typeof en, string>;
