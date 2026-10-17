/**
 * The keys Loop Puzzle persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/LOOP_PUZZLE_RULES.md §12)
 * — and an `lp.prefs` that holds exactly one thing: the difficulty last
 * chosen on the home screen. Nothing in it changes how a board plays.
 */
export const LP_STORAGE_KEYS = {
  game: 'lp.saveGame',
  dailyGame: 'lp.saveDaily',
  stats: 'lp.stats',
  flags: 'lp.flags',
  prefs: 'lp.prefs',
} as const;
