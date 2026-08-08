/**
 * The keys Hearts persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const HT_STORAGE_KEYS = {
  game: 'ht.saveGame',
  stats: 'ht.stats',
  flags: 'ht.flags',
  prefs: 'ht.prefs',
} as const;
