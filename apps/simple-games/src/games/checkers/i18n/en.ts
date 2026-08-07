/**
 * Checkers' own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Checkers'.
 *
 * `checkersName` is the literal 'Checkers' in every locale: a game's title is
 * a proper noun and is never translated (docs/I18N_POLICY.md).
 */
export const en = {
  checkersName: 'Checkers',
  checkersChooseOpponent: 'Choose your opponent',
  checkersDifficulty_easy: 'Easy',
  checkersDifficulty_normal: 'Normal',
  checkersDifficulty_hard: 'Hard',
  checkersChooseSideLabel: 'Who moves first',
  checkersGoFirst: 'You first',
  checkersGoSecond: 'CPU first',
  checkersRecordNote: 'Won {wins} · Lost {losses}',
  checkersBoardLabel: 'Checkers board, 8 by 8',
  checkersSquareEmpty: 'Row {row}, column {col}: empty',
  checkersSquareYourMan: 'Row {row}, column {col}: your piece',
  checkersSquareYourKing: 'Row {row}, column {col}: your king',
  checkersSquareCpuMan: 'Row {row}, column {col}: CPU piece',
  checkersSquareCpuKing: 'Row {row}, column {col}: CPU king',
  checkersSquareSelected: 'Row {row}, column {col}: your piece, selected',
  checkersSquareTarget: 'Row {row}, column {col}: move here',
  checkersYou: 'You',
  checkersCpu: 'CPU',
  checkersYourTurn: 'Your turn',
  checkersCpuTurn: 'CPU is thinking…',
  checkersMustCapture: 'A capture is on — only the pieces that can jump may move.',
  checkersJumpAgain: 'Jump again with the same piece.',
  checkersKings: 'Kings',
  checkersWinTitle: 'You win!',
  checkersWinBody: 'The CPU has nothing left to move.',
  checkersLoseTitle: 'The CPU wins',
  checkersLoseBody: 'Nothing left to move. The next match is free.',
  checkersDrawTitle: 'A draw',
  checkersDrawBody:
    'Fifty turns without a capture or a man moving — neither side is getting anywhere.',
  checkersWins: 'Wins',
  checkersLosses: 'Losses',
  checkersDraws: 'Draws',
  checkersStep1Title: 'Move diagonally forward',
  checkersStep1Body:
    'One dark square at a time. Jump an enemy piece to take it — and when you can jump, that is the only move you may play.',
  checkersStep2Title: 'Keep jumping',
  checkersStep2Body: 'If the same piece can jump again from where it landed, it must.',
  checkersStep3Title: 'Reach the far row to crown',
  checkersStep3Body:
    'A crowned king moves backwards too. Take every enemy piece — or leave them nowhere to go — and you win.',
  checkersConfirmSwitchTitle: 'Replace the match in progress?',
  checkersConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type CheckersMessages = Record<keyof typeof en, string>;
