/**
 * The keys Crown Grid persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — difficulty and daily (docs/CROWN_GRID_RULES.md §11)
 * — and a `cg.prefs` that holds exactly one thing: the difficulty last
 * picked (§9). Nothing in it changes how a board plays; the tap cycle and the
 * drag are the whole input vocabulary (§4), so there is no setting here.
 */
export const CG_STORAGE_KEYS = {
  game: 'cg.saveGame',
  dailyGame: 'cg.saveDaily',
  stats: 'cg.stats',
  flags: 'cg.flags',
  prefs: 'cg.prefs',
} as const;
