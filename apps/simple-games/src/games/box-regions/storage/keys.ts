/**
 * The keys Box Regions persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/BOX_REGIONS_RULES.md
 * §11) — and a `br.prefs` that holds exactly one thing: the difficulty last
 * chosen on the home screen. Nothing in it changes how a board plays.
 */
export const BR_STORAGE_KEYS = {
  game: 'br.saveGame',
  dailyGame: 'br.saveDaily',
  stats: 'br.stats',
  flags: 'br.flags',
  prefs: 'br.prefs',
} as const;
