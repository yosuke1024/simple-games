/**
 * The keys Ludo persists — and nothing else. A zero-import leaf: the registry
 * (app/registry.ts) lists these for "Reset Local Data" without touching any
 * game code, which is what keeps the game out of the home's initial chunk
 * (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Four keys and **one** saved match (docs/LUDO_RULES.md §10). There is no
 * second slot for a daily, and the name the two-slot games give that second
 * key is deliberately absent from this file — src/test/savedGameSlots.test.ts
 * finds the two-slot games by searching each game's keys leaf for it, and a
 * one-slot game that so much as mentions it in a comment is pulled into a
 * rule about tying a slot to a mode that it has no second slot to obey.
 */
export const LD_STORAGE_KEYS = {
  game: 'ld.saveGame',
  stats: 'ld.stats',
  flags: 'ld.flags',
  prefs: 'ld.prefs',
} as const;
