/**
 * The keys Brick Breaker persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const BB_STORAGE_KEYS = {
  stats: 'bb.stats',
  progress: 'bb.progress',
  flags: 'bb.flags',
} as const;
