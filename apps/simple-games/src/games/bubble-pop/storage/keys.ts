/**
 * The keys Bubble Pop persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const BU_STORAGE_KEYS = {
  stats: 'bu.stats',
  progress: 'bu.progress',
  flags: 'bu.flags',
} as const;
