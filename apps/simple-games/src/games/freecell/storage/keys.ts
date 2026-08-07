/**
 * The keys FreeCell persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * There is no `prefs` key: FreeCell has no setting to remember. Klondike keeps
 * one for Draw 1 / Draw 3, and Spider for the suit count, but FreeCell is the
 * same game every time it is dealt.
 */
export const FC_STORAGE_KEYS = {
  game: 'fc.saveGame',
  dailyGame: 'fc.saveDaily',
  stats: 'fc.stats',
  flags: 'fc.flags',
} as const;
