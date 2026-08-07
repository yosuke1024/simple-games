/**
 * The keys Number Recall persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * There is no saved-game key. What a round holds is short-term memory of a
 * layout, and that does not survive the app being closed — so nothing is
 * written mid-round (docs/NUMBER_RECALL_RULES.md §12).
 */
export const NR_STORAGE_KEYS = {
  stats: 'nr.stats',
  progress: 'nr.progress',
  flags: 'nr.flags',
} as const;
