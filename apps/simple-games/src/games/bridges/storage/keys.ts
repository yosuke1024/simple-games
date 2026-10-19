/**
 * The keys Bridges persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/BRIDGES_RULES.md §10) —
 * and a `bg.prefs` that holds exactly one thing: the difficulty last chosen
 * on the home screen. Nothing in it changes how a board plays.
 */
export const BG_STORAGE_KEYS = {
  game: 'bg.saveGame',
  dailyGame: 'bg.saveDaily',
  stats: 'bg.stats',
  flags: 'bg.flags',
  prefs: 'bg.prefs',
} as const;
