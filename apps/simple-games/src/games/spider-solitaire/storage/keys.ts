/**
 * The keys Spider Solitaire persists — and nothing else. A zero-import leaf:
 * the registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const SS_STORAGE_KEYS = {
  game: 'ss.spiderette.saveGame',
  dailyGame: 'ss.spiderette.saveDaily',
  stats: 'ss.spiderette.stats',
  flags: 'ss.flags',
  prefs: 'ss.prefs',
  // Read-only archives: retained in backups and Reset Local Data, never used
  // as 52-card games or compared with Spiderette records.
  legacyGame: 'ss.saveGame',
  legacyDailyGame: 'ss.saveDaily',
  legacyStats: 'ss.stats',
} as const;
