/**
 * Korean catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `바꾸기` for a swap, `줄` for a line of three, `라운드` for a round, `보석` for a gem, `연쇄` for
 * the cascade, `최고 기록` for a best (Snake), `점수` for the score (shell `score`). The stuck ending
 * is a fact about the board, never `패배` or `게임 오버`.
 */
import type { GemSwapMessages } from './en';

export const ko: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: '보석',
  gemSwapKinds_5: '5 · 쉬움',
  gemSwapKinds_6: '6 · 보통',
  gemSwapKindsCount: '보석 {count}종',
  gemSwapResumeNote: '점수 {score} · {kinds}',
  gemSwapBestNote: '최고 {score}',
  gemSwapBestFor: '최고 기록, {kinds}',
  gemSwapSwapsLeft: '바꾸기 {count}번 남음',
  gemSwapBoardLabel: '보석 판, {size} × {size}',
  gemSwapCell: '{row}행 {col}열, {gem}',
  gemSwapCellSelected: '{row}행 {col}열, {gem}, 선택됨',
  gemSwapGem_hexagon: '육각형',
  gemSwapGem_octagon: '팔각형',
  gemSwapGem_pear: '물방울',
  gemSwapGem_marquise: '배 모양',
  gemSwapGem_shield: '방패',
  gemSwapGem_heart: '하트',
  gemSwapNewBoard: '새 판',
  gemSwapLiveMove: '{count}개 사라짐 · 바꾸기 {left}번 남음',
  gemSwapLiveInvalid: '이 두 보석은 바꿀 수 없습니다',
  gemSwapLiveUndo: '바꾸기를 되돌렸습니다 · 바꾸기 {left}번 남음',
  gemSwapResultTitle: '라운드 종료',
  gemSwapEnd_swaps: '30번의 바꾸기를 모두 했습니다.',
  gemSwapEnd_stuck: '셋을 한 줄로 만드는 바꾸기가 더 없습니다.',
  gemSwapEnd_cap: '연쇄가 64단계 한도에 닿았습니다.',
  gemSwapNotCounted: '한도에서 멈춘 라운드는 최고 기록에 들어가지 않습니다.',
  gemSwapNewBest: '최고 기록 경신 ({kinds})',
  gemSwapBestWith: '최고 기록 ({kinds}): {score}',
  gemSwapStep1Title: '바꾸기',
  gemSwapStep1Body: '이웃한 보석 두 개를 바꿔 같은 모양을 셋 이상 한 줄로 놓으세요.',
  gemSwapStep2Title: '사라짐',
  gemSwapStep2Body: '줄이 사라지면 위에서 새 보석이 떨어지고, 새로 생긴 줄도 이어서 사라집니다.',
  gemSwapStep3Title: '점수',
  gemSwapStep3Body: '한 라운드는 바꾸기 30번이고, 사라진 보석 하나가 1점입니다.',
  gemSwapFigureSwap: '바꾸면 육각형 셋이 한 줄이 되는 이웃한 보석 두 개',
  gemSwapFigureClear: '줄이 사라지고 위의 보석이 그 자리로 떨어지는 모습',
  gemSwapFigureRound: '점수 42와 바꾸기 30번 중 18번이 남은 막대',
};
