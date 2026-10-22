/**
 * The keys this game persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Four records, in the order docs/GEM_SWAP_RULES.md §7 lists them: the one
 * suspended round, the statistics, the one-time flags, and the gem count last
 * picked. Nothing else of this game is ever written.
 */
export const GS_STORAGE_KEYS = {
  game: 'gs.saveGame',
  stats: 'gs.stats',
  flags: 'gs.flags',
  prefs: 'gs.prefs',
} as const;
