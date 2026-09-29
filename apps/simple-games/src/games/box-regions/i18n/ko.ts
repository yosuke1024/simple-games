/**
 * Korean catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const ko: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: '보드 선택',
  boxRegionsDifficulty_easy: '쉬움',
  boxRegionsDifficulty_medium: '보통',
  boxRegionsDifficulty_hard: '어려움',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: '진행 중인 보드를 바꿀까요?',
  boxRegionsConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 보드로 바뀝니다.',
  boxRegionsBoardLabel: 'Box Regions 보드, 가로 {width} 세로 {height}',
  boxRegionsCellAssigned: '{row}행 {col}열, 상자 {region}',
  boxRegionsCellEmpty: '{row}행 {col}열, 배정되지 않음',
  boxRegionsClueCount: '{size}칸 중 {count}칸',
  boxRegionsRuleBroken: '규칙 위반',
  boxRegionsKind_square: '정사각형',
  boxRegionsKind_tall: '세로형',
  boxRegionsKind_wide: '가로형',
  boxRegionsKind_free: '모양 자유',
  boxRegionsHintWrong: '강조된 상자가 정답과 맞지 않습니다.',
  boxRegionsHintForced: '표시된 칸은 강조된 단서의 상자에만 들어갈 수 있습니다.',
  boxRegionsHintSole: '이 상자는 그리는 방법이 하나뿐입니다.',
  boxRegionsHintCommon: '이 단서의 상자를 어떻게 그려도 표시된 칸이 들어갑니다.',
  boxRegionsHintNone: '지금은 확실한 수를 찾지 못했습니다.',
  boxRegionsSolvedTitle: '해결!',
  boxRegionsSolvedBody: '모든 칸이 자기 상자에 들어갔습니다.',
  boxRegionsHintsUsed: '사용한 힌트',
  boxRegionsNewBestTime: '지금까지 가장 빠릅니다.',
  boxRegionsNewBoard: '새 보드',
  boxRegionsSolvedCount: '해결한 퍼즐',
  boxRegionsDailySection: '데일리',
  boxRegionsDailiesCleared: '완료한 날',
  boxRegionsDailyBacklogHint: '이전 날짜는 모두 열려 있습니다.',
  boxRegionsStep1Title: '상자로 나누기',
  boxRegionsStep1Body: '보드를 직사각형으로 나누세요. 각 상자에는 단서가 정확히 하나씩 들어갑니다.',
  boxRegionsStep2Title: '단서 읽기',
  boxRegionsStep2Body:
    '숫자는 상자의 칸 수이고, 기호는 정사각형·세로형·가로형·자유 중 하나를 뜻합니다.',
  boxRegionsStep3Title: '모서리에서 모서리로 그리기',
  boxRegionsStep3Body:
    '한쪽 모서리에서 반대쪽 모서리까지 드래그해 상자를 그리세요. 상자를 탭하면 지워집니다. 막혔나요? 힌트를 써 보세요.',
};
