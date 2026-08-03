/**
 * The keys Solitaire persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const SO_STORAGE_KEYS = {
  game: 'so.saveGame',
  dailyGame: 'so.saveDaily',
  stats: 'so.stats',
  flags: 'so.flags',
  prefs: 'so.prefs',
} as const;
