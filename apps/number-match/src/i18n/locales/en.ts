/**
 * English catalog — the source of truth for message keys.
 * All other locales must provide every key (enforced by the Messages type).
 */
export const en = {
  appName: 'Number Match',
  tagline: 'Works offline. No account. No purchases.',

  // Home
  resume: 'Resume',
  newGame: 'New Game',
  dailyChallenge: 'Daily Challenge',
  dailyDoneBadge: 'Completed today',
  streakLine: '{n} day streak',
  howToPlay: 'How to Play',
  statistics: 'Statistics',
  settings: 'Settings',

  // Game
  modeClassic: 'Classic',
  modeDaily: 'Daily',
  undo: 'Undo',
  hint: 'Hint',
  addNumbers: 'Add',
  timeLabel: 'Time',
  movesLabel: 'Moves',
  boardLabel: 'Game board',
  cellLabel: '{value}, row {row}, column {col}',
  clearedCellLabel: 'Empty cell',
  hintNoneToast: 'No pairs available — try Add.',
  menu: 'Menu',

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
    'Across, down, diagonally — or from the end of one row to the start of the next. Empty cells in between are no obstacle.',
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

  // Statistics
  played: 'Games played',
  cleared: 'Games cleared',
  gameOverCount: 'Game overs',
  totalTime: 'Total play time',
  bestTime: 'Fastest clear',
  streak: 'Current streak',
  bestStreak: 'Best streak',
} as const;

export type Messages = Record<keyof typeof en, string>;
