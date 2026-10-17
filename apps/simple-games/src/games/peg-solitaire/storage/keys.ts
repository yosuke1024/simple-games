/**
 * The keys Peg Solitaire persists — and nothing else (docs/PEG_SOLITAIRE_RULES.md
 * §11). A zero-import leaf: the registry (app/registry.ts) lists these for
 * "Reset Local Data" and the backup without touching any game code, which is
 * what keeps the game out of the home's initial chunk (docs/ARCHITECTURE.md).
 * Do not add imports here.
 *
 * One slot for the suspended game (there is no daily, so no second slot), the
 * statistics, the one-time flags, and the board chosen last. The order is the
 * order `Object.values` hands the registry, and src/app/gameKeys.test.ts pins
 * it.
 */
export const PG_STORAGE_KEYS = {
  game: 'pg.saveGame',
  stats: 'pg.stats',
  flags: 'pg.flags',
  prefs: 'pg.prefs',
} as const;
