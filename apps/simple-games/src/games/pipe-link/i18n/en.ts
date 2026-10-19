/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  pipeLinkName: 'Pipe Link',
  pipeLinkPlayPlaceholder: 'Play a sample round',
  pipeLinkFinishPlaceholder: 'Finish the sample round',
  pipeLinkStep1Title: 'Step 1',
  pipeLinkStep1Body: 'Placeholder. The first of at most three steps.',
  pipeLinkStep2Title: 'Step 2',
  pipeLinkStep2Body: 'Placeholder. What the player does next.',
  pipeLinkStep3Title: 'Step 3',
  pipeLinkStep3Body: 'Placeholder. How a round ends.',
  pipeLinkResultTitle: 'Nice work',
  pipeLinkResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type PipeLinkMessages = Record<keyof typeof en, string>;
