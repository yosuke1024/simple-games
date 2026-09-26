/**
 * The keys Hit & Blow persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * One saved game (there is no daily), the statistics, the one-time flags,
 * and the difficulty last picked (docs/HIT_AND_BLOW_RULES.md §8).
 */
export const HB_STORAGE_KEYS = {
  game: 'hb.saveGame',
  stats: 'hb.stats',
  flags: 'hb.flags',
  prefs: 'hb.prefs',
} as const;
