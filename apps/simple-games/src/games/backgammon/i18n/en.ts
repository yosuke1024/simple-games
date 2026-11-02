/**
 * Backgammon's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * `en` is the original; the other thirteen catalogs were written by AI from
 * it and have not been read by a native speaker or by the author
 * (docs/BACKGAMMON_RULES.md §12, docs/I18N_POLICY.md). The title and "CPU"
 * stay as they are in every language; the terms point, bar, bear off, hit,
 * pip, gammon and backgammon follow each language's customary loanword.
 */
export const en = {
  backgammonName: 'Backgammon',
  backgammonChooseOpponent: 'Choose your opponent',
  backgammonDifficulty_easy: 'Easy',
  backgammonDifficulty_normal: 'Normal',
  backgammonDifficulty_hard: 'Hard',
  backgammonYou: 'You',
  backgammonCpu: 'CPU',
  // The dice are a button while they are yours to throw (§2.1).
  backgammonRoll: 'Roll',
  backgammonRollOpening: 'Roll for the opening',
  backgammonOpeningYou: 'Opening roll {you}–{cpu}: you start.',
  backgammonOpeningCpu: 'Opening roll {you}–{cpu}: the CPU starts.',
  backgammonYourRoll: 'Your turn — roll the dice',
  backgammonYourMove: 'Your move',
  backgammonDiceLeft: '{count} to play',
  backgammonCpuTurn: 'CPU is thinking…',
  backgammonCpuMoving: 'CPU moves',
  backgammonNoMoveYou: 'No legal move — your turn passes',
  backgammonNoMoveCpu: 'The CPU has no legal move',
  backgammonTakeBack: 'Take back',
  backgammonPips: 'Pips',
  backgammonOff: 'Off',
  backgammonBar: 'Bar',
  backgammonBoardLabel: 'Backgammon board',
  backgammonDiceLabel: 'Dice: {a} and {b}',
  backgammonDiceUnrolled: 'Dice not yet rolled',
  backgammonPointEmpty: 'Point {point}: empty',
  backgammonPointYours: 'Point {point}: {count} of yours',
  backgammonPointCpu: 'Point {point}: {count} of the CPU’s',
  backgammonPointSelected: 'Point {point}: selected',
  backgammonPointTarget: 'Move to point {point}',
  backgammonBarYours: 'Bar: {count} of yours',
  backgammonBarCpu: 'Bar: {count} of the CPU’s',
  backgammonBarSelected: 'Bar: selected',
  backgammonBarEmpty: 'Bar: empty',
  backgammonOffTarget: 'Bear off',
  backgammonOffTray: 'Borne off: you {you}, CPU {cpu}',
  backgammonWinTitle: 'You won',
  backgammonLoseTitle: 'The CPU won',
  backgammonNoResultTitle: 'No result',
  backgammonWinBody: 'All fifteen checkers are off the board.',
  backgammonLoseBody: 'The CPU bore off first. The next match is free.',
  backgammonNoResultBody: 'The match ran past the roll limit and ends without a result.',
  backgammonKind_single: 'Single game',
  backgammonKind_gammon: 'Gammon',
  backgammonKind_backgammon: 'Backgammon',
  backgammonBorneOff: 'Borne off',
  backgammonRecordNote: '{wins} won · {losses} lost',
  backgammonStatsWins: 'Wins',
  backgammonStatsLosses: 'Losses',
  backgammonStatsTime: 'Time played',
  backgammonStep1Title: 'Roll and move',
  backgammonStep1Body:
    'Roll two dice and move your checkers towards your home board at the bottom right. Use the two numbers on two checkers, or both on one.',
  backgammonStep2Title: 'Hit and enter',
  backgammonStep2Body:
    'Land on a point holding a single CPU checker and it goes to the bar. A checker on the bar must enter in the far quadrant before anything else moves. Two or more checkers block a point.',
  backgammonStep3Title: 'Bear off',
  backgammonStep3Body:
    'Once all fifteen are in your home board, the dice take them off the board. First to bear off all fifteen wins.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BackgammonMessages = Record<keyof typeof en, string>;
