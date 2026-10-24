/**
 * Korean catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = 힌트) and Box Regions (board = 보드); an edge is a 변, a drawn
 * edge a 선, the loop a 고리.
 */
import type { LoopPuzzleMessages } from './en';

export const ko: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: '보드 선택',
  loopPuzzleDifficulty_easy: '쉬움',
  loopPuzzleDifficulty_medium: '보통',
  loopPuzzleDifficulty_hard: '어려움',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: '진행 중인 보드를 바꿀까요?',
  loopPuzzleConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 보드로 바뀝니다.',
  loopPuzzleBoardLabel: 'Loop Puzzle 보드, 가로 {width} 세로 {height}',
  loopPuzzleEdgeHEmpty: '가로 변, {row}행 {col}열, 비어 있음',
  loopPuzzleEdgeHLine: '가로 변, {row}행 {col}열, 선',
  loopPuzzleEdgeHCross: '가로 변, {row}행 {col}열, × 표시',
  loopPuzzleEdgeVEmpty: '세로 변, {row}행 {col}열, 비어 있음',
  loopPuzzleEdgeVLine: '세로 변, {row}행 {col}열, 선',
  loopPuzzleEdgeVCross: '세로 변, {row}행 {col}열, × 표시',
  loopPuzzleClueOpen: '숫자 {n}, {row}행 {col}열',
  loopPuzzleClueMet: '숫자 {n}, {row}행 {col}열, 충족',
  loopPuzzleClueTooMany: '숫자 {n}, {row}행 {col}열, 선이 너무 많음',
  loopPuzzleClueTooFew: '숫자 {n}, {row}행 {col}열, 더는 충족할 수 없음',
  loopPuzzleNoteHint: '힌트가 표시한 곳',
  loopPuzzleNoteConflict: '규칙 위반',
  loopPuzzleConflictBranch: '선이 세 개 이상 모인 점이 있습니다.',
  loopPuzzleConflictDeadEnd: '더 나아갈 수 없는 점에서 끊긴 선이 있습니다.',
  loopPuzzleConflictLoop: '닫힌 고리 바깥에 다른 선이 남아 있습니다.',
  loopPuzzleConflictTooMany: '숫자보다 선이 많은 칸이 있습니다.',
  loopPuzzleConflictTooFew: '더는 선을 채울 수 없는 숫자가 있습니다.',
  loopPuzzleConflictClosed: '고리는 닫혔지만 맞지 않는 숫자가 있습니다.',
  loopPuzzleHintWrongLine: '표시된 선은 고리에 속하지 않습니다.',
  loopPuzzleHintWrongCross: '표시된 × 자리로 고리가 지나갑니다.',
  loopPuzzleHintCellLine: '동그라미 친 숫자 때문에 표시된 변에 선이 필요합니다.',
  loopPuzzleHintCellCross: '동그라미 친 숫자 때문에 표시된 변에는 선을 그을 수 없습니다.',
  loopPuzzleHintDotLine: '동그라미 친 점에서 고리는 표시된 변을 지나야 합니다.',
  loopPuzzleHintDotCross: '동그라미 친 점에서 표시된 변은 선이 될 수 없습니다.',
  loopPuzzleHintLoopCross: '표시된 변에 선을 그으면 고리가 너무 일찍 닫힙니다.',
  loopPuzzleHintClosedCross: '고리가 닫혔으므로 표시된 변은 고리에 들어가지 않습니다.',
  loopPuzzleHintTrialLine: '표시된 변에 선이 없으면 모순이 생깁니다.',
  loopPuzzleHintTrialCross: '표시된 변에 선을 그으면 모순이 생깁니다.',
  loopPuzzleHintRevealLine: '표시된 변은 고리의 일부입니다.',
  loopPuzzleHintRevealCross: '표시된 변은 고리의 일부가 아닙니다.',
  loopPuzzleHintNone: '지금은 힌트가 없습니다.',
  loopPuzzleSolvedTitle: '해결!',
  loopPuzzleSolvedBody: '하나의 닫힌 고리로 모든 숫자를 충족했습니다.',
  loopPuzzleHintsUsed: '사용한 힌트',
  loopPuzzleNewBestTime: '지금까지 가장 빠릅니다.',
  loopPuzzleNewBoard: '새 보드',
  loopPuzzleSolvedCount: '해결한 퍼즐',
  loopPuzzleDailySection: '데일리',
  loopPuzzleDailiesCleared: '완료한 날',
  loopPuzzleAllBoards: '모든 보드',
  loopPuzzleStep1Title: '하나의 닫힌 고리',
  loopPuzzleStep1Body: '점을 이어 갈라지거나 교차하지 않는 하나의 닫힌 고리를 만드세요.',
  loopPuzzleStep2Title: '숫자 읽기',
  loopPuzzleStep2Body: '숫자는 그 칸의 네 변 중 고리가 지나는 변의 수입니다.',
  loopPuzzleStep3Title: '변을 탭하세요',
  loopPuzzleStep3Body: '변을 탭할 때마다 선 → ×(고리에 없음) → 빈 상태 순서로 바뀝니다.',
};
