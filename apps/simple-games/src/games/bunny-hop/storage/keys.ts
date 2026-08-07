/**
 * The keys Bunny Hop persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * There is no saved run and no progress record: the track is real time and
 * endless, so there is no level to unlock and nothing honest to restore
 * (docs/BUNNY_HOP_RULES.md §10).
 */
export const BH_STORAGE_KEYS = {
  stats: 'bh.stats',
  flags: 'bh.flags',
} as const;
