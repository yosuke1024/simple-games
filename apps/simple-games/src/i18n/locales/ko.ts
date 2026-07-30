import type { Messages } from './en';

export const ko: Messages = {
  numberMatchName: '숫자 매치',
  tagline: '오프라인에서 실행. 계정 불필요. 유료 잠금 없음.',

  resume: '이어하기',
  dailyChallenge: '데일리 챌린지',
  dailyDoneBadge: '오늘 완료',
  howToPlay: '게임 방법',
  statistics: '통계',
  settings: '설정',

  modeLevel: '레벨 {n}',
  levelSelect: '레벨 선택',
  levelLocked: '레벨 {n}, 잠김',
  nextLevel: '다음 레벨',
  levelsTitle: '레벨',
  reachedLevel: '도달 레벨',

  score: '점수',
  best: '최고',
  newBest: '최고 기록!',
  scoreMatches: '매치',
  scoreRows: '줄 보너스',
  scoreClearBonus: '클리어 보너스',
  scoreNoHint: '노힌트 보너스',
  bestScores: '최고 점수',
  totalBest: '레벨 최고 점수 합계',

  dailyPast: '지난 데일리',
  dailyToday: '오늘',
  dailyBacklogHint: '하루를 클리어하면 그 전날이 열립니다.',
  modeDaily: '데일리',
  undo: '되돌리기',
  hint: '힌트',
  addNumbers: '추가',
  timeLabel: '시간',
  movesLabel: '이동 수',
  boardLabel: '게임판',
  cellLabel: '{row}행 {col}열, {value}',
  cellLabelStone: '{row}행 {col}열, 돌',
  cellLabelWild: '{row}행 {col}열, 와일드',
  hintNoneToast: '맞출 짝이 없습니다. 추가를 눌러 보세요.',
  wildIntroToast: '✦ 타일은 어떤 숫자와도 짝이 됩니다.',
  stoneIntroToast: '돌은 없앨 수 없고 길을 막습니다.',

  clearTitle: '클리어!',
  clearBody: '숫자를 모두 없앴습니다.',
  gameOverTitle: '더는 움직일 수 없음',
  gameOverBody: '판이 한계에 도달했습니다.',
  tryAgain: '같은 판 다시 하기',
  backHome: '홈',

  confirmNewGameTitle: '새 게임을 시작할까요?',
  confirmNewGameBody: '진행 중인 게임이 사라집니다.',
  cancel: '취소',
  confirm: '시작',

  step1Title: '같은 수, 또는 합이 10',
  step1Body: '같은 숫자 두 개, 또는 합이 10이 되는 두 숫자를 없앱니다.',
  step2Title: '이어지는 두 개를 고르세요',
  step2Body:
    '가로, 세로, 대각선, 그리고 한 줄의 끝에서 다음 줄의 처음으로도 이어집니다. 이미 지운 칸은 방해가 되지 않지만, 아직 남아 있는 숫자는 길을 막습니다.',
  step3Title: '판을 모두 지우면 승리',
  step3Body:
    '막혔나요? 추가를 누르면 남은 숫자가 이어 붙습니다. 되돌리기와 힌트는 언제나 무료입니다.',
  startPlaying: '게임 시작',
  next: '다음',
  back: '이전',
  close: '닫기',

  language: '언어',
  languageSystem: '시스템 설정',
  theme: '테마',
  themeSystem: '시스템 설정',
  themeLight: '밝게',
  themeDark: '어둡게',
  sound: '소리',
  vibration: '진동',
  reducedMotion: '동작 줄이기',
  privacyPolicy: '개인정보 처리방침',
  resetData: '로컬 데이터 삭제',
  resetConfirmTitle: '모든 로컬 데이터를 삭제할까요?',
  resetConfirmBody: '이 기기에서 게임, 통계, 설정이 삭제됩니다. 되돌릴 수 없습니다.',
  delete: '삭제',
  version: '버전',

  privacy1: '계정도 가입도 없습니다. 이름, 이메일, 연락처, 위치를 수집하지 않습니다.',
  privacy2:
    '게임 진행, 통계, 설정은 이 기기에만 저장됩니다. 저희는 서버를 운영하지 않으며 클라우드 동기화도 없습니다.',
  privacy3:
    '온라인일 때 Google AdMob이 게재하는 광고가 표시될 수 있으며, Google은 자체 개인정보처리방침에 따라 기기 광고 식별자를 처리할 수 있습니다. 오프라인에서는 광고가 표시되지 않고 광고 요청도 보내지 않습니다.',
  privacy4: '앱을 삭제하거나 ‘로컬 데이터 삭제’를 사용하면 데이터가 지워집니다.',

  played: '플레이한 게임',
  cleared: '클리어한 게임',
  gameOverCount: '게임 오버',
  totalTime: '총 플레이 시간',
  bestTime: '최단 클리어',

  // Collection shell
  collectionTagline: '완전 무료. 완전 오프라인. 바로 플레이.',
  gamesHeading: '게임',
  numberMatchBlurb: '같은 숫자나 합이 10인 숫자를 짝지어 없애세요.',
  backToGames: '전체 게임',
  learnMore: '자세히 보기',

  // About & open source
  aboutTitle: '앱 정보',
  viewSource: '소스 코드 보기',
  reportBug: '버그 신고',
  suggestGame: '게임 제안하기',
  viewLicenses: '라이선스 보기',

  // Ads & support
  removeAdsTitle: '광고 제거하고 Simple Games 후원하기',
  adSupportBody:
    'Simple Games는 온라인일 때 작은 배너 광고 하나로 운영됩니다. 광고는 앱을 유지하고 개선하는 데 쓰입니다. 광고 없이 쓰고 싶다면, 한 번만 구매하면 영구히 제거됩니다.',
  removeAdsAction: '광고 제거',
  restorePurchase: '구매 복원',
  purchaseThanks: '배너 광고가 제거되었습니다. Simple Games를 후원해 주셔서 감사합니다.',
  privacy5:
    '선택 사항인 일회성 구매로 배너 광고를 제거할 수 있습니다. 결제는 Google Play가 처리하며, 저희는 결제 정보를 받지도 저장하지도 않습니다.',

  // Sudoku
  sudokuName: '스도쿠',
  sudokuBlurb: '가로줄, 세로줄, 블록마다 1-9를 채우세요.',
  sudokuGridLabel: '스도쿠 판',
  sudokuPadLabel: '숫자 키패드',
  sudokuPadKey: '{value}, {n}개 남음',
  sudokuPadNoteKey: '메모 {value}',
  sudokuCellEmpty: '빈칸, {row}행 {col}열',
  sudokuCellGiven: '{value}, 고정, {row}행 {col}열',
  sudokuCellEntry: '{value}, {row}행 {col}열',
  sudokuErase: '지우기',
  sudokuNotes: '메모',
  sudokuMistakes: '실수',
  sudokuTier_easy: '쉬움',
  sudokuTier_medium: '보통',
  sudokuTier_hard: '어려움',
  sudokuSolvedTitle: '완성!',
  sudokuSolvedBody: '모든 가로줄, 세로줄, 블록에 1-9가 들어갔습니다.',
  sudokuNewBestTime: '지금까지 중 가장 빠릅니다.',
  sudokuLevelsSolved: '완성한 레벨',
  sudokuDailiesSolved: '완성한 데일리',
  sudokuAverageTime: '평균 완성 시간',
  sudokuHighlightMistakes: '실수 표시',
  sudokuHighlightMistakesNote: '정답과 다른 숫자를 표시합니다. 중복은 항상 표시됩니다.',
  sudokuHintNone: '아직 확정할 수 있는 칸이 없습니다.',
  sudokuHintOnlyDigit: '이 칸에 들어갈 숫자는 하나뿐입니다.',
  sudokuHintOnlyCell: '여기서 {value}가 들어갈 곳은 이 칸뿐입니다.',
  sudokuHintLockedLine: '이 블록에서 {value}는 표시된 줄에만 들어갈 수 있습니다.',
  sudokuHintLockedBox: '이 줄에서 {value}는 표시된 블록 안에만 들어갈 수 있습니다.',
  sudokuHintRuledOut: '이 칸들 덕분에 같은 영역의 다른 칸에서 그 숫자를 지울 수 있습니다.',
  sudokuStep1Title: '1-9를 한 번씩',
  sudokuStep1Body: '가로줄, 세로줄, 3x3 블록마다 1부터 9까지 한 번씩 들어갑니다.',
  sudokuStep2Title: '들어갈 수를 메모하세요',
  sudokuStep2Body: '메모를 누르면 후보 숫자를 작게 적어 둘 수 있습니다.',
  sudokuStep3Title: '막히면 힌트',
  sudokuStep3Body:
    '힌트는 어느 칸이 확정되는지와 그 이유를 알려 줍니다. 힌트와 되돌리기는 언제나 무료입니다.',

  // ---- Sliding Puzzle ----
  slideName: '슬라이드 퍼즐',
  slideBlurb: '숫자를 밀어 순서대로 되돌리세요.',

  slideBoardLabel: '슬라이드 퍼즐 판',
  slideTileLabel: '{value}, {row}행 {col}열',
  slideBlankLabel: '빈칸, {row}행 {col}열',
  slideSizeLabel: '{n}×{n}',

  slideMoves: '이동 수',
  slideBestMoves: '최소 이동 수',

  slideSolvedTitle: '완성!',
  slideSolvedBody: '모든 숫자가 제자리로 돌아왔습니다.',
  slideNewBestMoves: '지금까지 중 가장 적은 이동입니다.',
  slideNewBestTime: '지금까지 중 가장 빠릅니다.',

  slideLevelsSolved: '완성한 레벨',
  slideDailiesSolved: '완성한 데일리',
  slideDailyBacklogHint: '지난 날짜는 언제나 열려 있습니다.',

  slideStep1Title: '빈칸 옆을 누르세요',
  slideStep1Body: '빈칸 옆의 타일을 누르면 그 자리로 밀려 들어갑니다.',
  slideStep2Title: '한 줄이 함께 움직여요',
  slideStep2Body: '같은 줄에 있으면 사이의 타일이 모두 함께 밀립니다.',
  slideStep3Title: '1부터 순서대로',
  slideStep3Body: '읽는 순서대로 숫자를 맞추고 빈칸을 오른쪽 아래에 두세요.',

  // ---- 2048 ----
  g2048Name: '2048',
  g2048Blurb: '같은 숫자를 붙여 두 배로 키워 2048을 만드세요.',

  g2048ModeClassic: '클래식',
  g2048DailyPlayedBadge: '오늘 플레이함',

  g2048BoardLabel: '2048 판',
  g2048CellLabel: '{value}, {row}행 {col}열',
  g2048CellEmpty: '빈칸, {row}행 {col}열',
  g2048Restart: '처음부터',

  g2048OverBody: '판이 가득 찼고 합칠 수 있는 타일이 없습니다.',
  g2048WinTitle: '2048을 만들었어요!',
  g2048WinBody: '여기서 끝이 아닙니다. 원하는 만큼 계속하세요.',
  g2048KeepPlaying: '계속하기',

  g2048BestScore: '최고 점수',
  g2048BestTile: '최고 타일',
  g2048Wins: '2048 달성 횟수',
  g2048DaysPlayed: '플레이한 날',

  g2048Step1Title: '밀어서 이동',
  g2048Step1Body: '한 번 밀면 모든 타일이 그 방향으로 움직입니다.',
  g2048Step2Title: '같은 숫자는 합쳐져요',
  g2048Step2Body: '같은 숫자 두 개가 만나면 두 배가 된 하나로 합쳐집니다.',
  g2048Step3Title: '2048 만들기',
  g2048Step3Body: '막혔나요? 되돌리기는 무료이고 횟수 제한도 없습니다.',

  // ---- Minesweeper ----
  minesName: '지뢰 찾기',
  minesBlurb: '지뢰가 없는 칸을 모두 여세요.',

  // Home
  minesChooseBoard: '판 선택',
  minesDifficulty_easy: '쉬움',
  minesDifficulty_medium: '보통',
  minesDifficulty_hard: '어려움',
  minesBoardNote: '{width}×{height} · 지뢰 {mines}개',
  minesConfirmSwitchTitle: '진행 중인 판을 바꿀까요?',
  minesConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 판으로 바뀝니다.',

  // Board
  minesBoardLabel: '지뢰밭, 가로 {width}칸 세로 {height}칸',
  minesCellHidden: '닫힘, {row}행 {col}열',
  minesCellFlagged: '깃발, {row}행 {col}열',
  minesCellEmpty: '빈칸, {row}행 {col}열',
  minesCellNumber: '주변 지뢰 {count}개, {row}행 {col}열',
  minesCellMine: '지뢰, {row}행 {col}열',
  minesMinesLeft: '남은 지뢰',
  minesTapToStart: '아무 칸이나 누르세요. 첫 탭은 언제나 안전합니다.',

  // Actions
  minesFlagMode: '깃발 모드',
  minesFlagModeNote: '탭하면 깃발을 꽂고, 길게 누르면 엽니다.',
  minesHintFound: '이 칸은 안전합니다. 표시된 숫자가 그 이유입니다.',
  minesHintNone: '아직 확정할 수 있는 칸이 없습니다.',
  minesNewBoard: '새 판',

  // Result
  minesWonTitle: '클리어!',
  minesWonBody: '지뢰가 없는 칸을 모두 열었습니다.',
  minesLostTitle: '지뢰를 열었습니다',
  minesLostBody: '이 게임은 여기서 끝입니다. 같은 판은 언제든 다시 시작할 수 있습니다.',
  minesNewBestTime: '지금까지 중 가장 빠릅니다.',
  minesHintsUsed: '힌트',

  // Statistics
  minesGamesWon: '이긴 게임',
  minesWinRate: '승률',
  minesDailySection: '데일리',
  minesDailiesCleared: '클리어한 날',

  // Quick Rules
  minesStep1Title: '숫자는 지뢰 개수',
  minesStep1Body: '주변 여덟 칸에 지뢰가 몇 개 있는지 알려 줍니다.',
  minesStep2Title: '확실한 칸에 깃발을',
  minesStep2Body: '칸을 길게 누르면 깃발이 꽂힙니다. 깃발 모드에서는 그냥 탭해도 됩니다.',
  minesStep3Title: '나머지를 열면 승리',
  minesStep3Body: '첫 탭은 언제나 안전하고, 어떤 판도 찍을 필요가 없습니다.',
};
