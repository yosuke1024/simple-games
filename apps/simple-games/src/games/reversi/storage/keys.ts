/**
 * The keys Reversi persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const RV_STORAGE_KEYS = {
  game: 'rv.saveGame',
  stats: 'rv.stats',
  flags: 'rv.flags',
  prefs: 'rv.prefs',
} as const;
