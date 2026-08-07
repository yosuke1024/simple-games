/**
 * The keys Checkers persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const CK_STORAGE_KEYS = {
  game: 'ck.saveGame',
  stats: 'ck.stats',
  flags: 'ck.flags',
  prefs: 'ck.prefs',
} as const;
