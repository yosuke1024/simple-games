/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  gemSwapName: 'Gem Swap',
  gemSwapPlayPlaceholder: 'Play a sample round',
  gemSwapFinishPlaceholder: 'Finish the sample round',
  gemSwapStep1Title: 'Step 1',
  gemSwapStep1Body: 'Placeholder. The first of at most three steps.',
  gemSwapStep2Title: 'Step 2',
  gemSwapStep2Body: 'Placeholder. What the player does next.',
  gemSwapStep3Title: 'Step 3',
  gemSwapStep3Body: 'Placeholder. How a round ends.',
  gemSwapResultTitle: 'Nice work',
  gemSwapResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type GemSwapMessages = Record<keyof typeof en, string>;
