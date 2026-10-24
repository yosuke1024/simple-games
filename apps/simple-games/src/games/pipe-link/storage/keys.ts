/**
 * The keys Pipe Link persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/PIPE_LINK_RULES.md §7) —
 * and a `pn.prefs` that holds exactly one thing: the difficulty last chosen
 * on the home screen. Nothing in it changes how a board plays.
 */
export const PN_STORAGE_KEYS = {
  game: 'pn.saveGame',
  dailyGame: 'pn.saveDaily',
  stats: 'pn.stats',
  flags: 'pn.flags',
  prefs: 'pn.prefs',
} as const;
