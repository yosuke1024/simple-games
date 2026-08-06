/**
 * The keys Dino Run persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * There is no saved run and no progress record: the track is real time and
 * endless, so there is no level to unlock and nothing honest to restore
 * (docs/DINO_RUN_RULES.md §10).
 */
export const DR_STORAGE_KEYS = {
  stats: 'dr.stats',
  flags: 'dr.flags',
} as const;
