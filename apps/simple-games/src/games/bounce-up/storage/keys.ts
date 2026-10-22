/**
 * The keys Bounce Up persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Three records, in the order docs/BOUNCE_UP_RULES.md §5 declares them. There
 * is deliberately no `save…` slot: a body in mid-air has no honest resume, so
 * leaving the screen ends the run (§4, §5).
 */
export const BO_STORAGE_KEYS = {
  stats: 'bo.stats',
  flags: 'bo.flags',
  prefs: 'bo.prefs',
} as const;
