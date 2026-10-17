/**
 * Peg Solitaire's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. English
 * is the source (docs/PEG_SOLITAIRE_RULES.md §15); every other catalog is
 * measured against it.
 *
 * `pegSolitaireName` is the literal 'Peg Solitaire' in every locale, since a
 * game's title is a proper noun and is never translated (docs/I18N_POLICY.md).
 * The board names may be translated: they appear only on buttons, headings
 * and labels, never on the board itself, which carries no text at all (§13).
 * Counts are ASCII digits passed in as `{count}`, written as "Pegs left: n"
 * so no language needs a plural form for them.
 */
export const en = {
  pegSolitaireName: 'Peg Solitaire',

  // Boards (§1, §7). The same names on the home buttons, the game's top bar,
  // the statistics and Quick Rules step 2 (§12).
  pegSolitaireBoard_english: 'English',
  pegSolitaireBoard_triangle: 'Triangle',
  pegSolitaireBoardLabel_english: 'English board, 33 holes',
  pegSolitaireBoardLabel_triangle: 'Triangle board, 15 holes',
  pegSolitaireHoleCount: '{count} holes',

  // Home (§7)
  pegSolitaireChooseBoard: 'Choose a board',
  pegSolitaireBestNote: 'Fewest left: {count}',
  pegSolitaireConfirmSwitchTitle: 'Replace the game in progress?',
  pegSolitaireConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} game.',

  // The board, read aloud (§13). Position first, then what is in the hole.
  pegSolitaireHoleGrid: 'Row {row}, column {col}: {content}',
  pegSolitaireHoleRow: 'Row {row}, hole {place}: {content}',
  pegSolitaireContentPeg: 'peg',
  pegSolitaireContentPegRing: 'peg in the ringed hole',
  pegSolitaireContentEmpty: 'empty',
  pegSolitaireContentEmptyRing: 'empty ringed hole',
  pegSolitaireContentLanding: 'empty, a jump can land here',
  pegSolitaireContentLandingRing: 'empty ringed hole, a jump can land here',

  // The one status line under the board (§5)
  pegSolitairePegsLeft: 'Pegs left: {count}',
  pegSolitaireNoJump: 'This peg has no jump right now.',

  // Result card (§3, §5)
  pegSolitairePerfectTitle: 'Perfect clear!',
  pegSolitairePerfectBody: 'The last peg stands in the ringed hole.',
  pegSolitaireSingleTitle: 'One peg left',
  pegSolitaireSingleBody: 'The last peg is outside the ringed hole.',
  pegSolitaireStuckTitle: 'No jumps left',
  pegSolitaireStuckBody: 'No peg can jump another.',
  pegSolitairePegsLeftLabel: 'Pegs left',
  pegSolitaireFewestLabel: 'Fewest on this board',
  pegSolitaireNewFewest: 'Fewer than ever on this board.',
  pegSolitaireBoardFact: 'Board',
  pegSolitaireNewBoard: 'New board',

  // Statistics (§10)
  pegSolitaireStatFewest: 'Fewest pegs left',
  pegSolitaireStatPerfect: 'Perfect clears',

  // Quick Rules (§12): three steps, one sentence each.
  pegSolitaireStep1Title: 'Jump and remove',
  pegSolitaireStep1Body:
    'Jump a peg over its neighbour into an empty hole — the peg jumped over is removed.',
  pegSolitaireStep2Title: 'Straight lines only',
  pegSolitaireStep2Body:
    'Jumps go straight: up, down and sideways on English, along the three lines on Triangle.',
  pegSolitaireStep3Title: 'Leave the last one',
  pegSolitaireStep3Body:
    'When no peg can jump, the game ends — leave the last peg in the ringed hole for a perfect clear.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type PegSolitaireMessages = Record<keyof typeof en, string>;
