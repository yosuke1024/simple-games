/**
 * Minesweeper's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for minesweeper's.
 */
export const en = {
  minesName: 'Minesweeper',
  minesChooseBoard: 'Choose a board',
  minesDifficulty_easy: 'Easy',
  minesDifficulty_medium: 'Medium',
  minesDifficulty_hard: 'Hard',
  minesBoardNote: '{width}×{height} · {mines} mines',
  minesConfirmSwitchTitle: 'Replace the board in progress?',
  minesConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',
  minesBoardLabel: 'Minefield, {width} columns by {height} rows',
  minesCellHidden: 'Unopened, row {row}, column {col}',
  minesCellFlagged: 'Flagged, row {row}, column {col}',
  minesCellEmpty: 'Empty, row {row}, column {col}',
  minesCellNumber: '{count} mines nearby, row {row}, column {col}',
  minesCellMine: 'Mine, row {row}, column {col}',
  minesMinesLeft: 'Mines left',
  minesTapToStart: 'Tap any square. The first tap is always safe.',
  minesFlagMode: 'Flag mode',
  minesFlagModeNote: 'A tap plants a flag; a long press opens.',
  minesHintFound: 'This square is safe — the highlighted numbers show why.',
  minesHintNone: 'Nothing can be worked out yet.',
  minesNewBoard: 'New board',
  minesWonTitle: 'Cleared!',
  minesWonBody: 'Every square without a mine is open.',
  minesLostTitle: 'Mine opened',
  minesLostBody: 'This game ends here. The same board is ready whenever you are.',
  minesNewBestTime: 'Your fastest yet.',
  minesHintsUsed: 'Hints',
  minesGamesWon: 'Games won',
  minesWinRate: 'Win rate',
  minesDailySection: 'Daily',
  minesDailiesCleared: 'Days cleared',
  minesStep1Title: 'A number counts mines',
  minesStep1Body: 'It says how many of the eight squares around it hold a mine.',
  minesStep2Title: 'Flag what you are sure of',
  minesStep2Body: 'Long-press a square to flag it. Flag mode makes a plain tap do it instead.',
  minesStep3Title: 'Open the rest to win',
  minesStep3Body: 'Your first tap is always safe, and no board ever needs a guess.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type MinesweeperMessages = Record<keyof typeof en, string>;
