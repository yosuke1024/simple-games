/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetPlayPlaceholder: 'Play a sample round',
  makeTheTargetFinishPlaceholder: 'Finish the sample round',
  makeTheTargetStep1Title: 'Step 1',
  makeTheTargetStep1Body: 'Placeholder. The first of at most three steps.',
  makeTheTargetStep2Title: 'Step 2',
  makeTheTargetStep2Body: 'Placeholder. What the player does next.',
  makeTheTargetStep3Title: 'Step 3',
  makeTheTargetStep3Body: 'Placeholder. How a round ends.',
  makeTheTargetResultTitle: 'Nice work',
  makeTheTargetResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type MakeTheTargetMessages = Record<keyof typeof en, string>;
