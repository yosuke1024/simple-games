/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  scopaName: 'Scopa',
  scopaPlayPlaceholder: 'Play a sample round',
  scopaFinishPlaceholder: 'Finish the sample round',
  scopaStep1Title: 'Step 1',
  scopaStep1Body: 'Placeholder. The first of at most three steps.',
  scopaStep2Title: 'Step 2',
  scopaStep2Body: 'Placeholder. What the player does next.',
  scopaStep3Title: 'Step 3',
  scopaStep3Body: 'Placeholder. How a round ends.',
  scopaResultTitle: 'Nice work',
  scopaResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ScopaMessages = Record<keyof typeof en, string>;
