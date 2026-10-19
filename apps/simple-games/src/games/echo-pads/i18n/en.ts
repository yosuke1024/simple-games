/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  echoPadsName: 'Echo Pads',
  echoPadsPlayPlaceholder: 'Play a sample round',
  echoPadsFinishPlaceholder: 'Finish the sample round',
  echoPadsStep1Title: 'Step 1',
  echoPadsStep1Body: 'Placeholder. The first of at most three steps.',
  echoPadsStep2Title: 'Step 2',
  echoPadsStep2Body: 'Placeholder. What the player does next.',
  echoPadsStep3Title: 'Step 3',
  echoPadsStep3Body: 'Placeholder. How a round ends.',
  echoPadsResultTitle: 'Nice work',
  echoPadsResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type EchoPadsMessages = Record<keyof typeof en, string>;
