/**
 * The keys Gomoku persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const GM_STORAGE_KEYS = {
  game: 'gm.saveGame',
  stats: 'gm.stats',
  flags: 'gm.flags',
  prefs: 'gm.prefs',
} as const;
