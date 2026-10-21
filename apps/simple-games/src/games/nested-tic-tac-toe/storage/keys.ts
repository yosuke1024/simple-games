/**
 * The keys Nested Tic-Tac-Toe persists — and nothing else. A zero-import
 * leaf: the registry (app/registry.ts) lists these for "Reset Local Data"
 * without touching any game code, which is what keeps the game out of the
 * home's initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * The declaration order is the order the registry lists them in, and the one
 * app/gameKeys.test.ts compares against (docs/NESTED_TIC_TAC_TOE_RULES.md §8).
 */
export const NT_STORAGE_KEYS = {
  saveGame: 'nt.saveGame',
  stats: 'nt.stats',
  flags: 'nt.flags',
  prefs: 'nt.prefs',
} as const;
