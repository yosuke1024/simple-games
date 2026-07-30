/**
 * English catalog — the source of truth for message keys.
 * All other locales must provide every key (enforced by the Messages type).
 */
export const en = {
  appName: 'Number Match',
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
    'No account. No sign-up. We do not collect your name, email, contacts, or location.',
  privacy2:
    'Your game progress, statistics, and settings are stored only on this device. We operate no servers and there is no cloud sync.',
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
  collectionTagline: 'Fully free. Fully offline. Simply playable.',
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
    'Simple Games is supported by a small banner ad while you’re online. It helps us maintain and improve the app. Prefer no ads? A single one-time purchase removes them permanently.',
  removeAdsAction: 'Remove Ads',
  restorePurchase: 'Restore Purchase',
  purchaseThanks: 'Banner ads are removed. Thank you for supporting Simple Games.',
  privacy5:
    'An optional one-time purchase can remove banner ads. The purchase is processed by Google Play; we never receive or store payment details.',
} as const;

export type Messages = Record<keyof typeof en, string>;
