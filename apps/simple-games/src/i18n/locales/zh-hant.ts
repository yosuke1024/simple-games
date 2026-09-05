import type { Messages } from './en';

export const zhHant: Messages = {
  tagline: '離線可玩。免帳號。無付費牆。',

  resume: '繼續',
  dailyChallenge: '每日挑戰',
  dailyDoneBadge: '今日已完成',
  howToPlay: '玩法說明',
  statistics: '統計',
  settings: '設定',

  modeLevel: '第 {n} 關',
  levelSelect: '選擇關卡',
  levelLocked: '第 {n} 關，未解鎖',
  nextLevel: '下一關',
  levelsTitle: '關卡',
  reachedLevel: '已達關卡',

  score: '分數',

  dailyPast: '過往每日',
  dailyToday: '今天',
  dailyBacklogHint: '過關後就能解鎖前一天。',
  modeDaily: '每日',
  freePlay: '自由模式',
  freePlayNote: '隨時開始新棋盤。',
  difficulty: '難度',
  undo: '復原',
  hint: '提示',
  timeLabel: '時間',
  movesLabel: '步數',

  tryAgain: '重玩同一盤',
  newGame: '新遊戲',
  backHome: '首頁',

  confirmNewGameTitle: '開始新遊戲？',
  confirmNewGameBody: '目前的進度會消失。',
  cancel: '取消',
  confirm: '開始',

  startPlaying: '開始遊戲',
  next: '下一步',
  back: '上一步',
  close: '關閉',

  language: '語言',
  languageSystem: '跟隨系統',
  theme: '主題',
  themeSystem: '跟隨系統',
  themeLight: '淺色',
  themeDark: '深色',
  sound: '音效',
  vibration: '震動',
  reducedMotion: '減少動態效果',
  privacyPolicy: '隱私權政策',
  termsOfUse: '使用條款',
  adPrivacyOptions: '廣告隱私選項',
  resetData: '清除本機資料',
  resetConfirmTitle: '刪除所有本機資料？',
  resetConfirmBody: '這會從這台裝置刪除你的遊戲、統計和設定，而且無法復原。',
  delete: '刪除',
  version: '版本',

  played: '遊玩局數',
  cleared: '過關次數',
  totalTime: '總遊玩時間',
  bestTime: '最快過關',

  // Collection shell
  gamesHeading: '遊戲',
  recentHeading: '最近玩過',
  favoritesHeading: '收藏',
  addToFavorites: '加入收藏',
  removeFromFavorites: '從收藏中移除',
  addToHomeScreen: '加入主畫面',
  categoryLogic: '邏輯',
  categoryCards: '紙牌',
  categoryPuzzle: '益智',
  categoryBoard: '棋類',
  categoryArcade: '街機',
  categoryDrills: '練習',
  backToGames: '所有遊戲',
  gameLoading: '載入中…',
  gameLoadFailed: '無法載入遊戲。',
  gameLoadRetry: '重試',
  learnMore: '了解更多',

  // About & open source
  aboutTitle: '關於',
  viewSource: '查看原始碼',
  reportBug: '回報問題',
  suggestGame: '建議新遊戲',
  viewLicenses: '查看授權',

  // Ads & support
  removeAdsTitle: '移除廣告，支持 Simple Games',
  adSupportBody:
    'Simple Games 會在你連上網路時顯示一則小小的橫幅廣告，用來幫我維持與改進這個應用程式。不想看廣告嗎？只要一次性購買，就能永久移除。',
  removeAdsAction: '移除廣告',
  restorePurchase: '恢復購買',
  purchaseThanks: '橫幅廣告已移除。感謝你支持 Simple Games。',

  reviewPromptTitle: '喜歡 Simple Games 嗎?',
  reviewYes: '喜歡,玩得開心',
  reviewNo: '不太喜歡',
  reviewLater: '之後再說',
  reviewFeedbackTitle: '哪裡可以做得更好?',
  reviewFeedbackBody:
    '歡迎寄封信告訴我——每則訊息我都會看。在你於郵件 App 按下傳送之前,不會送出任何內容。',
  reviewFeedbackAction: '寫郵件',

  // The browser version's one-time pointer at the app
  webAppPromptTitle: '更安靜地玩，從第一次啟動就完全離線。',
  webAppPromptBody: 'App 可以從主畫面直接開啟，並把你的進度儲存在這台裝置上。',

  // The optional share on a result screen. {game} is the registry title, a
  // proper noun that is not translated; `cleared` is only used for a real win.
  shareAction: '分享',
  shareCleared: '我在 Simple Games 裡通關了 {game}。',
  sharePlayed: '我在 Simple Games 裡玩了 {game}。',
  shareInvite: '在瀏覽器裡就能直接玩。',
  shareChallenge: '你也來試試?',
  shareCardCleared: '破關!',
  shareCopied: '已複製連結',

  // ---- Arcade (Brick Breaker / Sky Fighter) ----
  livesLeft: '生命：{n}',
  levelsCleared: '已通過關卡',
};
