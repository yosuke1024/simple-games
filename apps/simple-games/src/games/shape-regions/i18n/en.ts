/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsPlayPlaceholder: 'Play a sample round',
  shapeRegionsHowToPlayPlaceholder: 'This game does not have rules yet — add them here.',
  shapeRegionsResultTitle: 'Nice work',
  shapeRegionsResultBody: 'This is a placeholder result. Replace it with the real outcome.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ShapeRegionsMessages = Record<keyof typeof en, string>;
