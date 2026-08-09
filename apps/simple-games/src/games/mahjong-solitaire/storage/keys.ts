/**
 * The keys Mahjong Solitaire persists — and nothing else. A zero-import leaf:
 * the registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Five keys, no prefs: this game has no setting that survives a board
 * (docs/MAHJONG_SOLITAIRE_RULES.md §10 — the Takuzu arrangement).
 */
export const MJ_STORAGE_KEYS = {
  game: 'mj.saveGame',
  dailyGame: 'mj.saveDaily',
  stats: 'mj.stats',
  progress: 'mj.progress',
  flags: 'mj.flags',
} as const;
