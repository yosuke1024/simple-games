/**
 * The keys Takuzu persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Three saved-game slots — level, daily, free (docs/TAKUZU_RULES.md §11) —
 * and a `tk.prefs` that holds exactly one thing: the tier the Free Play
 * picker last stood on (§7「フリープレイ」). Nothing in it changes how a
 * board plays. The tap cycle is the whole input vocabulary (§4) and the
 * violation display is a rule rather than an option (§9), so there is still
 * no setting here — only a remembered position.
 */
export const TK_STORAGE_KEYS = {
  game: 'tk.saveGame',
  dailyGame: 'tk.saveDaily',
  freeGame: 'tk.saveFree',
  stats: 'tk.stats',
  progress: 'tk.progress',
  flags: 'tk.flags',
  prefs: 'tk.prefs',
} as const;
