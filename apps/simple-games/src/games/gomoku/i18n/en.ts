/**
 * Gomoku's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Gomoku's.
 *
 * `gomokuName` is the literal 'Gomoku' in every locale: a game's title is a
 * proper noun and is never translated (docs/I18N_POLICY.md).
 */
export const en = {
  gomokuName: 'Gomoku',
  gomokuChooseOpponent: 'Choose your opponent',
  gomokuDifficulty_easy: 'Easy',
  gomokuDifficulty_normal: 'Normal',
  gomokuDifficulty_hard: 'Hard',
  gomokuRecordNote: 'Won {wins} · Lost {losses}',
  gomokuBoardLabel: 'Gomoku board, 15 by 15',
  gomokuChooseSideLabel: 'Which colour you play',
  gomokuPlayBlack: 'Black · first',
  gomokuPlayWhite: 'White · second',
  gomokuPointEmpty: 'Row {row}, column {col}: empty',
  gomokuPointMine: 'Row {row}, column {col}: your stone',
  gomokuPointTheirs: 'Row {row}, column {col}: CPU stone',
  gomokuPointPending: 'Row {row}, column {col}: tap again to place',
  gomokuYou: 'You',
  gomokuCpu: 'CPU',
  gomokuYourTurn: 'Your turn — tap once to aim, again to place',
  gomokuConfirmPrompt: 'Tap the same point again to place your stone.',
  gomokuCpuTurn: 'CPU is thinking…',
  gomokuWinTitle: 'You win!',
  gomokuWinBody: 'Five in a row.',
  gomokuLoseTitle: 'The CPU wins',
  gomokuLoseBody: 'The CPU got five in a row. The next match is free.',
  gomokuDrawTitle: 'A draw',
  gomokuDrawBody: 'The board filled up with nobody making five.',
  gomokuWins: 'Wins',
  gomokuLosses: 'Losses',
  gomokuDraws: 'Draws',
  gomokuStep1Title: 'Tap once to aim, again to place',
  gomokuStep1Body:
    'The first tap marks the point; the second commits it. Tap somewhere else to move the mark.',
  gomokuStep2Title: 'Five in a row wins',
  gomokuStep2Body: 'Line up five of your stones across, down, or diagonally. Six counts too.',
  gomokuStep3Title: 'Block the open three',
  gomokuStep3Body:
    'Three of the CPU’s stones with both ends free become four you cannot stop. Undo is free.',
  gomokuConfirmSwitchTitle: 'Replace the match in progress?',
  gomokuConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type GomokuMessages = Record<keyof typeof en, string>;
