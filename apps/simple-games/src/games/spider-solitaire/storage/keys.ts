/**
 * The keys Spider Solitaire persists — and nothing else. A zero-import leaf:
 * the registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const SS_STORAGE_KEYS = {
  game: 'ss.saveGame',
  dailyGame: 'ss.saveDaily',
  stats: 'ss.stats',
  flags: 'ss.flags',
  prefs: 'ss.prefs',
} as const;
