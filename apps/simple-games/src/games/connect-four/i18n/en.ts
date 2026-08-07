/**
 * Connect Four's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. The shell's en.ts
 * stays the source of truth for shared keys, this file for Connect Four's.
 *
 * The prefix is `four` rather than `connect4` because it reads as a word in
 * key names; `fourName` is the literal 'Connect Four' in every locale, since
 * a game's title is a proper noun and is never translated
 * (docs/I18N_POLICY.md).
 */
export const en = {
  fourName: 'Connect Four',
  fourChooseOpponent: 'Choose your opponent',
  fourDifficulty_easy: 'Easy',
  fourDifficulty_normal: 'Normal',
  fourDifficulty_hard: 'Hard',
  fourChooseSideLabel: 'Who drops first',
  fourGoFirst: 'You first',
  fourGoSecond: 'CPU first',
  fourRecordNote: 'Won {wins} · Lost {losses}',
  fourBoardLabel: 'Connect Four board, 7 columns by 6',
  fourColumnEmpty: 'Column {col}: empty',
  fourColumnStack: 'Column {col}, from the bottom: {stack}',
  fourDiscYou: 'yours',
  fourDiscCpu: 'CPU',
  fourYou: 'You',
  fourCpu: 'CPU',
  fourYourTurn: 'Your turn',
  fourCpuTurn: 'CPU is thinking…',
  fourWinTitle: 'You win!',
  fourWinBody: 'Four in a row.',
  fourLoseTitle: 'The CPU wins',
  fourLoseBody: 'The CPU got four in a row. The next match is free.',
  fourDrawTitle: 'A draw',
  fourDrawBody: 'The board filled up with nobody making four.',
  fourWins: 'Wins',
  fourLosses: 'Losses',
  fourDraws: 'Draws',
  fourStep1Title: 'Tap a column to drop',
  fourStep1Body: 'Your disc falls to the lowest free space in that column.',
  fourStep2Title: 'Four in a row wins',
  fourStep2Body: 'Line up four of your discs across, down, or diagonally.',
  fourStep3Title: 'Block before you build',
  fourStep3Body: 'When the CPU has three in a line, take the square it needs. Undo is free.',
  fourConfirmSwitchTitle: 'Replace the match in progress?',
  fourConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ConnectFourMessages = Record<keyof typeof en, string>;
