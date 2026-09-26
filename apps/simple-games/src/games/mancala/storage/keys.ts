/**
 * The keys Mancala persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const MC_STORAGE_KEYS = {
  game: 'mc.saveGame',
  stats: 'mc.stats',
  flags: 'mc.flags',
  prefs: 'mc.prefs',
} as const;
