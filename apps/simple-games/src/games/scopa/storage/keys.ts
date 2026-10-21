/**
 * The keys Scopa persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Three keys, and no `sc.prefs` (docs/SCOPA_RULES.md §9): there is one
 * strength, no side to choose and nothing else to remember.
 */
export const SC_STORAGE_KEYS = {
  game: 'sc.saveGame',
  stats: 'sc.stats',
  flags: 'sc.flags',
} as const;
