/**
 * Korean catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const ko: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: '보드 선택',
  bridgesDifficulty_easy: '쉬움',
  bridgesDifficulty_medium: '보통',
  bridgesDifficulty_hard: '어려움',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: '진행 중인 보드를 바꿀까요?',
  bridgesConfirmSwitchBody: '진행 중인 {current} 보드가 새 {next} 보드로 바뀝니다.',
  bridgesBoardLabel: 'Bridges 보드, 가로 {width} 세로 {height}, 섬 {islands}개',
  bridgesIslandOpen: '{row}행 {col}열의 섬 {value}: 다리 {value}개 중 {count}개',
  bridgesIslandComplete: '{row}행 {col}열의 섬 {value}: 완성',
  bridgesIslandOver: '{row}행 {col}열의 섬 {value}: 다리 {count}개, 너무 많음',
  bridgesIslandSelected: '{island}. 선택됨',
  bridgesIslandPartner: '{island}. 선택한 섬과 연결 가능: 다리 2개 중 {bridges}개',
  bridgesIslandHinted: '{island}. 힌트로 강조됨',
  bridgesIslandHintRing: '{island}. 힌트로 강조됨, 점선 고리',
  bridgesAnnounceNone: '{row1}행 {col1}열과 {row2}행 {col2}열 사이에 다리 없음',
  bridgesAnnounceOne: '{row1}행 {col1}열과 {row2}행 {col2}열 사이에 다리 1개',
  bridgesAnnounceTwo: '{row1}행 {col1}열과 {row2}행 {col2}열 사이에 다리 2개',
  bridgesSplitNote:
    '모든 숫자를 채웠지만 섬이 {groups}개 그룹으로 나뉘어 있습니다. 하나로 이어 주세요.',
  bridgesHintWrong: '강조된 섬 사이의 다리가 너무 많습니다.',
  bridgesHintOne: '강조된 두 섬 사이에는 다리가 적어도 1개 필요합니다.',
  bridgesHintTwo: '강조된 두 섬 사이에는 다리가 2개 필요합니다.',
  bridgesHintOneAt:
    '점선 고리의 섬에서 세어 보세요. 강조된 두 섬 사이에는 다리가 적어도 1개 필요합니다.',
  bridgesHintTwoAt: '점선 고리의 섬에서 세어 보세요. 강조된 두 섬 사이에는 다리가 2개 필요합니다.',
  bridgesHintNone: '지금은 확실한 수를 찾지 못했습니다.',
  bridgesHintWhere: '강조된 섬: {row1}행 {col1}열과 {row2}행 {col2}열.',
  bridgesHintWhereRing:
    '강조된 섬: {row1}행 {col1}열과 {row2}행 {col2}열. 점선 고리: {row}행 {col}열.',
  bridgesSolvedTitle: '모두 연결!',
  bridgesSolvedBody: '모든 섬이 하나의 네트워크로 이어졌습니다.',
  bridgesHintsUsed: '사용한 힌트',
  bridgesNewBestTime: '지금까지 중 가장 빠릅니다.',
  bridgesNewBoard: '새 보드',
  bridgesSolvedCount: '푼 보드',
  bridgesDailySection: '데일리',
  bridgesDailiesCleared: '완료한 날',
  bridgesAllModes: '모든 모드',
  bridgesStep1Title: '숫자는 다리 개수',
  bridgesStep1Body: '각 섬에는 숫자와 똑같은 개수의 다리가 놓입니다.',
  bridgesStep2Title: '곧게, 최대 2개',
  bridgesStep2Body:
    '다리는 가로나 세로로 곧게 놓이고, 서로 교차하지 않으며, 같은 두 섬 사이에는 최대 2개까지입니다.',
  bridgesStep3Title: '모두 잇기',
  bridgesStep3Body:
    '섬을 탭한 뒤 고리가 표시된 상대 섬을 탭해 다리를 놓고(한 번 더 누르면 2개, 또 누르면 0개), 모든 섬을 이으세요.',
};
