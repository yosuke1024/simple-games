/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  overtakeName: 'Overtake',
  overtakePlayPlaceholder: 'Play a sample round',
  overtakeFinishPlaceholder: 'Finish the sample round',
  overtakeStep1Title: 'Step 1',
  overtakeStep1Body: 'Placeholder. The first of at most three steps.',
  overtakeStep2Title: 'Step 2',
  overtakeStep2Body: 'Placeholder. What the player does next.',
  overtakeStep3Title: 'Step 3',
  overtakeStep3Body: 'Placeholder. How a round ends.',
  overtakeResultTitle: 'Nice work',
  overtakeResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type OvertakeMessages = Record<keyof typeof en, string>;
