/**
 * The keys Futoshiki persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Six keys, and the sixth is `ft.prefs` because this game remembers one thing
 * across boards: whether a digit that disagrees with the answer is marked the
 * moment it lands (docs/FUTOSHIKI_RULES.md §5, §11). Takuzu has five because
 * it has nothing to remember, not because five is the number
 * (docs/TAKUZU_RULES.md §11).
 */
export const FT_STORAGE_KEYS = {
  game: 'ft.saveGame',
  dailyGame: 'ft.saveDaily',
  stats: 'ft.stats',
  progress: 'ft.progress',
  flags: 'ft.flags',
  prefs: 'ft.prefs',
} as const;
