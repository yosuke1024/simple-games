/**
 * Water Sort's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for water-sort's.
 */
export const en = {
  waterSortName: 'Water Sort',
  waterBoardLabel: 'Water sort tubes',
  waterTubeLabel: 'Tube {n}, bottom to top: {colors}',
  waterTubeEmpty: 'empty',
  waterHintNone: 'No way forward found — undo or retry.',
  waterHintsUsed: 'Hints',
  waterSolvedTitle: 'Sorted!',
  waterSolvedBody: 'Every color has its own tube.',
  waterNewBestMoves: 'Your fewest pours yet.',
  waterNewBestTime: 'Your fastest yet.',
  waterBestMoves: 'Fewest pours',
  waterLevelsSolved: 'Levels solved',
  waterDailiesSolved: 'Dailies solved',
  waterDailyBacklogHint: 'Every earlier day stays open.',
  // Free Play's tier picker (docs/WATER_SORT_RULES.md §6「フリープレイ」).
  waterTier_easy: 'Easy',
  waterTier_medium: 'Medium',
  waterTier_hard: 'Hard',
  waterStep1Title: 'Pour same onto same',
  waterStep1Body:
    'Tap a tube, then another. The top color pours when it matches — or into any empty tube.',
  waterStep2Title: 'Two spare tubes',
  waterStep2Body: 'The empty tubes are your workspace. Undo is always free.',
  waterStep3Title: 'One color per tube',
  waterStep3Body: 'When every tube holds a single color, the board is sorted.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type WaterSortMessages = Record<keyof typeof en, string>;
