/**
 * The keys Gin Rummy persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const GR_STORAGE_KEYS = {
  game: 'gr.saveGame',
  stats: 'gr.stats',
  flags: 'gr.flags',
  prefs: 'gr.prefs',
} as const;
