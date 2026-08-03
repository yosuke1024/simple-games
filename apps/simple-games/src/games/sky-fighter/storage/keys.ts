/**
 * The keys Sky Fighter persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const SF_STORAGE_KEYS = {
  stats: 'sf.stats',
  progress: 'sf.progress',
  flags: 'sf.flags',
} as const;
