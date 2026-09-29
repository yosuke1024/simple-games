/**
 * ko catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same.
 */
import type { BinaryBalanceMessages } from './en';

export const ko: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: '판 선택',
  binaryBalanceDifficulty_easy: '쉬움',
  binaryBalanceDifficulty_medium: '보통',
  binaryBalanceDifficulty_hard: '어려움',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: '진행 중인 판을 바꿀까요?',
  binaryBalanceConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 판으로 교체됩니다.',
  binaryBalanceBoardLabel: 'Binary Balance 판, {size}×{size}',
  binaryBalanceCellEmpty: '빈칸, {row}행 {col}열',
  binaryBalanceCellCircle: '동그라미, {row}행 {col}열',
  binaryBalanceCellSquare: '네모, {row}행 {col}열',
  binaryBalanceCellFixedCircle: '고정 동그라미, {row}행 {col}열',
  binaryBalanceCellFixedSquare: '고정 네모, {row}행 {col}열',
  binaryBalanceLinkSameRight: '오른쪽 칸과 같음',
  binaryBalanceLinkDiffRight: '오른쪽 칸과 다름',
  binaryBalanceLinkSameBelow: '아래 칸과 같음',
  binaryBalanceLinkDiffBelow: '아래 칸과 다름',
  binaryBalanceRuleBroken: '규칙 위반',
  binaryBalanceMarkCircle: '동그라미',
  binaryBalanceMarkSquare: '네모',
  binaryBalanceHintViolation: '강조된 칸이 규칙을 어겼습니다.',
  binaryBalanceHintWrong: '테두리가 있는 표시는 정답일 수 없습니다.',
  binaryBalanceHintPairGap:
    '색이 칠해진 두 칸 때문에 세 칸 연속이 되므로, 테두리 칸은 {mark}입니다.',
  binaryBalanceHintLineCount:
    '강조된 줄에 색이 칠해진 표시가 이미 절반 들어 있으므로, 테두리 칸은 {mark}입니다.',
  binaryBalanceHintLinkSame:
    '= 가 테두리 칸과 색이 칠해진 칸을 잇고 있으므로, 이 칸도 {mark}입니다.',
  binaryBalanceHintLinkDiff:
    '× 가 테두리 칸과 색이 칠해진 칸을 잇고 있으므로, 이 칸은 다른 표시인 {mark}입니다.',
  binaryBalanceHintLineCompletion:
    '강조된 줄을 완성하는 모든 방법에서 테두리 칸에는 {mark}가 들어갑니다.',
  binaryBalanceHintHypothesis:
    '테두리 칸이 {other}라면 이어지는 수가 규칙을 어기게 되므로, 이 칸은 {mark}입니다.',
  binaryBalanceHintNone: '지금은 확실한 수가 없습니다.',
  binaryBalanceSolvedTitle: '완성!',
  binaryBalanceSolvedBody: '모든 줄이 균형을 이루고, 모든 연결이 맞습니다.',
  binaryBalanceHintsUsed: '사용한 힌트',
  binaryBalanceNewBestTime: '자기 최고 기록입니다.',
  binaryBalanceNewBoard: '새 판',
  binaryBalanceDailySection: '데일리',
  binaryBalanceDailiesSolved: '클리어한 날',
  binaryBalanceDailyBacklogHint: '지난 날짜는 언제든 도전할 수 있습니다.',
  binaryBalanceStep1Title: '세 칸 연속 금지',
  binaryBalanceStep1Body:
    '탭하면 빈칸, 동그라미, 네모로 바뀝니다. 같은 표시는 세 칸 연속될 수 없습니다.',
  binaryBalanceStep2Title: '반반씩',
  binaryBalanceStep2Body: '모든 행과 모든 열에 동그라미와 네모가 같은 개수로 들어갑니다.',
  binaryBalanceStep3Title: '연결을 따라가기',
  binaryBalanceStep3Body:
    '=로 이어진 칸은 같고, ×로 이어진 칸은 다릅니다. 막혔나요? 힌트를 요청하세요.',
};
