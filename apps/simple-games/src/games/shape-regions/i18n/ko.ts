/**
 * Korean catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const ko: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: '보드 선택',
  shapeRegionsDifficulty_easy: '쉬움',
  shapeRegionsDifficulty_medium: '보통',
  shapeRegionsDifficulty_hard: '어려움',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: '진행 중인 보드를 바꿀까요?',
  shapeRegionsConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 보드로 바뀝니다.',
  shapeRegionsBoardLabel: 'Shape Regions 보드, {width}×{height}',
  shapeRegionsCellAssigned: '{row}행 {col}열, 모양 {region}',
  shapeRegionsCellEmpty: '{row}행 {col}열, 미지정',
  shapeRegionsClueCount: '{size}칸 중 {count}칸',
  shapeRegionsRuleBroken: '규칙 위반',
  shapeRegionsShape_line: '직선',
  shapeRegionsShape_block: '직사각형',
  shapeRegionsShape_corner: 'ㄱ자',
  shapeRegionsShape_tee: 'T자',
  shapeRegionsShape_step: '계단',
  shapeRegionsHintWrong: '강조된 모양이 정답과 다릅니다.',
  shapeRegionsHintForced: '표시된 칸은 강조된 모양에만 들어갈 수 있습니다.',
  shapeRegionsHintSole: '강조된 모양을 놓는 방법은 하나뿐입니다.',
  shapeRegionsHintCommon: '강조된 모양을 어떻게 놓든 표시된 칸이 포함됩니다.',
  shapeRegionsHintNone: '지금은 확실한 수를 찾지 못했습니다.',
  shapeRegionsSolvedTitle: '완성!',
  shapeRegionsSolvedBody: '모든 칸이 자기 모양에 속했습니다.',
  shapeRegionsHintsUsed: '힌트 사용',
  shapeRegionsNewBestTime: '최고 기록 경신.',
  shapeRegionsNewBoard: '새 보드',
  shapeRegionsSolvedCount: '푼 퍼즐',
  shapeRegionsDailySection: '데일리',
  shapeRegionsDailiesCleared: '달성한 날',
  shapeRegionsStep1Title: '숫자와 기호',
  shapeRegionsStep1Body: '숫자는 그 모양의 칸 수, 기호는 그 형태입니다.',
  shapeRegionsStep2Title: '힌트에서 키우기',
  shapeRegionsStep2Body: '힌트 칸에서 옆 칸으로 드래그하면 모양이 자랍니다.',
  shapeRegionsStep3Title: '보드 채우기',
  shapeRegionsStep3Body: '모든 칸이 어떤 모양에 속하면 완성입니다. 칸을 탭하면 빠집니다.',
};
