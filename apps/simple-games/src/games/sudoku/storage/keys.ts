/**
 * The keys Sudoku persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const SD_STORAGE_KEYS = {
  game: 'sd.saveGame',
  dailyGame: 'sd.saveDaily',
  freeGame: 'sd.saveFree',
  stats: 'sd.stats',
  progress: 'sd.progress',
  flags: 'sd.flags',
  prefs: 'sd.prefs',
} as const;
