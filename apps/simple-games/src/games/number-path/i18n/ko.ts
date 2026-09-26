/**
 * Korean catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const ko: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: '보드 선택',
  numberPathDifficulty_easy: '쉬움',
  numberPathDifficulty_medium: '보통',
  numberPathDifficulty_hard: '어려움',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path 보드, {width}×{height}',
  numberPathCellPlain: '{row}행 {col}열',
  numberPathCellNumber: '숫자 {n}, {row}행 {col}열',
  numberPathOnPath: '경로 위, {step}번째',
  numberPathOffPath: '경로 밖',
  numberPathHintNext: '표시된 칸이 다음 한 칸입니다.',
  numberPathHintBack: '경로가 정답에서 벗어났습니다. 표시된 칸까지 되돌아가세요.',
  numberPathHintNone: '지금은 힌트가 없습니다.',
  numberPathHintMarked: '힌트',
  numberPathSolvedTitle: '완성!',
  numberPathSolvedBody: '한 줄로, 모든 칸을, 순서대로.',
  numberPathHintsUsed: '사용한 힌트',
  numberPathNewBestTime: '최고 기록입니다.',
  numberPathNewBoard: '새 보드',
  numberPathSolvedCount: '푼 보드',
  numberPathDailySection: '데일리',
  numberPathDailiesSolved: '푼 날',
  numberPathDailyBacklogHint: '지난 날은 언제든 도전할 수 있습니다.',
  numberPathStep1Title: '숫자를 순서대로',
  numberPathStep1Body: '1에서 한 줄을 그어 숫자를 순서대로 지나갑니다.',
  numberPathStep2Title: '모든 칸을 한 번씩',
  numberPathStep2Body: '선은 모든 칸을 정확히 한 번 지나 마지막 숫자에서 끝납니다.',
  numberPathStep3Title: '벽은 넘을 수 없음',
  numberPathStep3Body:
    '굵은 변은 넘을 수 없는 벽이며, 되돌아가려면 선을 따라 거꾸로 긋거나 선 위의 칸을 누르세요.',
};
