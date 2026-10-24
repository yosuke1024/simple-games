/**
 * The keys Tangram persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — Free Play and the daily (docs/TANGRAM_RULES.md §8
 * 「2 スロット」) — the per-figure record (`tn.progress`: fastest times and
 * the figure last started in each tier), the statistics, the one-time flags,
 * and a `tn.prefs` that holds exactly one thing: the tier last chosen on the
 * home screen. Nothing in it changes how a figure plays. The daily slot's
 * leaf is named `dailyGame`, which is how src/test/savedGameSlots.test.ts
 * finds this game and holds it to the two-slot rule.
 */
export const TN_STORAGE_KEYS = {
  game: 'tn.saveGame',
  dailyGame: 'tn.saveDaily',
  progress: 'tn.progress',
  stats: 'tn.stats',
  flags: 'tn.flags',
  prefs: 'tn.prefs',
} as const;
