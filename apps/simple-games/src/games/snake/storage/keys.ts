/**
 * The keys this game persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Four records, in the order docs/SNAKE_RULES.md §11 lists them: the one
 * suspended run, the per-speed statistics, the one-time flags, and the speed
 * last picked. Nothing else of this game is ever written.
 */
export const SN_STORAGE_KEYS = {
  game: 'sn.saveGame',
  stats: 'sn.stats',
  flags: 'sn.flags',
  prefs: 'sn.prefs',
} as const;
