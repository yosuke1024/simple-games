/**
 * The keys Chess persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * One saved game (no daily, so the two-slot rule of
 * src/test/savedGameSlots.test.ts does not apply), the statistics, the
 * one-time flags, and the side the next game starts with
 * (docs/CHESS_RULES.md §7).
 */
export const CH_STORAGE_KEYS = {
  game: 'ch.saveGame',
  stats: 'ch.stats',
  flags: 'ch.flags',
  prefs: 'ch.prefs',
} as const;
