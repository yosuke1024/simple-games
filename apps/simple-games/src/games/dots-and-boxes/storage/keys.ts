/**
 * The keys Dots and Boxes persists — and nothing else. A zero-import leaf:
 * the registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const DB_STORAGE_KEYS = {
  game: 'db.saveGame',
  stats: 'db.stats',
  flags: 'db.flags',
  prefs: 'db.prefs',
} as const;
