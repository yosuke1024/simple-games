/**
 * Dots and Boxes's own strings (issue #38): bundled into the game's chunk,
 * not the entry, and registered on chunk load by ./index.ts. The shell's
 * en.ts stays the source of truth for shared keys, this file for this game's.
 *
 * `dotsAndBoxesName` is the literal 'Dots and Boxes' in every locale, since a
 * game's title is a proper noun and is never translated
 * (docs/I18N_POLICY.md). The board sizes are written with ASCII digits and
 * the multiplication sign, which read the same everywhere.
 *
 * Nothing here promises price, offline play, purchases or deletion — those
 * are the shell's high-risk strings (src/i18n/highRiskKeys.ts), and a game
 * sentence has no business repeating them.
 */
export const en = {
  dotsAndBoxesName: 'Dots and Boxes',
  dotsAndBoxesChooseBoard: 'Choose a board',
  dotsAndBoxesSize_small: '3 × 3',
  dotsAndBoxesSize_medium: '4 × 4',
  dotsAndBoxesSize_large: '5 × 5',
  dotsAndBoxesRecordNote: 'Won {wins} · Lost {losses}',
  dotsAndBoxesBoardLabel: 'Dots and Boxes board, {n} by {n} boxes',
  dotsAndBoxesLineH: 'Horizontal line {row}, {col}',
  dotsAndBoxesLineV: 'Vertical line {row}, {col}',
  dotsAndBoxesLineOpen: '{line}, not drawn',
  dotsAndBoxesLineYours: '{line}, yours',
  dotsAndBoxesLineCpu: '{line}, CPU',
  dotsAndBoxesBoxOpen: 'Box {row}, {col}, open',
  dotsAndBoxesBoxYours: 'Box {row}, {col}, yours',
  dotsAndBoxesBoxCpu: 'Box {row}, {col}, CPU',
  dotsAndBoxesYou: 'You',
  dotsAndBoxesCpu: 'CPU',
  dotsAndBoxesScoreLabel: 'Boxes: you {you}, CPU {cpu}',
  dotsAndBoxesYourTurn: 'Your turn',
  dotsAndBoxesAnotherTurn: 'Another turn!',
  dotsAndBoxesCpuTurn: 'CPU is thinking…',
  dotsAndBoxesWinTitle: 'You win!',
  dotsAndBoxesWinBody: 'You closed more boxes.',
  dotsAndBoxesLoseTitle: 'The CPU wins',
  dotsAndBoxesLoseBody: 'The CPU closed more boxes this time.',
  dotsAndBoxesDrawTitle: 'A draw',
  dotsAndBoxesDrawBody: 'The boxes split evenly.',
  dotsAndBoxesWins: 'Wins',
  dotsAndBoxesLosses: 'Losses',
  dotsAndBoxesDraws: 'Draws',
  dotsAndBoxesStep1Title: 'Tap between two dots',
  dotsAndBoxesStep1Body: 'Each tap draws one line. Then the CPU draws one.',
  dotsAndBoxesStep2Title: 'Close a box, go again',
  dotsAndBoxesStep2Body: 'Draw the fourth side of a box to take it, then draw another line.',
  dotsAndBoxesStep3Title: 'Most boxes wins',
  dotsAndBoxesStep3Body: 'When every line is drawn, whoever holds more boxes wins.',
  dotsAndBoxesConfirmSwitchTitle: 'Replace the game in progress?',
  dotsAndBoxesConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} game.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type DotsAndBoxesMessages = Record<keyof typeof en, string>;
