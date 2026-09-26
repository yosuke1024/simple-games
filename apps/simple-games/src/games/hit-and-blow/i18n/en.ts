/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * "Hit" and "Blow" are the game's own terms (docs/HIT_AND_BLOW_RULES.md §4),
 * written as names rather than counted nouns — "Hit 1, Blow 2" — so no line
 * here needs a plural form.
 */
export const en = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: 'Choose a difficulty',
  hitAndBlowDifficulty_easy: 'Easy',
  hitAndBlowDifficulty_normal: 'Normal',
  hitAndBlowDifficulty_hard: 'Hard',
  hitAndBlowCodeNote: '{slots} of {pool} symbols',
  hitAndBlowBestNote: 'Best {count}',
  hitAndBlowConfirmSwitchTitle: 'Replace the game in progress?',
  hitAndBlowConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} game.',

  // Symbols, by id (§1) — what a screen reader says for each shape.
  hitAndBlowSymbol_circle: 'Circle',
  hitAndBlowSymbol_triangle: 'Triangle',
  hitAndBlowSymbol_square: 'Square',
  hitAndBlowSymbol_diamond: 'Diamond',
  hitAndBlowSymbol_star: 'Star',
  hitAndBlowSymbol_cross: 'Cross',
  hitAndBlowSymbol_hexagon: 'Hexagon',
  hitAndBlowSymbol_heart: 'Heart',

  // The game screen
  hitAndBlowGuessCounter: 'Guess {n}',
  hitAndBlowHistoryLabel: 'Guesses so far',
  hitAndBlowHistoryEmpty: 'Your guesses will line up here.',
  hitAndBlowRowLabel: 'Guess {n}: {symbols}. Hit {hits}, Blow {blows}.',
  hitAndBlowDraftLabel: 'Your guess',
  hitAndBlowSlotEmpty: 'Slot {n}: empty',
  hitAndBlowSlotFilled: 'Slot {n}: {symbol}',
  hitAndBlowPaletteLabel: 'Symbols',
  hitAndBlowCheck: 'Check',
  hitAndBlowHit: 'Hit',
  hitAndBlowBlow: 'Blow',

  // Result and statistics
  hitAndBlowWinTitle: 'Code cracked',
  hitAndBlowWinBody: 'You found the hidden row.',
  hitAndBlowGuessesLabel: 'Guesses',
  hitAndBlowNewBest: 'Your fewest guesses yet',
  hitAndBlowSolved: 'Solved',
  hitAndBlowFewestGuesses: 'Fewest guesses',
  hitAndBlowAverageGuesses: 'Average guesses',

  // Quick Rules (§9)
  hitAndBlowStep1Title: 'Find the hidden row',
  hitAndBlowStep1Body: 'A row of different symbols is hidden. Work out which ones, in which order.',
  hitAndBlowStep2Title: 'Line up a guess',
  hitAndBlowStep2Body: 'Tap symbols to fill the row, then press Check.',
  hitAndBlowStep3Title: 'Read the pegs',
  hitAndBlowStep3Body:
    '● Hit: right symbol, right place. ○ Blow: right symbol, wrong place. Guess as often as you like.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type HitAndBlowMessages = Record<keyof typeof en, string>;
