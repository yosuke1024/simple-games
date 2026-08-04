/**
 * The keys Number Match persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 */
export const NM_STORAGE_KEYS = {
  game: 'nm.saveGame',
  stats: 'nm.stats',
  flags: 'nm.flags',
  progress: 'nm.progress',
  /** Daily games suspend independently of level games (docs §14). */
  dailyGame: 'nm.saveDaily',
} as const;
