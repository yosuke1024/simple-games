import type { Messages } from './en';

export const zhHans: Messages = {
  tagline: '离线可玩。无需账号。没有付费墙。',

  resume: '继续',
  dailyChallenge: '每日挑战',
  dailyDoneBadge: '今日已完成',
  howToPlay: '玩法说明',
  statistics: '统计',
  settings: '设置',

  modeLevel: '第 {n} 关',
  levelSelect: '选择关卡',
  levelLocked: '第 {n} 关，未解锁',
  nextLevel: '下一关',
  levelsTitle: '关卡',
  reachedLevel: '已达关卡',

  score: '得分',

  dailyPast: '往期每日',
  dailyToday: '今天',
  dailyBacklogHint: '通关后可解锁前一天。',
  modeDaily: '每日',
  freePlay: '自由模式',
  freePlayNote: '随时开始新棋盘。',
  difficulty: '难度',
  undo: '撤销',
  hint: '提示',
  timeLabel: '时间',
  movesLabel: '步数',

  tryAgain: '重玩同一局',
  newGame: '新游戏',
  backHome: '首页',

  confirmNewGameTitle: '开始新游戏？',
  confirmNewGameBody: '当前进度将会丢失。',
  cancel: '取消',
  confirm: '开始',

  startPlaying: '开始游戏',
  next: '下一步',
  back: '上一步',
  close: '关闭',

  language: '语言',
  languageSystem: '跟随系统',
  theme: '主题',
  themeSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  sound: '音效',
  vibration: '振动',
  reducedMotion: '减少动画',
  privacyPolicy: '隐私政策',
  termsOfUse: '使用条款',
  adPrivacyOptions: '广告隐私选项',
  resetData: '清除本地数据',
  resetConfirmTitle: '删除全部本地数据？',
  resetConfirmBody: '这将从本设备删除你的游戏、统计和设置。此操作无法撤销。',
  delete: '删除',
  version: '版本',

  played: '游戏局数',
  cleared: '通关次数',
  totalTime: '总游戏时间',
  bestTime: '最快通关',

  // Collection shell
  gamesHeading: '游戏',
  recentHeading: '最近玩过',
  favoritesHeading: '收藏',
  addToFavorites: '添加到收藏',
  removeFromFavorites: '从收藏中移除',
  categoryLogic: '逻辑',
  categoryCards: '纸牌',
  categoryPuzzle: '益智',
  categoryBoard: '棋类',
  categoryArcade: '街机',
  categoryDrills: '练习',
  backToGames: '全部游戏',
  gameLoading: '加载中…',
  gameLoadFailed: '无法加载游戏。',
  gameLoadRetry: '重试',
  learnMore: '了解更多',

  // About & open source
  aboutTitle: '关于',
  viewSource: '查看源代码',
  reportBug: '报告问题',
  suggestGame: '建议新游戏',
  viewLicenses: '查看许可证',

  // Ads & support
  removeAdsTitle: '移除广告，支持 Simple Games',
  adSupportBody:
    'Simple Games 在你联网时显示一条小小的横幅广告，用于帮我维持和改进这款应用。不想看广告？一次性购买即可永久移除。',
  removeAdsAction: '移除广告',
  restorePurchase: '恢复购买',
  purchaseThanks: '横幅广告已移除。感谢你支持 Simple Games。',

  reviewPromptTitle: '喜欢 Simple Games 吗?',
  reviewYes: '喜欢,玩得开心',
  reviewNo: '不太喜欢',
  reviewLater: '以后再说',
  reviewFeedbackTitle: '哪里可以做得更好?',
  reviewFeedbackBody:
    '欢迎发邮件告诉我——每条消息我都会看。在你于邮件应用中按下发送之前,不会发送任何内容。',
  reviewFeedbackAction: '写邮件',

  // The browser version's one-time pointer at the app
  webAppPromptTitle: '更安静地玩，从第一次启动就完全离线。',
  webAppPromptBody: '应用可以从主屏幕直接打开，并把你的进度保存在这台设备上。',

  // The optional share on a result screen. {game} is the registry title, a
  // proper noun that is not translated; `cleared` is only used for a real win.
  shareAction: '分享',
  shareCleared: '我在 Simple Games 里通关了 {game}。',
  sharePlayed: '我在 Simple Games 里玩了 {game}。',
  shareInvite: '在浏览器里就能直接玩。',
  shareChallenge: '你也来试试?',
  shareCardCleared: '通关!',
  shareCopied: '已复制链接',

  // ---- Arcade (Brick Breaker / Sky Fighter) ----
  livesLeft: '生命：{n}',
  levelsCleared: '已通过关卡',
};
