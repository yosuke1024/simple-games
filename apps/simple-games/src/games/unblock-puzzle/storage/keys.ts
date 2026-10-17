/**
 * The keys Unblock Puzzle persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — Free Play and the daily (docs/UNBLOCK_PUZZLE_RULES.md
 * §11, §12) — and a `ub.prefs` that holds exactly one thing: the difficulty
 * last chosen on the home screen. Nothing in it changes how a board plays.
 * The daily slot's leaf is named `dailyGame`, which is how
 * src/test/savedGameSlots.test.ts finds this game and holds it to the
 * two-slot rule.
 */
export const UB_STORAGE_KEYS = {
  game: 'ub.saveGame',
  dailyGame: 'ub.saveDaily',
  stats: 'ub.stats',
  flags: 'ub.flags',
  prefs: 'ub.prefs',
} as const;
