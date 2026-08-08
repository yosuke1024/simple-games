/**
 * The keys Takuzu persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Five keys where the other level-and-daily games have six: there is no
 * `tk.prefs`, because Takuzu has no per-game setting to keep. The tap cycle is
 * the whole input vocabulary (docs/TAKUZU_RULES.md §4), so there is no mode to
 * toggle, and the violation display is always on rather than optional (§9) —
 * so nothing here is a preference rather than a rule.
 */
export const TK_STORAGE_KEYS = {
  game: 'tk.saveGame',
  dailyGame: 'tk.saveDaily',
  stats: 'tk.stats',
  progress: 'tk.progress',
  flags: 'tk.flags',
} as const;
