/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  bounceUpName: 'Bounce Up',
  bounceUpPlayPlaceholder: 'Play a sample round',
  bounceUpFinishPlaceholder: 'Finish the sample round',
  bounceUpStep1Title: 'Step 1',
  bounceUpStep1Body: 'Placeholder. The first of at most three steps.',
  bounceUpStep2Title: 'Step 2',
  bounceUpStep2Body: 'Placeholder. What the player does next.',
  bounceUpStep3Title: 'Step 3',
  bounceUpStep3Body: 'Placeholder. How a round ends.',
  bounceUpResultTitle: 'Nice work',
  bounceUpResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BounceUpMessages = Record<keyof typeof en, string>;
