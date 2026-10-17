/**
 * The keys this game persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Scaffolded by scripts/new-game.mjs. Add keys here as the game grows.
 */
export const LP_STORAGE_KEYS = {
  stats: 'lp.stats',
  flags: 'lp.flags',
} as const;
