/**
 * The keys Sliding Puzzle persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const SP_STORAGE_KEYS = {
  game: 'sp.saveGame',
  dailyGame: 'sp.saveDaily',
  stats: 'sp.stats',
  progress: 'sp.progress',
  flags: 'sp.flags',
} as const;
