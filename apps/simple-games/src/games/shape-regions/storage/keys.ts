/**
 * The keys Shape Regions persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/SHAPE_REGIONS_RULES.md
 * §11) — and an `sr.prefs` that holds exactly one thing: the difficulty last
 * chosen on the home screen. Nothing in it changes how a board plays.
 */
export const SR_STORAGE_KEYS = {
  game: 'sr.saveGame',
  dailyGame: 'sr.saveDaily',
  stats: 'sr.stats',
  flags: 'sr.flags',
  prefs: 'sr.prefs',
} as const;
