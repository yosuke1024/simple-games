/**
 * The keys Make the Target persists — and nothing else
 * (docs/MAKE_THE_TARGET_RULES.md §10). A zero-import leaf: the registry
 * (app/registry.ts) lists these for "Reset Local Data" and the backup without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Two saved-game slots — Free Play and the daily, each kept apart so neither
 * mode evicts the other (§8) — the statistics, the one-time flags, and a
 * `tg.prefs` that holds exactly one thing: the difficulty last chosen. The
 * order is the order `Object.values` hands the registry, and
 * src/app/gameKeys.test.ts pins it.
 */
export const TG_STORAGE_KEYS = {
  game: 'tg.saveGame',
  dailyGame: 'tg.saveDaily',
  stats: 'tg.stats',
  flags: 'tg.flags',
  prefs: 'tg.prefs',
} as const;
