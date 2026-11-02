/**
 * The keys Backgammon persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Four records (docs/BACKGAMMON_RULES.md §9): the one suspended match, the
 * statistics, the one-time flags and the preferred strength.
 */
export const BK_STORAGE_KEYS = {
  game: 'bk.saveGame',
  stats: 'bk.stats',
  flags: 'bk.flags',
  prefs: 'bk.prefs',
} as const;
