/**
 * The keys Minesweeper persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const MS_STORAGE_KEYS = {
  game: 'ms.saveGame',
  dailyGame: 'ms.saveDaily',
  stats: 'ms.stats',
  flags: 'ms.flags',
  prefs: 'ms.prefs',
  /** A Club House challenge in progress (§14) — its own slot, appended last. */
  clubGame: 'ms.saveClub',
} as const;
