/**
 * Reversi's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Reversi's.
 *
 * `reversiName` is the literal 'Reversi' in every locale: a game's title is a
 * proper noun and is never translated (docs/I18N_POLICY.md).
 */
export const en = {
  reversiName: 'Reversi',
  reversiChooseOpponent: 'Choose your opponent',
  reversiDifficulty_easy: 'Easy',
  reversiDifficulty_normal: 'Normal',
  reversiDifficulty_hard: 'Hard',
  reversiRecordNote: 'Won {wins} · Lost {losses}',
  reversiBoardLabel: 'Reversi board, 8 by 8',
  reversiCellEmpty: 'Row {row}, column {col}: empty',
  reversiCellLegal: 'Row {row}, column {col}: your move',
  reversiCellMine: 'Row {row}, column {col}: your disc',
  reversiCellTheirs: 'Row {row}, column {col}: CPU disc',
  reversiChooseSideLabel: 'Which colour you play',
  reversiPlayBlack: 'Black · first',
  reversiPlayWhite: 'White · second',
  reversiYou: 'You',
  reversiCpu: 'CPU',
  reversiYourTurn: 'Your turn',
  reversiCpuTurn: 'CPU is thinking…',
  reversiPassYou: 'No move for you — the CPU plays again',
  reversiPassCpu: 'The CPU has no move — your turn again',
  reversiWinTitle: 'You win!',
  reversiWinBody: 'More of the board was yours when it settled.',
  reversiLoseTitle: 'The CPU wins',
  reversiLoseBody: 'The CPU held more discs at the end. The next match is free.',
  reversiDrawTitle: 'A draw',
  reversiDrawBody: 'An even split of the discs.',
  reversiWins: 'Wins',
  reversiLosses: 'Losses',
  reversiDraws: 'Draws',
  reversiStep1Title: 'Trap discs to turn them',
  reversiStep1Body:
    'Place on a dotted square so your discs close the line — everything trapped between becomes yours.',
  reversiStep2Title: 'No move? Play passes',
  reversiStep2Body:
    'If you have no legal square, your turn is skipped by itself — nothing to press.',
  reversiStep3Title: 'Most discs wins',
  reversiStep3Body: 'When neither side can move, the board is counted. Undo is free and unlimited.',
  reversiConfirmSwitchTitle: 'Replace the match in progress?',
  reversiConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ReversiMessages = Record<keyof typeof en, string>;
