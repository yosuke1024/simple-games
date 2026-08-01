/**
 * English catalog — the source of truth for message keys.
 * All other locales must provide every key (enforced by the Messages type).
 */
export const en = {
  numberMatchName: 'Number Match',
  tagline: 'Works offline. No account. No paywalls.',

  // Home
  resume: 'Resume',
  dailyChallenge: 'Daily Challenge',
  dailyDoneBadge: 'Completed today',
  howToPlay: 'How to Play',
  statistics: 'Statistics',
  settings: 'Settings',

  // Levels
  modeLevel: 'Level {n}',
  levelSelect: 'Select Level',
  levelLocked: 'Level {n}, locked',
  nextLevel: 'Next Level',
  levelsTitle: 'Levels',
  reachedLevel: 'Reached level',

  // Score
  score: 'Score',
  best: 'Best',
  newBest: 'New best!',
  scoreMatches: 'Matches',
  scoreRows: 'Row bonus',
  scoreClearBonus: 'Clear bonus',
  scoreNoHint: 'No-hint bonus',
  bestScores: 'Best Scores',
  totalBest: 'Total of level bests',

  // Game
  dailyPast: 'Past Dailies',
  dailyToday: 'Today',
  dailyBacklogHint: 'Clear a day to unlock the one before it.',
  modeDaily: 'Daily',
  undo: 'Undo',
  hint: 'Hint',
  addNumbers: 'Add',
  timeLabel: 'Time',
  movesLabel: 'Moves',
  boardLabel: 'Game board',
  cellLabel: '{value}, row {row}, column {col}',
  cellLabelStone: 'Stone, row {row}, column {col}',
  cellLabelWild: 'Wild, row {row}, column {col}',
  hintNoneToast: 'No pairs available — try Add.',
  wildIntroToast: 'The ✦ tile pairs with any number.',
  stoneIntroToast: 'Stones cannot be matched, and block the way.',

  // Result overlays
  clearTitle: 'Board cleared!',
  clearBody: 'You removed every number.',
  gameOverTitle: 'No more moves',
  gameOverBody: 'The board reached its limit.',
  tryAgain: 'Retry same board',
  backHome: 'Home',

  // Confirmations
  confirmNewGameTitle: 'Start a new game?',
  confirmNewGameBody: 'Your current game will be lost.',
  cancel: 'Cancel',
  confirm: 'Start',

  // Tutorial (3 steps, spec §17)
  step1Title: 'Equal, or adds up to 10',
  step1Body: 'Match two numbers that are the same, or that add up to 10.',
  step2Title: 'Pick two that connect',
  step2Body:
    'Across, down, diagonally — or from the end of one row to the start of the next. Cleared cells are no obstacle, but a number still on the board blocks the way.',
  step3Title: 'Clear the board to win',
  step3Body:
    'Stuck? Tap Add to append the remaining numbers. Undo and hints are always free.',
  startPlaying: 'Start Playing',
  next: 'Next',
  back: 'Back',
  close: 'Close',

  // Settings
  language: 'Language',
  languageSystem: 'System',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  sound: 'Sound',
  vibration: 'Vibration',
  reducedMotion: 'Reduce motion',
  privacyPolicy: 'Privacy Policy',
  resetData: 'Reset Local Data',
  resetConfirmTitle: 'Delete all local data?',
  resetConfirmBody:
    'This removes your game, statistics, and settings from this device. It cannot be undone.',
  delete: 'Delete',
  version: 'Version',

  // Privacy summary (works fully offline; hosted policy URL added at release)
  privacy1:
    'No account. No sign-up. PixApps does not collect your name, email, contacts, or location.',
  privacy2:
    'Your game progress, statistics, and settings are stored only on this device. PixApps operates no servers and there is no cloud sync.',
  privacy3:
    'While online, ads served by Google AdMob may appear; Google may process device ad identifiers as described in its own privacy policy. Offline, no ads are shown and no ad requests are made.',
  privacy4: 'Deleting the app, or using "Reset Local Data", removes your data.',

  // Statistics
  played: 'Games played',
  cleared: 'Games cleared',
  gameOverCount: 'Game overs',
  totalTime: 'Total play time',
  bestTime: 'Fastest clear',

  // Collection shell
  gamesHeading: 'Games',
  numberMatchBlurb: 'Pair numbers that match or add up to 10.',
  backToGames: 'All games',
  learnMore: 'Learn More',

  // About & open source
  aboutTitle: 'About',
  viewSource: 'View Source Code',
  reportBug: 'Report a Bug',
  suggestGame: 'Suggest a Game',
  viewLicenses: 'View Licenses',

  // Ads & support (quiet, never a popup)
  removeAdsTitle: 'Remove Ads & Support Simple Games',
  adSupportBody:
    'Simple Games is supported by a small banner ad while you’re online. It helps me maintain and improve the app. Prefer no ads? A single one-time purchase removes them permanently.',
  removeAdsAction: 'Remove Ads',
  restorePurchase: 'Restore Purchase',
  purchaseThanks: 'Banner ads are removed. Thank you for supporting Simple Games.',

  // Store review (one quiet question, asked at most twice —
  // docs/REVIEW_PROMPT_POLICY.md)
  reviewPromptTitle: 'Enjoying Simple Games?',
  reviewYes: 'Yes, I’m enjoying it',
  reviewNo: 'Not really',
  reviewLater: 'Not now',
  reviewFeedbackTitle: 'What could be better?',
  reviewFeedbackBody:
    'Tell me in an email — I read every message. Nothing is sent until you press send in your mail app.',
  reviewFeedbackAction: 'Write an email',

  privacy5:
    'An optional one-time purchase can remove banner ads. The purchase is processed by Google Play; PixApps never receives or stores payment details.',

  // Sudoku
  sudokuName: 'Sudoku',
  sudokuBlurb: 'Fill every row, column and box with 1-9.',
  sudokuGridLabel: 'Sudoku grid',
  sudokuPadLabel: 'Number pad',
  sudokuPadKey: '{value}, {n} left',
  sudokuPadNoteKey: 'Note {value}',
  sudokuCellEmpty: 'Empty, row {row}, column {col}',
  sudokuCellGiven: '{value}, given, row {row}, column {col}',
  sudokuCellEntry: '{value}, row {row}, column {col}',
  sudokuErase: 'Erase',
  sudokuNotes: 'Notes',
  sudokuMistakes: 'Mistakes',
  sudokuTier_easy: 'Easy',
  sudokuTier_medium: 'Medium',
  sudokuTier_hard: 'Hard',
  sudokuSolvedTitle: 'Solved!',
  sudokuSolvedBody: 'Every row, column and box holds 1-9.',
  sudokuNewBestTime: 'Your fastest yet.',
  sudokuLevelsSolved: 'Levels solved',
  sudokuDailiesSolved: 'Dailies solved',
  sudokuAverageTime: 'Average clear',
  sudokuHighlightMistakes: 'Show mistakes',
  sudokuHighlightMistakesNote: 'Marks a digit that does not match the solution. Duplicates are always marked.',
  sudokuHintNone: 'Nothing can be worked out yet.',
  sudokuHintOnlyDigit: 'Only one digit fits this cell.',
  sudokuHintOnlyCell: 'This is the only place {value} can go here.',
  sudokuHintLockedLine: 'In this box, {value} only fits on the highlighted line.',
  sudokuHintLockedBox: 'On this line, {value} only fits inside the highlighted box.',
  sudokuHintRuledOut: 'These cells rule the digits out elsewhere in the unit.',
  sudokuStep1Title: '1-9, once each',
  sudokuStep1Body: 'Every row, column and 3x3 box holds 1 to 9 exactly once.',
  sudokuStep2Title: 'Note what might fit',
  sudokuStep2Body: 'Tap Notes to pencil in candidates while you narrow a cell down.',
  sudokuStep3Title: 'Stuck? Take a hint',
  sudokuStep3Body: 'A hint shows which cell is decided and why. Hints and undo are always free.',

  // ---- Sliding Puzzle ----
  slideName: 'Sliding Puzzle',
  slideBlurb: 'Slide the numbers back into order.',

  // Board and accessibility
  slideBoardLabel: 'Sliding puzzle board',
  slideTileLabel: '{value}, row {row}, column {col}',
  slideBlankLabel: 'Empty, row {row}, column {col}',
  slideSizeLabel: '{n}x{n}',

  // Play
  slideMoves: 'Moves',
  slideBestMoves: 'Fewest moves',

  // Clear screen
  slideSolvedTitle: 'Solved!',
  slideSolvedBody: 'Every number is back in order.',
  slideNewBestMoves: 'Your fewest moves yet.',
  slideNewBestTime: 'Your fastest yet.',

  // Statistics and daily
  slideLevelsSolved: 'Levels solved',
  slideDailiesSolved: 'Dailies solved',
  slideDailyBacklogHint: 'Every earlier day stays open.',

  // Quick Rules (3 steps, §11)
  slideStep1Title: 'Tap next to the gap',
  slideStep1Body: 'Tap a tile beside the empty square and it slides into it.',
  slideStep2Title: 'A whole row moves',
  slideStep2Body: 'In the same row or column, every tile in between slides together.',
  slideStep3Title: 'Put 1 to the end in order',
  slideStep3Body: 'Line the numbers up in reading order with the gap at the bottom right.',

  // ---- Nonogram ----
  nonoName: 'Nonogram',
  nonoBlurb: 'Paint the squares the number clues describe.',

  // Board
  nonoBoardLabel: 'Nonogram board, {size} by {size}',
  nonoCellBlank: 'Blank, row {row}, column {col}',
  nonoCellFilled: 'Painted, row {row}, column {col}',
  nonoCellCrossed: 'Crossed, row {row}, column {col}',
  nonoRowClueLabel: 'Row {n}: {clue}',
  nonoColClueLabel: 'Column {n}: {clue}',
  nonoSizeLabel: '{n}×{n}',

  // Actions
  nonoXMode: 'X Mode',
  nonoXModeNote: 'Tap crosses out; long-press paints.',
  nonoHintFound: 'The highlighted line decides a square.',
  nonoHintBroken: 'The highlighted line no longer fits its clue.',
  nonoHintNone: 'No certain move found right now.',

  // Result
  nonoSolvedTitle: 'Solved!',
  nonoSolvedBody: 'Every clue reads true.',
  nonoHintsUsed: 'Hints used',
  nonoNewBestTime: 'Your fastest yet.',

  // Statistics and daily
  nonoLevelsSolved: 'Levels solved',
  nonoDailiesSolved: 'Dailies solved',
  nonoDailyBacklogHint: 'Every earlier day stays open.',

  // Quick Rules (3 steps, Â§11)
  nonoStep1Title: 'Numbers are runs',
  nonoStep1Body: 'Each number is a run of painted squares in order, with at least one gap between runs.',
  nonoStep2Title: 'Cross out what cannot be',
  nonoStep2Body: 'Mark the squares that stay empty with a cross to narrow the line down.',
  nonoStep3Title: 'Satisfy every line',
  nonoStep3Body: 'When every row and column reads true, the board is done. Guessing is never needed.',

  // ---- Minesweeper ----
  minesName: 'Minesweeper',
  minesBlurb: 'Open every square that has no mine.',

  // Home
  minesChooseBoard: 'Choose a board',
  minesDifficulty_easy: 'Easy',
  minesDifficulty_medium: 'Medium',
  minesDifficulty_hard: 'Hard',
  minesBoardNote: '{width}×{height} · {mines} mines',
  minesConfirmSwitchTitle: 'Replace the board in progress?',
  minesConfirmSwitchBody: 'Your {current} game will be replaced by a new {next} board.',

  // Board
  minesBoardLabel: 'Minefield, {width} columns by {height} rows',
  minesCellHidden: 'Unopened, row {row}, column {col}',
  minesCellFlagged: 'Flagged, row {row}, column {col}',
  minesCellEmpty: 'Empty, row {row}, column {col}',
  minesCellNumber: '{count} mines nearby, row {row}, column {col}',
  minesCellMine: 'Mine, row {row}, column {col}',
  minesMinesLeft: 'Mines left',
  minesTapToStart: 'Tap any square. The first tap is always safe.',

  // Actions
  minesFlagMode: 'Flag mode',
  minesFlagModeNote: 'A tap plants a flag; a long press opens.',
  minesHintFound: 'This square is safe — the highlighted numbers show why.',
  minesHintNone: 'Nothing can be worked out yet.',
  minesNewBoard: 'New board',

  // Result
  minesWonTitle: 'Cleared!',
  minesWonBody: 'Every square without a mine is open.',
  minesLostTitle: 'Mine opened',
  minesLostBody: 'This game ends here. The same board is ready whenever you are.',
  minesNewBestTime: 'Your fastest yet.',
  minesHintsUsed: 'Hints',

  // Statistics
  minesGamesWon: 'Games won',
  minesWinRate: 'Win rate',
  minesDailySection: 'Daily',
  minesDailiesCleared: 'Days cleared',

  // Quick Rules
  minesStep1Title: 'A number counts mines',
  minesStep1Body: 'It says how many of the eight squares around it hold a mine.',
  minesStep2Title: 'Flag what you are sure of',
  minesStep2Body: 'Long-press a square to flag it. Flag mode makes a plain tap do it instead.',
  minesStep3Title: 'Open the rest to win',
  minesStep3Body: 'Your first tap is always safe, and no board ever needs a guess.',
} as const;

export type Messages = Record<keyof typeof en, string>;
