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
  termsOfUse: '利用規約',
  resetData: 'ローカルデータを削除',
  resetConfirmTitle: 'すべてのローカルデータを削除しますか？',
  resetConfirmBody: 'この端末のゲーム・統計・設定が削除されます。元に戻せません。',
  delete: '削除',
  version: 'バージョン',

  played: 'プレイ回数',
  cleared: 'クリア回数',
  gameOverCount: 'ゲームオーバー',
  totalTime: '合計プレイ時間',
  bestTime: '最短クリア',

  // Collection shell
  gamesHeading: 'ゲーム',
  recentHeading: '最近遊んだ',
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

  // Store review
  reviewPromptTitle: 'Simple Games を楽しめていますか?',
  reviewYes: 'はい、楽しいです',
  reviewNo: 'いまいち',
  reviewLater: 'あとで',
  reviewFeedbackTitle: '気になる点を教えてください',
  reviewFeedbackBody:
    'メールでご意見をお聞かせください。すべて目を通しています。メールアプリで送信するまで、何も送信されません。',
  reviewFeedbackAction: 'メールを書く',

  // Sudoku
  sudokuName: 'ナンプレ',
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

  // ---- Nonogram ----
  nonoName: 'ノノグラム',

  nonoBoardLabel: 'ノノグラムの盤面、{size}×{size}',
  nonoCellBlank: '未定、{row}行 {col}列',
  nonoCellFilled: '塗り、{row}行 {col}列',
  nonoCellCrossed: '×、{row}行 {col}列',
  nonoRowClueLabel: '{n}行目の手がかり: {clue}',
  nonoColClueLabel: '{n}列目の手がかり: {clue}',
  nonoSizeLabel: '{n}×{n}',

  nonoXMode: '×モード',
  nonoXModeNote: 'タップで×を付け、長押しで塗ります。',
  nonoHintFound: '強調された行・列で、1マスが確定します。',
  nonoHintBroken: '強調された行・列が手がかりと合わなくなっています。',
  nonoHintNone: '今わかる手が見つかりません。',

  nonoSolvedTitle: '完成！',
  nonoSolvedBody: 'すべての手がかりを満たしました。',
  nonoHintsUsed: '使ったヒント',
  nonoNewBestTime: '自己最速です。',

  nonoLevelsSolved: 'クリアしたレベル',
  nonoDailiesSolved: 'クリアしたデイリー',
  nonoDailyBacklogHint: '過去の日はいつでも挑戦できます。',

  nonoStep1Title: '数字は連続して塗る数',
  nonoStep1Body: '数字はその行・列で連続して塗るマスの数。複数あるときは間を1マス以上あけます。',
  nonoStep2Title: '塗らないマスに×',
  nonoStep2Body: '塗らないと分かったマスに×を付けて、置き方を絞り込みます。',
  nonoStep3Title: 'すべての行と列を満たす',
  nonoStep3Body: 'すべての行と列の数字を満たせば完成。推測は要りません。',

  // ---- Minesweeper ----
  minesName: 'マインスイーパ',

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

  // ---- Memory Match ----
  memoryMatchName: 'Memory Match',

  // Home
  memoryChooseBoard: '盤面を選ぶ',
  memoryDifficulty_easy: 'かんたん',
  memoryDifficulty_medium: 'ふつう',
  memoryDifficulty_hard: 'むずかしい',
  memoryBoardNote: '{cols}×{rows}・ペア{pairs}組',
  memoryConfirmSwitchTitle: '進行中のゲームを置き換えますか?',
  memoryConfirmSwitchBody: '「{current}」のゲームは、新しい「{next}」の盤面に置き換わります。',

  // Board
  memoryBoardLabel: '神経衰弱の盤面、{cols}×{rows}',
  memoryCardDown: '裏向き、{row}行{col}列',
  memoryCardUp: '記号{n}、{row}行{col}列',
  memoryCardMatched: 'ペア確定、記号{n}、{row}行{col}列',
  memoryPairsLabel: 'ペア',

  // Result
  memoryClearTitle: '全ペア発見!',
  memoryClearBody: 'すべてのカードが表になりました。',
  memoryNewBestMoves: '自己最少手数です。',
  memoryNewBestTime: '自己最速です。',
  memoryBestMoves: '最少手数',

  // Statistics and daily
  memoryDailiesCleared: '達成日数',
  memoryDailyBacklogHint: '過去の日付はいつでも遊べます。',

  // Quick Rules (3 steps, §11)
  memoryStep1Title: 'カードを2枚めくる',
  memoryStep1Body: '1枚ずつタップします。同じ記号なら表のまま残ります。',
  memoryStep2Title: '覚えるのを急がない',
  memoryStep2Body: '外れた2枚は、次にめくるまで見えたままです。ゆっくりどうぞ。',
  memoryStep3Title: 'すべてのペアを見つける',
  memoryStep3Body: '全部そろえば完成。同じ盤面への再挑戦はいつでも無料です。',

  // ---- Water Sort ----
  waterSortName: 'Water Sort',

  // Board and accessibility
  waterBoardLabel: 'ウォーターソートのチューブ',
  waterTubeLabel: 'チューブ{n}、下から: {colors}',
  waterTubeEmpty: '空',

  // Hint
  waterHintNone: '進める手が見つかりません。戻るかやり直してください。',
  waterHintsUsed: 'ヒント',

  // Clear screen
  waterSolvedTitle: 'そろいました!',
  waterSolvedBody: 'すべての色が自分のチューブに収まりました。',
  waterNewBestMoves: '自己最少手数です。',
  waterNewBestTime: '自己最速です。',
  waterBestMoves: '最少手数',

  // Statistics and daily
  waterLevelsSolved: 'クリア済みレベル',
  waterDailiesSolved: 'デイリー達成',
  waterDailyBacklogHint: '過去の日付はいつでも遊べます。',

  // Quick Rules (3 steps, §11)
  waterStep1Title: '同じ色の上へ注ぐ',
  waterStep1Body: 'チューブを2本続けてタップ。上の色が同じなら注げます。空のチューブへはいつでも。',
  waterStep2Title: '空きの2本が作業場',
  waterStep2Body: '空のチューブを使って並べ替えます。Undo はいつでも無料です。',
  waterStep3Title: '全部を1色ずつに',
  waterStep3Body: 'すべてのチューブが単色になれば完成です。',

  // ---- Solitaire ----
  solitaireName: 'Solitaire',

  // Home
  solNewDeal: '新しい配札',
  solDrawSetting: 'ドロー設定',
  solDrawOne: '1枚めくり',
  solDrawThree: '3枚めくり',
  solDrawNote: '次の配札から適用されます。',

  // Table and accessibility
  solTableLabel: 'ソリティアの台札',
  solStockLabel: '山札、残り{n}枚。タップでめくります',
  solStockEmpty: '山札が空です。タップで捨て札を戻します',
  solCardLabel: '{suit}の{rank}',
  solCardFaceDown: '裏向き',
  solSuit_spades: 'スペード',
  solSuit_hearts: 'ハート',
  solSuit_diamonds: 'ダイヤ',
  solSuit_clubs: 'クラブ',
  solFoundationCard: '組札、{card}',
  solFoundationEmpty: '組札、{suit}、空',
  solPileLabel: '{n}列目',
  solPileEmpty: '{n}列目、空。Kを置けます',

  // Play
  solAutoFinish: '最後まで自動で積む',
  solHintNone: '指せる手が見つかりません。戻すかやり直してください。',
  solHintsUsed: 'ヒント',

  // Result
  solWonTitle: '勝ちました!',
  solWonBody: '4つのスートがすべて完成しました。',
  solNewBestMoves: '自己最少手数です。',
  solNewBestTime: '自己最速です。',
  solBestMoves: '最少手数',

  // Statistics and daily
  solDealsPlayed: '配札数',
  solGamesWon: '勝利数',
  solWinRate: '勝率',
  solDailiesWon: 'デイリー勝利',
  solDailyBacklogHint: '過去の日付はいつでも遊べます。勝てない配札もあります。',

  // Quick Rules (3 steps, §11)
  solStep1Title: 'ひとつ下・色は交互',
  solStep1Body: '赤と黒を交互に、数字を下げながら重ねます。タップで選び、タップで置きます。',
  solStep2Title: '裏の札をめくり出す',
  solStep2Body: '裏の札がめくれる手でゲームが開けます。山札は何度でも引き直せます。',
  solStep3Title: 'AからKへ積み上げる',
  solStep3Body: '各スートをAからKまで組札へ。4つ揃えば勝ちです。',

  // ---- Arcade (shared by Brick Breaker and Sky Fighter) ----
  livesLeft: 'ライフ: {n}',
  levelsCleared: 'クリアしたレベル',
  bestScore: 'ベストスコア',

  // ---- Brick Breaker ----
  brickBreakerName: 'Brick Breaker',
  bbBoardLabel: 'ブロック崩しの盤面',
  bbBricksLeft: '残り {n}',
  bbClearedTitle: '全部崩した！',
  bbClearedBody: 'ブロックはすべて落ちました。',
  bbFailedTitle: '今回は届かず',
  bbFailedBody: 'リトライは無料。同じ壁、同じ配置です。',
  bbStep1Title: 'パドルで狙う',
  bbStep1Body: 'パドルの真ん中で受けると真上へ、端で受けるほど斜めに飛びます。',
  bbStep2Title: '枠だけのブロックは球入り',
  bbStep2Body: '壊すと球が1個増えます。ライフが減るのは最後の球を落としたときだけ。',
  bbStep3Title: '壁は少しずつ下がる',
  bbStep3Body: '壁が点線に届く前に、すべてのブロックを崩しましょう。',

  // ---- Sky Fighter ----
  skyFighterName: 'Sky Fighter',
  sfBoardLabel: 'Sky Fighter の空域',
  sfWave: 'ウェーブ {n} / {m}',
  sfClearedTitle: '空域クリア！',
  sfClearedBody: 'すべての編隊を落としました。',
  sfFailedTitle: '撃墜された',
  sfFailedBody: 'リトライは無料。同じ空、同じ編隊です。',
  sfNewBestScore: '自己ベスト更新！',
  sfStep1Title: '動かして狙う',
  sfStep1Body: '射撃は自動です。左右に動かせば、飛んだ場所がそのまま狙いになります。',
  sfStep2Title: '大きい機体は分裂する',
  sfStep2Body: '爆撃機は戦闘機に、戦闘機は小型機に分かれます。撃ってくるのは爆撃機だけ。',
  sfStep3Title: '小さな機体を受け取る',
  sfStep3Body:
    '小型機を落とすと、たまに小さな機体が降ってきます。受け取ると砲門+1、被弾で1つ戻ります。',
};
