import type { Messages } from './en';

export const zhHant: Messages = {
  numberMatchName: '數字配對',
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
  best: '最佳',
  newBest: '新紀錄！',
  scoreMatches: '配對',
  scoreRows: '整列獎勵',
  scoreClearBonus: '過關獎勵',
  scoreNoHint: '無提示獎勵',
  bestScores: '最佳成績',
  totalBest: '各關最佳總和',

  dailyPast: '過往每日',
  dailyToday: '今天',
  dailyBacklogHint: '過關後就能解鎖前一天。',
  modeDaily: '每日',
  undo: '復原',
  hint: '提示',
  addNumbers: '新增',
  timeLabel: '時間',
  movesLabel: '步數',
  boardLabel: '遊戲盤面',
  cellLabel: '第 {row} 列第 {col} 欄，{value}',
  cellLabelStone: '第 {row} 列第 {col} 欄，石塊',
  cellLabelWild: '第 {row} 列第 {col} 欄，百搭',
  hintNoneToast: '沒有可配對的數字，試試「新增」。',
  wildIntroToast: '✦ 可以和任何數字配對。',
  stoneIntroToast: '石塊無法消除，還會擋路。',

  clearTitle: '全部消除！',
  clearBody: '你消除了所有數字。',
  gameOverTitle: '無法繼續',
  gameOverBody: '盤面已達上限。',
  tryAgain: '重玩同一盤',
  backHome: '首頁',

  confirmNewGameTitle: '開始新遊戲？',
  confirmNewGameBody: '目前的進度會消失。',
  cancel: '取消',
  confirm: '開始',

  step1Title: '相同，或相加為 10',
  step1Body: '消除兩個相同的數字，或相加等於 10 的兩個數字。',
  step2Title: '選出相連的兩個',
  step2Body:
    '橫、直、斜，或從一列的結尾接到下一列的開頭。已消除的格子不算阻擋，但還留在盤面上的數字會擋路。',
  step3Title: '全部消完就過關',
  step3Body: '卡住了？點「新增」把剩下的數字接到後面。復原和提示永遠免費。',
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
  resetData: '清除本機資料',
  resetConfirmTitle: '刪除所有本機資料？',
  resetConfirmBody: '這會從這台裝置刪除你的遊戲、統計和設定，而且無法復原。',
  delete: '刪除',
  version: '版本',

  privacy1: '免帳號，免註冊。我們不會收集你的姓名、電子郵件、通訊錄或位置資訊。',
  privacy2: '你的遊戲進度、統計和設定只存在這台裝置上。我們沒有伺服器，也沒有雲端同步。',
  privacy3:
    '連上網路時可能會顯示 Google AdMob 投放的廣告；Google 可能依其隱私權政策處理裝置廣告識別碼。離線時不會顯示廣告，也不會發出廣告請求。',
  privacy4: '刪除這個應用程式，或使用「清除本機資料」，即可刪除你的資料。',

  played: '遊玩局數',
  cleared: '過關次數',
  gameOverCount: '失敗次數',
  totalTime: '總遊玩時間',
  bestTime: '最快過關',

  // Collection shell
  gamesHeading: '遊戲',
  numberMatchBlurb: '消除相同或相加為 10 的數字。',
  backToGames: '所有遊戲',
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
    'Simple Games 會在你連上網路時顯示一則小小的橫幅廣告，用來維持與改進這個應用程式。不想看廣告嗎？只要一次性購買，就能永久移除。',
  removeAdsAction: '移除廣告',
  restorePurchase: '恢復購買',
  purchaseThanks: '橫幅廣告已移除。感謝你支持 Simple Games。',

  reviewPromptTitle: '喜歡 Simple Games 嗎?',
  reviewYes: '喜歡,玩得開心',
  reviewNo: '不太喜歡',
  reviewLater: '之後再說',
  reviewFeedbackTitle: '哪裡可以做得更好?',
  reviewFeedbackBody:
    '歡迎寄封信告訴我們——每則訊息我們都會看。在你於郵件 App 按下傳送之前,不會送出任何內容。',
  reviewFeedbackAction: '寫郵件',
  privacy5:
    '選擇性的一次性購買可以移除橫幅廣告。付款由 Google Play 處理，我們不會收到或保存任何付款資訊。',

  // Sudoku
  sudokuName: '數獨',
  sudokuBlurb: '在每一列、每一欄、每一宮填入 1-9。',
  sudokuGridLabel: '數獨盤面',
  sudokuPadLabel: '數字鍵盤',
  sudokuPadKey: '{value}，還剩 {n}',
  sudokuPadNoteKey: '筆記 {value}',
  sudokuCellEmpty: '空白，第 {row} 列第 {col} 欄',
  sudokuCellGiven: '{value}，題目數字，第 {row} 列第 {col} 欄',
  sudokuCellEntry: '{value}，第 {row} 列第 {col} 欄',
  sudokuErase: '清除',
  sudokuNotes: '筆記',
  sudokuMistakes: '錯誤',
  sudokuTier_easy: '簡單',
  sudokuTier_medium: '中等',
  sudokuTier_hard: '困難',
  sudokuSolvedTitle: '完成！',
  sudokuSolvedBody: '每一列、每一欄、每一宮都有 1-9。',
  sudokuNewBestTime: '你的最快紀錄。',
  sudokuLevelsSolved: '完成的關卡',
  sudokuDailiesSolved: '完成的每日',
  sudokuAverageTime: '平均用時',
  sudokuHighlightMistakes: '標出錯誤',
  sudokuHighlightMistakesNote: '標出和答案不符的數字。重複的數字一律會標出。',
  sudokuHintNone: '目前還推不出下一步。',
  sudokuHintOnlyDigit: '這一格只能填一個數字。',
  sudokuHintOnlyCell: '在這裡，{value} 只能填這一格。',
  sudokuHintLockedLine: '在這一宮裡，{value} 只能填在標示的那一線上。',
  sudokuHintLockedBox: '在這一線上，{value} 只能填在標示的那一宮裡。',
  sudokuHintRuledOut: '這幾格可以排除同一區域中其他格的候選數。',
  sudokuStep1Title: '1-9 各一次',
  sudokuStep1Body: '每一列、每一欄、每個 3x3 宮裡，1 到 9 各出現一次。',
  sudokuStep2Title: '記下可能的數字',
  sudokuStep2Body: '點「筆記」，在縮小範圍時把候選數寫進格子裡。',
  sudokuStep3Title: '卡住了？看提示',
  sudokuStep3Body: '提示會指出哪一格能確定，以及為什麼。提示和復原永遠免費。',

  // ---- Sliding Puzzle ----
  slideName: '數字推盤',
  slideBlurb: '把數字滑回原本的順序。',

  slideBoardLabel: '數字推盤盤面',
  slideTileLabel: '{value}，第 {row} 列第 {col} 欄',
  slideBlankLabel: '空格，第 {row} 列第 {col} 欄',
  slideSizeLabel: '{n}×{n}',

  slideMoves: '步數',
  slideBestMoves: '最少步數',

  slideSolvedTitle: '完成！',
  slideSolvedBody: '所有數字都回到原位了。',
  slideNewBestMoves: '你的最少步數紀錄。',
  slideNewBestTime: '你的最快紀錄。',

  slideLevelsSolved: '完成的關卡',
  slideDailiesSolved: '完成的每日',
  slideDailyBacklogHint: '過去的每一天都能隨時挑戰。',

  slideStep1Title: '點空格旁邊的方塊',
  slideStep1Body: '點空格旁邊的方塊，它就會滑進去。',
  slideStep2Title: '整排一起移動',
  slideStep2Body: '在同一列或同一欄上，中間的方塊會一起滑動。',
  slideStep3Title: '從 1 依序排好',
  slideStep3Body: '照閱讀順序排好數字，空格留在右下角。',

  // ---- Nonogram ----
  nonoName: '數織',
  nonoBlurb: '按數字提示塗滿方格。',

  nonoBoardLabel: '數織盤面，{size}×{size}',
  nonoCellBlank: '未定，第{row}行 第{col}列',
  nonoCellFilled: '已塗，第{row}行 第{col}列',
  nonoCellCrossed: '×，第{row}行 第{col}列',
  nonoRowClueLabel: '第{n}行提示：{clue}',
  nonoColClueLabel: '第{n}列提示：{clue}',
  nonoSizeLabel: '{n}×{n}',

  nonoXMode: '×模式',
  nonoXModeNote: '輕點畫×，長按塗色。',
  nonoHintFound: '高亮的行列可確定一格。',
  nonoHintBroken: '高亮的行列已與提示矛盾。',
  nonoHintNone: '現在沒有可確定的一步。',

  nonoSolvedTitle: '完成！',
  nonoSolvedBody: '所有提示都已滿足。',
  nonoHintsUsed: '使用的提示',
  nonoNewBestTime: '個人最快紀錄。',

  nonoLevelsSolved: '已完成的關卡',
  nonoDailiesSolved: '已完成的每日挑戰',
  nonoDailyBacklogHint: '之前的日期隨時可以挑戰。',

  nonoStep1Title: '數字表示連續塗色數',
  nonoStep1Body: '數字是該行或該列連續塗色的格數，多個數字之間至少空一格。',
  nonoStep2Title: '排除時畫×',
  nonoStep2Body: '給確定不塗的格子畫×，縮小範圍。',
  nonoStep3Title: '滿足所有行列',
  nonoStep3Body: '所有行和列的數字都滿足即完成，完全不需要猜。',

  // ---- Minesweeper ----
  minesName: '踩地雷',
  minesBlurb: '翻開所有沒有地雷的格子。',

  // Home
  minesChooseBoard: '選擇盤面',
  minesDifficulty_easy: '簡單',
  minesDifficulty_medium: '中等',
  minesDifficulty_hard: '困難',
  minesBoardNote: '{width}×{height} · {mines} 顆地雷',
  minesConfirmSwitchTitle: '要換掉進行中的盤面嗎？',
  minesConfirmSwitchBody: '進行中的「{current}」會被新的「{next}」盤面取代。',

  // Board
  minesBoardLabel: '雷區，{width} 欄 {height} 列',
  minesCellHidden: '未翻開，第 {row} 列第 {col} 欄',
  minesCellFlagged: '已插旗，第 {row} 列第 {col} 欄',
  minesCellEmpty: '空白，第 {row} 列第 {col} 欄',
  minesCellNumber: '附近有 {count} 顆地雷，第 {row} 列第 {col} 欄',
  minesCellMine: '地雷，第 {row} 列第 {col} 欄',
  minesMinesLeft: '剩餘地雷',
  minesTapToStart: '隨便點一格。第一次點一定安全。',

  // Actions
  minesFlagMode: '插旗模式',
  minesFlagModeNote: '輕點插旗，長按翻開。',
  minesHintFound: '這一格是安全的，標示的數字說明了原因。',
  minesHintNone: '目前還推不出下一步。',
  minesNewBoard: '新盤面',

  // Result
  minesWonTitle: '過關！',
  minesWonBody: '沒有地雷的格子都翻開了。',
  minesLostTitle: '踩到地雷',
  minesLostBody: '這一局到此結束。同樣的盤面隨時等你再來。',
  minesNewBestTime: '你的最快紀錄。',
  minesHintsUsed: '提示',

  // Statistics
  minesGamesWon: '獲勝局數',
  minesWinRate: '勝率',
  minesDailySection: '每日',
  minesDailiesCleared: '過關天數',

  // Quick Rules
  minesStep1Title: '數字代表地雷數',
  minesStep1Body: '它代表周圍八格裡有幾顆地雷。',
  minesStep2Title: '確定的格子插旗',
  minesStep2Body: '長按格子就能插旗。開啟插旗模式後，輕點就能插旗。',
  minesStep3Title: '翻開其餘的就贏了',
  minesStep3Body: '第一次點一定安全，而且任何盤面都不需要猜。',
};
