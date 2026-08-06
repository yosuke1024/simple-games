/**
 * The keys Block Puzzle persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const BP_STORAGE_KEYS = {
  game: 'bp.saveGame',
  stats: 'bp.stats',
  flags: 'bp.flags',
} as const;
