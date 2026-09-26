/**
 * The keys Yacht persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const YT_STORAGE_KEYS = {
  game: 'yt.saveGame',
  stats: 'yt.stats',
  flags: 'yt.flags',
} as const;
