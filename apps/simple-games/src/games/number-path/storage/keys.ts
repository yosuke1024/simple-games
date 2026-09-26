/**
 * The keys Number Path persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const NP_STORAGE_KEYS = {
  game: 'np.saveGame',
  dailyGame: 'np.saveDaily',
  stats: 'np.stats',
  flags: 'np.flags',
  prefs: 'np.prefs',
} as const;
