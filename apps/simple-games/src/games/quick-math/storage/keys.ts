/**
 * The keys Quick Math persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * This is the one drill of the three that saves a set in progress. Ten
 * questions can take a few minutes, and — unlike held attention or short-term
 * memory — arithmetic survives being put down (docs/QUICK_MATH_RULES.md §9).
 */
export const QM_STORAGE_KEYS = {
  game: 'qm.saveGame',
  dailyGame: 'qm.saveDaily',
  stats: 'qm.stats',
  progress: 'qm.progress',
  flags: 'qm.flags',
} as const;
