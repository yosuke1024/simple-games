/**
 * Nested Tic-Tac-Toe's own strings (issue #38): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts. The
 * shell's catalog stays the source of truth for shared keys (Undo, New Game,
 * Home, Statistics, Difficulty …), this file for this game's.
 *
 * `en` is the original (docs/NESTED_TIC_TAC_TOE_RULES.md §12). Glossary, one
 * word each, before any translation: small board · big board (not on screen)
 * · send / sent (the board the next move goes to) · take / taken (three in a
 * row inside a small board) · first / second (who moves first) · cross /
 * circle (the names of the two marks, read out; the marks themselves are
 * drawn, never written). "Closed" is opened up on screen as "taken or full".
 *
 * `nestedTicTacToeName` is the literal title in every locale: a game's title
 * is a proper noun and is never translated (docs/I18N_POLICY.md).
 */
export const en = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Choose your opponent',
  nestedTicTacToeDifficulty_easy: 'Easy',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Hard',
  nestedTicTacToeRecordNote: 'Won {wins} · Lost {losses}',
  nestedTicTacToeChooseSideLabel: 'Who moves first',
  nestedTicTacToePlayFirst: 'First',
  nestedTicTacToePlaySecond: 'Second',
  nestedTicTacToePlayFirstLabel: 'First, playing cross',
  nestedTicTacToePlaySecondLabel: 'Second, playing circle',
  nestedTicTacToeConfirmSwitchTitle: 'Replace the match in progress?',
  nestedTicTacToeConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe board, nine small boards',
  nestedTicTacToeSmallOpen: 'Small board {board}: open',
  nestedTicTacToeSmallPlayable: 'Small board {board}: open, play here',
  nestedTicTacToeSmallMine: 'Small board {board}: you took it',
  nestedTicTacToeSmallCpu: 'Small board {board}: the CPU took it',
  nestedTicTacToeSmallDrawn: 'Small board {board}: drawn (closed)',
  nestedTicTacToeCellEmpty: 'Small board {board}, square {square}: empty',
  nestedTicTacToeCellPlayable: 'Small board {board}, square {square}: play here',
  nestedTicTacToeCellYourCross: 'Small board {board}, square {square}: your cross',
  nestedTicTacToeCellYourCircle: 'Small board {board}, square {square}: your circle',
  nestedTicTacToeCellCpuCross: 'Small board {board}, square {square}: CPU’s cross',
  nestedTicTacToeCellCpuCircle: 'Small board {board}, square {square}: CPU’s circle',
  nestedTicTacToeYourTurnSent: 'Your turn — play in the framed board',
  nestedTicTacToeYourTurnFree: 'Your turn — play in any open board',
  nestedTicTacToeCpuTurn: 'CPU’s turn',
  nestedTicTacToeWinTitle: 'You win',
  nestedTicTacToeWinBody: 'Three of your boards in a row.',
  nestedTicTacToeLoseTitle: 'The CPU wins',
  nestedTicTacToeLoseBody: 'The CPU took three boards in a row.',
  nestedTicTacToeDrawTitle: 'A draw',
  nestedTicTacToeDrawBody: 'Every small board closed, and neither side has three boards in a row.',
  nestedTicTacToeBoardsYou: 'Your boards',
  nestedTicTacToeBoardsCpu: 'CPU boards',
  nestedTicTacToeWins: 'Wins',
  nestedTicTacToeLosses: 'Losses',
  nestedTicTacToeDraws: 'Draws',
  nestedTicTacToeStep1Title: 'Your move sends theirs',
  nestedTicTacToeStep1Body:
    'Where you play inside a small board picks the board your opponent plays in next.',
  nestedTicTacToeStep2Title: 'Taken or full: play anywhere open',
  nestedTicTacToeStep2Body: 'If that board is taken or full, play in any open board.',
  nestedTicTacToeStep3Title: 'Three boards in a row',
  nestedTicTacToeStep3Body: 'Three in a row takes a small board; three taken boards in a row wins.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type NestedTicTacToeMessages = Record<keyof typeof en, string>;
