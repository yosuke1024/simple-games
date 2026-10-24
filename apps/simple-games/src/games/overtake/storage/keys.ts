/**
 * The keys Overtake persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Four records, in the order docs/OVERTAKE_RULES.md §9 declares them. There
 * is deliberately no `save…` slot: a real-time race has no honest resume, so
 * leaving the screen ends it (§2, §9).
 */
export const OT_STORAGE_KEYS = {
  progress: 'ot.progress',
  stats: 'ot.stats',
  flags: 'ot.flags',
  prefs: 'ot.prefs',
} as const;
