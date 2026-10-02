/**
 * The keys Water Sort persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const WS_STORAGE_KEYS = {
  game: 'ws.saveGame',
  dailyGame: 'ws.saveDaily',
  freeGame: 'ws.saveFree',
  stats: 'ws.stats',
  progress: 'ws.progress',
  flags: 'ws.flags',
  prefs: 'ws.prefs',
} as const;
