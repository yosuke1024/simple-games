/**
 * Shape Regions' own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's en.ts stays the source of truth for shared keys, this file for
 * this game's.
 *
 * The board itself carries no words. Numbers are ASCII digits and the shape
 * symbols are inline SVG (docs/SHAPE_REGIONS_RULES.md §1, §13), so everything
 * here is chrome — and the spoken names of the five shapes, which a screen
 * reader needs where a sighted player reads the symbol.
 */
export const en = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Choose a board',
  shapeRegionsDifficulty_easy: 'Easy',
  shapeRegionsDifficulty_medium: 'Medium',
  shapeRegionsDifficulty_hard: 'Hard',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Replace the board in progress?',
  shapeRegionsConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  shapeRegionsBoardLabel: 'Shape Regions board, {width} by {height}',
  shapeRegionsCellAssigned: 'Row {row}, column {col}, shape {region}',
  shapeRegionsCellEmpty: 'Row {row}, column {col}, unassigned',
  /** Read after a clue cell's position: how far the shape has grown (§5). */
  shapeRegionsClueCount: '{count} of {size} cells',
  /** Appended to a cell's label while its shape breaks a rule (§5). */
  shapeRegionsRuleBroken: 'breaks a rule',
  shapeRegionsShape_line: 'Line',
  shapeRegionsShape_block: 'Rectangle',
  shapeRegionsShape_corner: 'Corner',
  shapeRegionsShape_tee: 'T shape',
  shapeRegionsShape_step: 'Step',
  shapeRegionsHintWrong: 'The highlighted shape does not match the answer.',
  shapeRegionsHintForced: 'The marked cell can only belong to the highlighted shape.',
  shapeRegionsHintSole: 'The highlighted shape has only one way to lie.',
  shapeRegionsHintCommon: 'Every way the highlighted shape can lie includes the marked cells.',
  shapeRegionsHintNone: 'No certain move found right now.',
  shapeRegionsSolvedTitle: 'Solved!',
  shapeRegionsSolvedBody: 'Every cell belongs to its shape.',
  shapeRegionsHintsUsed: 'Hints used',
  shapeRegionsNewBestTime: 'Your fastest yet.',
  shapeRegionsNewBoard: 'New board',
  shapeRegionsSolvedCount: 'Puzzles solved',
  shapeRegionsDailySection: 'Daily',
  shapeRegionsDailiesCleared: 'Days cleared',
  shapeRegionsStep1Title: 'Number and symbol',
  shapeRegionsStep1Body: 'The number is how many cells the shape has; the symbol is its form.',
  shapeRegionsStep2Title: 'Grow from the clue',
  shapeRegionsStep2Body: 'Drag from a clue across neighbouring cells to grow its shape.',
  shapeRegionsStep3Title: 'Fill the board',
  shapeRegionsStep3Body:
    'Every cell belongs to a shape when you are done. Tap a cell to remove it.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ShapeRegionsMessages = Record<keyof typeof en, string>;
