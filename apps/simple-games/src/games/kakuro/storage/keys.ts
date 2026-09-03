/**
 * The keys Kakuro persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Seven keys. `kk.prefs` is there because this game remembers things across
 * boards: whether a digit that disagrees with the answer is marked the moment
 * it lands (docs/KAKURO_RULES.md §5, §11), and where the Free Play picker
 * stands (§9). `kk.saveFree` is the third suspended game, beside the level
 * and the daily. Takuzu has five because it has nothing to remember, not
 * because five is the number — the count is what a game keeps, never a shape
 * to match (docs/FUTOSHIKI_RULES.md §11).
 */
export const KK_STORAGE_KEYS = {
  game: 'kk.saveGame',
  dailyGame: 'kk.saveDaily',
  freeGame: 'kk.saveFree',
  stats: 'kk.stats',
  progress: 'kk.progress',
  flags: 'kk.flags',
  prefs: 'kk.prefs',
} as const;
