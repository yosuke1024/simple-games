/**
 * Box Regions' own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's en.ts stays the source of truth for shared keys, this file for
 * this game's.
 *
 * The board itself carries no words. Numbers are ASCII digits and the kind
 * symbols are inline SVG (docs/BOX_REGIONS_RULES.md §1, §13), so everything
 * here is chrome — and the spoken names of the four kinds, which a screen
 * reader needs where a sighted player reads the symbol.
 */
export const en = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Choose a board',
  boxRegionsDifficulty_easy: 'Easy',
  boxRegionsDifficulty_medium: 'Medium',
  boxRegionsDifficulty_hard: 'Hard',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Replace the board in progress?',
  boxRegionsConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  boxRegionsBoardLabel: 'Box Regions board, {width} by {height}',
  boxRegionsCellAssigned: 'Row {row}, column {col}, box {region}',
  boxRegionsCellEmpty: 'Row {row}, column {col}, unassigned',
  /** Read after a clue cell's position: how big its box is against the number (§5). */
  boxRegionsClueCount: '{count} of {size} cells',
  /** Appended to a cell's label while its box breaks a rule (§5). */
  boxRegionsRuleBroken: 'breaks a rule',
  boxRegionsKind_square: 'Square',
  boxRegionsKind_tall: 'Tall',
  boxRegionsKind_wide: 'Wide',
  boxRegionsKind_free: 'Any box',
  boxRegionsHintWrong: 'The highlighted box does not match the answer.',
  boxRegionsHintForced: 'The marked cell can only belong to the highlighted clue’s box.',
  boxRegionsHintSole: 'This box can only be drawn one way.',
  boxRegionsHintCommon: 'Every way to draw this clue’s box covers the marked cells.',
  boxRegionsHintNone: 'No certain move found right now.',
  boxRegionsSolvedTitle: 'Solved!',
  boxRegionsSolvedBody: 'Every cell is in its box.',
  boxRegionsHintsUsed: 'Hints used',
  boxRegionsNewBestTime: 'Your fastest yet.',
  boxRegionsNewBoard: 'New board',
  boxRegionsSolvedCount: 'Puzzles solved',
  boxRegionsDailySection: 'Daily',
  boxRegionsDailiesCleared: 'Days cleared',
  boxRegionsDailyBacklogHint: 'Every earlier day stays open.',
  boxRegionsStep1Title: 'Cut into boxes',
  boxRegionsStep1Body: 'Cut the board into rectangles, each holding exactly one clue.',
  boxRegionsStep2Title: 'Read the clues',
  boxRegionsStep2Body:
    'The number is how many cells the box has; the symbol says square, tall, wide or any.',
  boxRegionsStep3Title: 'Draw corner to corner',
  boxRegionsStep3Body:
    'Drag from one corner to the other to draw a box. Tap a box to remove it. Stuck? Try a hint.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BoxRegionsMessages = Record<keyof typeof en, string>;
