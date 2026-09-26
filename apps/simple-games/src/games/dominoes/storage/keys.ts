/**
 * The keys Dominoes persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * One saved-game slot and no preferences: the opener is decided by the deal
 * (docs/DOMINOES_RULES.md §2) and there is one opponent (§5), so there is
 * nothing to choose before a game and nothing to remember between them.
 */
export const DM_STORAGE_KEYS = {
  game: 'dm.saveGame',
  stats: 'dm.stats',
  flags: 'dm.flags',
} as const;
