import type { CrownGridMessages } from './en';

export const ko: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: '판 선택',
  crownGridDifficulty_easy: '쉬움',
  crownGridDifficulty_medium: '보통',
  crownGridDifficulty_hard: '어려움',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: '진행 중인 판을 바꿀까요?',
  crownGridConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 판으로 교체됩니다.',
  crownGridBoardLabel: 'Crown Grid 판, {size}×{size}',
  crownGridCellEmpty: '빈칸, {row}행 {col}열, 영역 {region}',
  crownGridCellCross: '×, {row}행 {col}열, 영역 {region}',
  crownGridCellCrown: '왕관, {row}행 {col}열, 영역 {region}',
  crownGridRuleBroken: '규칙 위반',
  crownGridHintViolation: '강조된 왕관이 규칙을 어겼습니다.',
  crownGridHintWrong: '표시된 왕관은 맞을 수 없습니다.',
  crownGridHintSingle_row:
    '강조된 행에는 왕관을 놓을 칸이 하나만 남았습니다. 바로 테두리가 있는 칸입니다.',
  crownGridHintSingle_col:
    '강조된 열에는 왕관을 놓을 칸이 하나만 남았습니다. 바로 테두리가 있는 칸입니다.',
  crownGridHintSingle_region:
    '강조된 영역에는 왕관을 놓을 칸이 하나만 남았습니다. 바로 테두리가 있는 칸입니다.',
  crownGridHintConfine_regionRow:
    '강조된 영역의 왕관은 색칠된 칸 중 하나인데, 그 칸들이 모두 한 행에 있습니다 — 그래서 그 행의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintConfine_regionCol:
    '강조된 영역의 왕관은 색칠된 칸 중 하나인데, 그 칸들이 모두 한 열에 있습니다 — 그래서 그 열의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintConfine_rowRegion:
    '강조된 행의 왕관은 색칠된 칸 중 하나인데, 그 칸들이 모두 한 영역에 있습니다 — 그래서 그 영역의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintConfine_colRegion:
    '강조된 열의 왕관은 색칠된 칸 중 하나인데, 그 칸들이 모두 한 영역에 있습니다 — 그래서 그 영역의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintAttack_row:
    '테두리가 있는 칸에 왕관을 놓으면 색칠된 칸이 모두 사라져서, 강조된 행에는 왕관을 놓을 곳이 없어집니다.',
  crownGridHintAttack_col:
    '테두리가 있는 칸에 왕관을 놓으면 색칠된 칸이 모두 사라져서, 강조된 열에는 왕관을 놓을 곳이 없어집니다.',
  crownGridHintAttack_region:
    '테두리가 있는 칸에 왕관을 놓으면 색칠된 칸이 모두 사라져서, 강조된 영역에는 왕관을 놓을 곳이 없어집니다.',
  crownGridHintPair_regionsRows:
    '강조된 두 영역의 왕관은 색칠된 칸 중에 있는데, 그 칸들이 정확히 두 행에 들어맞습니다 — 그래서 그 두 행의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintPair_regionsCols:
    '강조된 두 영역의 왕관은 색칠된 칸 중에 있는데, 그 칸들이 정확히 두 열에 들어맞습니다 — 그래서 그 두 열의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintPair_rowsRegions:
    '강조된 두 행의 왕관은 색칠된 칸 중에 있는데, 그 칸들이 정확히 두 영역에 들어맞습니다 — 그래서 그 두 영역의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintPair_colsRegions:
    '강조된 두 열의 왕관은 색칠된 칸 중에 있는데, 그 칸들이 정확히 두 영역에 들어맞습니다 — 그래서 그 두 영역의 나머지 칸(테두리 표시)은 왕관이 될 수 없습니다.',
  crownGridHintHypothesis_row:
    '테두리가 있는 칸에 왕관을 놓아보면, 그로 인해 정해지는 수들이 강조된 행에 왕관 놓을 곳을 남기지 않습니다. 그래서 그 칸에는 놓을 수 없습니다.',
  crownGridHintHypothesis_col:
    '테두리가 있는 칸에 왕관을 놓아보면, 그로 인해 정해지는 수들이 강조된 열에 왕관 놓을 곳을 남기지 않습니다. 그래서 그 칸에는 놓을 수 없습니다.',
  crownGridHintHypothesis_region:
    '테두리가 있는 칸에 왕관을 놓아보면, 그로 인해 정해지는 수들이 강조된 영역에 왕관 놓을 곳을 남기지 않습니다. 그래서 그 칸에는 놓을 수 없습니다.',
  crownGridHintNone: '지금은 확실한 수가 없습니다.',
  crownGridSolvedTitle: '완성!',
  crownGridSolvedBody: '모든 행, 열, 영역에 왕관이 하나씩 들어갔습니다.',
  crownGridHintsUsed: '사용한 힌트',
  crownGridNewBestTime: '지금까지 중 가장 빠릅니다.',
  crownGridNewBoard: '새 판',
  crownGridDailySection: '데일리',
  crownGridDailiesSolved: '클리어한 날',
  crownGridStep1Title: '왕관은 하나씩',
  crownGridStep1Body: '모든 행, 모든 열, 모든 색에 왕관이 정확히 하나씩 들어갑니다.',
  crownGridStep2Title: '왕관은 맞닿지 않아요',
  crownGridStep2Body: '두 왕관은 나란히 놓일 수 없습니다. 대각선도 안 됩니다.',
  crownGridStep3Title: '탭과 드래그',
  crownGridStep3Body:
    '칸을 탭하면 ×, 왕관, 빈칸 순으로 바뀌고, 드래그하면 ×를 여러 개 놓을 수 있습니다. 막히면 힌트를 요청하세요.',
};
