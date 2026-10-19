/**
 * The keys this game persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Scaffolded by scripts/new-game.mjs. Add keys here as the game grows.
 */
export const PN_STORAGE_KEYS = {
  stats: 'pn.stats',
  flags: 'pn.flags',
} as const;
