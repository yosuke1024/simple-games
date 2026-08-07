/**
 * English catalog — the source of truth for message keys.
 * All other locales must provide every key (enforced by the Messages type).
 */
export const en = {
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

  // Game
  dailyPast: 'Past Dailies',
  dailyToday: 'Today',
  dailyBacklogHint: 'Clear a day to unlock the one before it.',
  modeDaily: 'Daily',
  undo: 'Undo',
  hint: 'Hint',
  timeLabel: 'Time',
  movesLabel: 'Moves',

  tryAgain: 'Retry same board',
  newGame: 'New Game',
  backHome: 'Home',

  // Confirmations
  confirmNewGameTitle: 'Start a new game?',
  confirmNewGameBody: 'Your current game will be lost.',
  cancel: 'Cancel',
  confirm: 'Start',

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
  termsOfUse: 'Terms of Use',
  resetData: 'Reset Local Data',
  resetConfirmTitle: 'Delete all local data?',
  resetConfirmBody:
    'This removes your game, statistics, and settings from this device. It cannot be undone.',
  delete: 'Delete',
  version: 'Version',

  // Statistics
  played: 'Games played',
  cleared: 'Games cleared',
  totalTime: 'Total play time',
  bestTime: 'Fastest clear',

  // Collection shell
  gamesHeading: 'Games',
  recentHeading: 'Recently played',
  // Section headings on the collection home, one per GameCategoryId
  // (app/registry.ts GAME_CATEGORIES)
  categoryLogic: 'Logic',
  categoryCards: 'Cards',
  categoryPuzzle: 'Puzzle',
  categoryBoard: 'Board Games',
  categoryArcade: 'Arcade',
  categoryDrills: 'Drills',
  backToGames: 'All games',
  gameLoading: 'Loading…',
  gameLoadFailed: 'The game could not be loaded.',
  gameLoadRetry: 'Try again',
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

  // ---- Arcade (shared by Brick Breaker and Sky Fighter) ----
  livesLeft: 'Lives: {n}',
  levelsCleared: 'Levels cleared',
} as const;

export type Messages = Record<keyof typeof en, string>;
