/**
 * The keys Nonogram persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const NG_STORAGE_KEYS = {
  game: 'ng.saveGame',
  dailyGame: 'ng.saveDaily',
  stats: 'ng.stats',
  progress: 'ng.progress',
  flags: 'ng.flags',
  prefs: 'ng.prefs',
} as const;
