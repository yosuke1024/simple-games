import type { Messages } from './en';

export const ja: Messages = {
  numberMatchName: 'Number Match',
  tagline: 'オフラインで遊べる。アカウント不要。機能課金なし。',

  resume: '続きから',
  dailyChallenge: 'デイリーチャレンジ',
  dailyDoneBadge: '今日はクリア済み',
  howToPlay: '遊び方',
  statistics: '統計',
  settings: '設定',

  modeLevel: 'レベル {n}',
  levelSelect: 'レベル選択',
  levelLocked: 'レベル {n}(未解放)',
  nextLevel: '次のレベルへ',
  levelsTitle: 'レベル',
  reachedLevel: '到達レベル',

  score: 'スコア',
  best: 'ベスト',
  newBest: '自己ベスト更新!',
  scoreMatches: 'マッチ',
  scoreRows: '行ボーナス',
  scoreClearBonus: 'クリアボーナス',
  scoreNoHint: 'ノーヒントボーナス',
  bestScores: 'ベストスコア',
  totalBest: 'レベルベスト合計',

  dailyPast: '過去のデイリー',
  dailyToday: '今日',
  dailyBacklogHint: 'クリアすると、その前の日に挑戦できます。',
  modeDaily: 'デイリー',
  undo: '戻す',
  hint: 'ヒント',
  addNumbers: '追加',
  timeLabel: '時間',
  movesLabel: '手数',
  boardLabel: 'ゲーム盤',
  cellLabel: '{row}行 {col}列、{value}',
  cellLabelStone: '{row}行 {col}列、石',
  cellLabelWild: '{row}行 {col}列、ワイルド',
  hintNoneToast: '消せるペアがありません。「追加」を試してください。',
  wildIntroToast: '✦ はどの数字とでもペアになります。',
  stoneIntroToast: '石は消せません。道をふさぎます。',

  clearTitle: 'クリア！',
  clearBody: 'すべての数字を消しました。',
  gameOverTitle: '手詰まり',
  gameOverBody: '盤面が上限に達しました。',
  tryAgain: '同じ盤面で再挑戦',
  backHome: 'ホームへ',

  confirmNewGameTitle: '新しいゲームを始めますか？',
  confirmNewGameBody: '進行中のゲームは失われます。',
  cancel: 'キャンセル',
  confirm: 'はじめる',

  step1Title: '同じ数字か、合計10',
  step1Body: '同じ数字、または合計が10になる2つの数字を消せます。',
  step2Title: 'つながる2つを選ぶ',
  step2Body:
    '横・縦・斜め、そして行末から次の行頭へ。間が消えていれば離れていてもつながりますが、数字が1つでも残っていると通れません。',
  step3Title: '全部消せばクリア',
  step3Body: '詰まったら「追加」で残りの数字を足せます。ヒントも戻すも、ずっと無料です。',
  startPlaying: 'さっそく遊ぶ',
  next: '次へ',
  back: '戻る',
  close: '閉じる',

  language: '言語',
  languageSystem: '端末の設定に従う',
  theme: 'テーマ',
  themeSystem: 'システム',
  themeLight: 'ライト',
  themeDark: 'ダーク',
  sound: '効果音',
  vibration: '振動',
  reducedMotion: 'アニメーションを減らす',
  privacyPolicy: 'プライバシーポリシー',
  resetData: 'ローカルデータを削除',
  resetConfirmTitle: 'すべてのローカルデータを削除しますか？',
  resetConfirmBody: 'この端末のゲーム・統計・設定が削除されます。元に戻せません。',
  delete: '削除',
  version: 'バージョン',

  privacy1: 'アカウント登録は不要です。氏名・メールアドレス・連絡先・位置情報を収集しません。',
  privacy2:
    'ゲームの進行・統計・設定はこの端末内にのみ保存されます。運営サーバーはなく、クラウド同期もありません。',
  privacy3:
    'オンライン時は Google AdMob による広告が表示されることがあり、Google がそのプライバシーポリシーに従って端末の広告識別子を処理する場合があります。オフライン時は広告は表示されず、広告リクエストも行われません。',
  privacy4: 'アプリの削除、または「ローカルデータを削除」で、データは端末から削除されます。',

  played: 'プレイ回数',
  cleared: 'クリア回数',
  gameOverCount: 'ゲームオーバー',
  totalTime: '合計プレイ時間',
  bestTime: '最短クリア',

  // Collection shell
  collectionTagline: '完全無課金。完全オフライン。すぐ遊べる。',
  gamesHeading: 'ゲーム',
  numberMatchBlurb: '同じ数字か、合計10のペアを消していく。',
  backToGames: 'ゲーム一覧へ',
  learnMore: '詳しく見る',

  // About & open source
  aboutTitle: 'このアプリについて',
  viewSource: 'ソースコードを見る',
  reportBug: '不具合を報告',
  suggestGame: 'ゲームをリクエスト',
  viewLicenses: 'ライセンスを見る',

  // Ads & support
  removeAdsTitle: '広告を削除して Simple Games を支援',
  adSupportBody:
    'Simple Games では、アプリの維持と改善のため、オンライン時のみ小さなバナー広告を表示しています。広告を表示したくない場合は、一度だけの購入で永久に削除できます。',
  removeAdsAction: '広告を削除',
  restorePurchase: '購入を復元',
  purchaseThanks: 'バナー広告は削除されています。Simple Games を支援いただきありがとうございます。',
  privacy5:
    '任意の買い切り購入でバナー広告を削除できます。決済は Google Play が処理し、PixApps が支払い情報を受け取ること・保存することはありません。',

  // Sudoku
  sudokuName: 'ナンプレ',
  sudokuBlurb: '各行・各列・各ブロックに1〜9を1つずつ。',
  sudokuGridLabel: 'ナンプレの盤面',
  sudokuPadLabel: '数字パッド',
  sudokuPadKey: '{value}、残り {n}',
  sudokuPadNoteKey: 'メモ {value}',
  sudokuCellEmpty: '空、{row}行 {col}列',
  sudokuCellGiven: '{value}、初期数字、{row}行 {col}列',
  sudokuCellEntry: '{value}、{row}行 {col}列',
  sudokuErase: '消す',
  sudokuNotes: 'メモ',
  sudokuMistakes: 'ミス',
  sudokuTier_easy: 'かんたん',
  sudokuTier_medium: 'ふつう',
  sudokuTier_hard: 'むずかしい',
  sudokuSolvedTitle: 'クリア！',
  sudokuSolvedBody: 'すべての行・列・ブロックに1〜9が入りました。',
  sudokuNewBestTime: '自己最速です。',
  sudokuLevelsSolved: 'クリアしたレベル',
  sudokuDailiesSolved: 'クリアしたデイリー',
  sudokuAverageTime: '平均クリア時間',
  sudokuHighlightMistakes: 'ミスを表示',
  sudokuHighlightMistakesNote: '正解と違う数字に印を付けます。重複は常に表示されます。',
  sudokuHintNone: '今わかる手が見つかりません。',
  sudokuHintOnlyDigit: 'このマスに入る数字は1つだけです。',
  sudokuHintOnlyCell: 'ここで {value} が入るのはこのマスだけです。',
  sudokuHintLockedLine: 'このブロックの {value} は、光っている列か行にしか入りません。',
  sudokuHintLockedBox: 'この行(列)の {value} は、光っているブロックにしか入りません。',
  sudokuHintRuledOut: 'このマスの組み合わせで、同じ列・行・ブロックの候補を消せます。',
  sudokuStep1Title: '1〜9を1つずつ',
  sudokuStep1Body: '各行・各列・各3×3ブロックに1〜9がちょうど1つずつ入ります。',
  sudokuStep2Title: '候補はメモに残す',
  sudokuStep2Body: '「メモ」を押すと、候補の数字を小さく書き込めます。',
  sudokuStep3Title: '詰まったらヒント',
  sudokuStep3Body: 'ヒントは「どこが決まるか」と理由を教えます。ヒントも戻すも、ずっと無料です。',

  // ---- Sliding Puzzle ----
  slideName: 'スライドパズル',
  slideBlurb: '数字を順番どおりに並べ直す。',

  slideBoardLabel: 'スライドパズルの盤面',
  slideTileLabel: '{value}、{row}行 {col}列',
  slideBlankLabel: '空、{row}行 {col}列',
  slideSizeLabel: '{n}×{n}',

  slideMoves: '手数',
  slideBestMoves: '最少手数',

  slideSolvedTitle: 'クリア！',
  slideSolvedBody: '数字が1から順に並びました。',
  slideNewBestMoves: '自己最少手数です。',
  slideNewBestTime: '自己最速です。',

  slideLevelsSolved: 'クリアしたレベル',
  slideDailiesSolved: 'クリアしたデイリー',
  slideDailyBacklogHint: '過去の日はいつでも挑戦できます。',

  slideStep1Title: '空きの隣をタップ',
  slideStep1Body: '空きマスの隣のタイルをタップすると、そこへ滑ります。',
  slideStep2Title: 'まとめて動かせる',
  slideStep2Body: '同じ行・列なら、間にあるタイルがまとめて動きます。',
  slideStep3Title: '1から順に並べる',
  slideStep3Body: '1から順に並び、空きが右下に来れば完成です。',

  // ---- 2048 ----
  g2048Name: '2048',
  g2048Blurb: '同じ数字を寄せて合わせ、2048を作る。',

  g2048ModeClassic: 'クラシック',
  g2048DailyPlayedBadge: '今日はプレイ済み',

  g2048BoardLabel: '2048の盤面',
  g2048CellLabel: '{value}、{row}行{col}列',
  g2048CellEmpty: '空き、{row}行{col}列',
  g2048Restart: '最初から',

  g2048OverBody: '盤面が埋まり、合わせられるタイルがありません。',
  g2048WinTitle: '2048を作りました！',
  g2048WinBody: 'ここで終わりではありません。好きなだけ続けられます。',
  g2048KeepPlaying: '続ける',

  g2048BestScore: 'ベストスコア',
  g2048BestTile: '最高タイル',
  g2048Wins: '2048達成回数',
  g2048DaysPlayed: 'プレイした日数',

  g2048Step1Title: 'スワイプで動かす',
  g2048Step1Body: 'スワイプすると、すべてのタイルがその方向へ動きます。',
  g2048Step2Title: '同じ数字は合わさる',
  g2048Step2Body: '同じ数字がぶつかると、2倍の数字1つになります。',
  g2048Step3Title: '2048を作る',
  g2048Step3Body: '詰まっても大丈夫。戻すのはいつでも無料・無制限です。',

  // ---- Minesweeper ----
  minesName: 'マインスイーパ',
  minesBlurb: '地雷のないマスをすべて開けよう。',

  // Home
  minesChooseBoard: '盤面を選ぶ',
  minesDifficulty_easy: 'かんたん',
  minesDifficulty_medium: 'ふつう',
  minesDifficulty_hard: 'むずかしい',
  minesBoardNote: '{width}×{height}・地雷 {mines}',
  minesConfirmSwitchTitle: '中断中の盤面を置き換えますか？',
  minesConfirmSwitchBody: '中断中の「{current}」は、新しい「{next}」の盤面に置き換わります。',

  // Board
  minesBoardLabel: '地雷原、横 {width} マス、縦 {height} マス',
  minesCellHidden: '未開、{row}行 {col}列',
  minesCellFlagged: '旗、{row}行 {col}列',
  minesCellEmpty: '空、{row}行 {col}列',
  minesCellNumber: '隣接する地雷 {count}、{row}行 {col}列',
  minesCellMine: '地雷、{row}行 {col}列',
  minesMinesLeft: '残りの地雷',
  minesTapToStart: 'どこでもタップしてください。最初の一手は必ず安全です。',

  // Actions
  minesFlagMode: '旗モード',
  minesFlagModeNote: 'タップで旗を立て、長押しで開きます。',
  minesHintFound: 'このマスは安全です。光っている数字がその理由です。',
  minesHintNone: '今わかる手が見つかりません。',
  minesNewBoard: '新しい盤面',

  // Result
  minesWonTitle: 'クリア！',
  minesWonBody: '地雷のないマスをすべて開けました。',
  minesLostTitle: '地雷を開きました',
  minesLostBody: 'この局はここで終わりです。同じ盤面にいつでも挑戦できます。',
  minesNewBestTime: '自己最速です。',
  minesHintsUsed: 'ヒント',

  // Statistics
  minesGamesWon: '勝利数',
  minesWinRate: '勝率',
  minesDailySection: 'デイリー',
  minesDailiesCleared: '達成日数',

  // Quick Rules
  minesStep1Title: '数字は地雷の数',
  minesStep1Body: '隣り合う8マスに地雷がいくつあるかを表します。',
  minesStep2Title: '確信したマスに旗を',
  minesStep2Body: '長押しで旗を立てます。旗モードならタップで立てられます。',
  minesStep3Title: '残りを開けば勝ち',
  minesStep3Body: '最初の一手は必ず安全で、推測が必要な盤面は出題されません。',
};
