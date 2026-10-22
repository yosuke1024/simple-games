/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): this is
 * the source. Every other catalog is measured against it.
 *
 * Wording rules (docs/I18N_POLICY.md「文言設計」): short verbs and nouns on
 * buttons, one sentence per Quick Rules step, every variable part passed as
 * `{var}` — never a sentence glued together in code. Nothing here promises
 * anything about money, ads, the network, or what is kept or deleted, and
 * nothing praises: the result is a fact (§9, §11).
 *
 * Glossary — read before translating (§11). These terms decide whether a
 * sentence states a fact or reads as a verdict:
 * - "swap" (verb and noun): two neighbouring gems trading places. A round is
 *   counted in swaps that made a line; never "move", "turn" or "try".
 * - "line" (of three): three or more of the same gem in a row or column.
 *   Not "match" (a word other games use for a combo) and not "set".
 * - "round": the 30 swaps from a board's start to its end. Not "game",
 *   "level" or "stage".
 * - `gemSwapEnd_stuck` — a round that ends because no swap would line up
 *   three. It is an ENDING, not a loss: the score made so far stands and
 *   counts toward the best. Never translate it with a word for losing,
 *   failing, "game over" or "dead end" as a verdict; say what is true of the
 *   board (no swap left that lines up three).
 * - `gemSwapEnd_cap` — the cascade (gems clearing again by themselves after
 *   falling) reached its 64-stage limit; the round stops there. Plain and
 *   technical, not an error and not a reward.
 * - "gems" / `gemSwapKindsCount`: how many different gems the board uses (5
 *   or 6) — a count of kinds, not of pieces on the board. Easy / Normal are
 *   the names of the two counts.
 * - The cut names (hexagon, octagon, drop, marquise, shield, heart) are only
 *   ever spoken by a screen reader, never shown; plain shape words are best.
 */
export const en = {
  gemSwapName: 'Gem Swap',

  // Home
  gemSwapKinds: 'Gems',
  gemSwapKinds_5: '5 · Easy',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} gems',
  gemSwapResumeNote: 'Score {score} · {kinds}',
  gemSwapBestNote: 'Best {score}',
  gemSwapBestFor: 'Best, {kinds}',

  // Game screen
  gemSwapSwapsLeft: '{count} swaps left',
  gemSwapBoardLabel: 'Gem board, {size} by {size}',
  gemSwapCell: 'Row {row}, column {col}, {gem}',
  gemSwapCellSelected: 'Row {row}, column {col}, {gem}, selected',
  gemSwapGem_hexagon: 'hexagon',
  gemSwapGem_octagon: 'octagon',
  gemSwapGem_pear: 'drop',
  gemSwapGem_marquise: 'marquise',
  gemSwapGem_shield: 'shield',
  gemSwapGem_heart: 'heart',
  gemSwapNewBoard: 'New board',

  // Screen reader announcements (polite; once per swap, never once per stage)
  gemSwapLiveMove: '{count} cleared · {left} swaps left',
  gemSwapLiveInvalid: 'These two cannot be swapped',
  gemSwapLiveUndo: 'Swap taken back · {left} swaps left',

  // Result
  gemSwapResultTitle: 'Round over',
  gemSwapEnd_swaps: 'All 30 swaps are made.',
  gemSwapEnd_stuck: 'No swap is left that lines up three.',
  gemSwapEnd_cap: 'The cascade reached its limit of 64 stages.',
  gemSwapNotCounted: 'A round stopped at the limit does not count toward the best.',
  gemSwapNewBest: 'New best with {kinds}',
  gemSwapBestWith: 'Best with {kinds}: {score}',

  // Quick Rules
  gemSwapStep1Title: 'Swap',
  gemSwapStep1Body: 'Swap two neighbouring gems to line up three or more of the same shape.',
  gemSwapStep2Title: 'Clear',
  gemSwapStep2Body:
    'A line clears, new gems fall in from above, and any line they make clears too.',
  gemSwapStep3Title: 'Score',
  gemSwapStep3Body: 'A round is 30 swaps, and every gem cleared is one point.',
  gemSwapFigureSwap: 'Two neighbouring gems about to swap so that three hexagons line up',
  gemSwapFigureClear: 'A line has cleared and the gems above fall into its place',
  gemSwapFigureRound: 'A score of 42 and a bar with 18 of its 30 swaps left',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type GemSwapMessages = Record<keyof typeof en, string>;
