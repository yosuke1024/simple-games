/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  tangramName: 'Tangram',
  tangramPlayPlaceholder: 'Play a sample round',
  tangramFinishPlaceholder: 'Finish the sample round',
  tangramStep1Title: 'Step 1',
  tangramStep1Body: 'Placeholder. The first of at most three steps.',
  tangramStep2Title: 'Step 2',
  tangramStep2Body: 'Placeholder. What the player does next.',
  tangramStep3Title: 'Step 3',
  tangramStep3Body: 'Placeholder. How a round ends.',
  tangramResultTitle: 'Nice work',
  tangramResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type TangramMessages = Record<keyof typeof en, string>;
