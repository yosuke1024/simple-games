/**
 * The keys Connect Four persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const C4_STORAGE_KEYS = {
  game: 'c4.saveGame',
  stats: 'c4.stats',
  flags: 'c4.flags',
  prefs: 'c4.prefs',
} as const;
