/**
 * The keys Binary Balance persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/BINARY_BALANCE_RULES.md
 * §11) — and a `bn.prefs` that holds exactly one thing: the difficulty last
 * picked (§10). Nothing in it changes how a board plays; there is no setting
 * in this game (§9).
 */
export const BN_STORAGE_KEYS = {
  game: 'bn.saveGame',
  dailyGame: 'bn.saveDaily',
  stats: 'bn.stats',
  flags: 'bn.flags',
  prefs: 'bn.prefs',
} as const;
