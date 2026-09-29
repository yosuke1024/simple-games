/**
 * The keys Sudoku 6×6 persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily — plus statistics, one-time
 * flags, and `s6.prefs`, which holds the difficulty last picked and the
 * mistake-highlight setting (docs/SUDOKU_6X6_RULES.md §4, §9, §11).
 */
export const S6_STORAGE_KEYS = {
  game: 's6.saveGame',
  dailyGame: 's6.saveDaily',
  stats: 's6.stats',
  flags: 's6.flags',
  prefs: 's6.prefs',
} as const;
