/**
 * Korean catalog for Make the Target — written by AI from the English source
 * on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = 문제, target = 목표 (not 골 or 점수), solution = 풀이, the
 * result of one move = 결과. No particle follows a number placeholder, since
 * 은/는 and 이/가 depend on how the number is read: an expression is read
 * "{left} 나누기 {right} 하면 {result}" (left term first), and the `missed`
 * panel names both numbers with 는 on a fixed noun. Shared words follow the
 * shell and Bridges (쉬움 / 보통 / 어려움, 데일리, 완료한 날).
 */
import type { MakeTheTargetMessages } from './en';

export const ko: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: '난이도 선택',
  makeTheTargetDifficulty_easy: '쉬움',
  makeTheTargetDifficulty_medium: '보통',
  makeTheTargetDifficulty_hard: '어려움',
  makeTheTargetTierNote_easy: '숫자 4개',
  makeTheTargetTierNote_medium: '숫자 4개 또는 5개',
  makeTheTargetTierNote_hard: '숫자 5개',
  makeTheTargetConfirmSwitchTitle: '진행 중인 문제를 바꿀까요?',
  makeTheTargetConfirmSwitchBody: '진행 중인 {current} 문제가 새 {next} 문제로 바뀝니다.',
  makeTheTargetNumbersLabel: '숫자',
  makeTheTargetTargetSpoken: '목표 {target}',
  makeTheTargetTargetLabel: '목표',
  makeTheTargetOperatorsLabel: '연산 기호',
  makeTheTargetOp_add: '더하기',
  makeTheTargetOp_subtract: '빼기',
  makeTheTargetOp_multiply: '곱하기',
  makeTheTargetOp_divide: '나누기',
  makeTheTargetSpokenLine_add: '{left} 더하기 {right} 하면 {result}',
  makeTheTargetSpokenLine_subtract: '{left} 빼기 {right} 하면 {result}',
  makeTheTargetSpokenLine_multiply: '{left} 곱하기 {right} 하면 {result}',
  makeTheTargetSpokenLine_divide: '{left} 나누기 {right} 하면 {result}',
  makeTheTargetSpokenUndo: '되돌린 계산: {line}',
  makeTheTargetStepsLabel: '지금까지의 계산',
  makeTheTargetMissed: '만든 수는 {value}, 목표는 {target}입니다.',
  makeTheTargetSpokenMissed: '{line}. 만든 수는 {value}, 목표는 {target}입니다.',
  makeTheTargetShowSolution: '풀이 하나 보기',
  makeTheTargetRevealTitle: '풀이를 하나 볼까요?',
  makeTheTargetRevealBody: '이 문제는 여기서 끝나며 푼 것으로 세지 않습니다.',
  makeTheTargetRevealConfirm: '보기',
  makeTheTargetSolvedTitle: '목표 숫자를 만들었습니다.',
  makeTheTargetRevealedTitle: '{target}에 이르는 한 가지 방법',
  makeTheTargetSolutionLabel: '풀이 하나',
  makeTheTargetNewBoard: '새 문제',
  makeTheTargetNewBestTime: '지금까지 중 가장 빠릅니다.',
  makeTheTargetSolvedCount: '푼 문제',
  makeTheTargetDailySection: '데일리',
  makeTheTargetDailiesCleared: '완료한 날',
  makeTheTargetAllModes: '모든 모드',
  makeTheTargetStep1Title: '두 수 합치기',
  makeTheTargetStep1Body:
    '숫자, + − × ÷ 중 하나, 다른 숫자 순서로 탭하세요. 먼저 탭한 숫자가 왼쪽에 옵니다.',
  makeTheTargetStep2Title: '새 숫자',
  makeTheTargetStep2Body: '두 수는 사라지고, 그 결과(항상 0보다 큰 정수)가 그 자리에 들어갑니다.',
  makeTheTargetStep3Title: '목표에 맞추기',
  makeTheTargetStep3Body: '숫자를 모두 사용하세요. 마지막 수가 목표와 같으면 문제가 풀립니다.',
};
