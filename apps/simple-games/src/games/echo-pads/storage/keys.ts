/**
 * The keys Echo Pads persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-run slots — a level run and today's daily (docs/ECHO_PADS_RULES.md
 * §9「キー」, the two-slot rule) — the per-level record (`ep.progress`: cleared
 * levels and the next attempt of each level and of today's daily), the
 * statistics, the one-time flags, and a `ep.prefs` that holds the Pace only.
 * The daily slot's leaf is named `dailyGame`, which is how
 * src/test/savedGameSlots.test.ts finds this game and holds it to that rule.
 */
export const EP_STORAGE_KEYS = {
  game: 'ep.saveGame',
  dailyGame: 'ep.saveDaily',
  progress: 'ep.progress',
  stats: 'ep.stats',
  flags: 'ep.flags',
  prefs: 'ep.prefs',
} as const;
