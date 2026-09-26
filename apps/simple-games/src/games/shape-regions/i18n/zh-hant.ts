/**
 * Traditional Chinese catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const zhHant: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: '選擇棋盤',
  shapeRegionsDifficulty_easy: '簡單',
  shapeRegionsDifficulty_medium: '中等',
  shapeRegionsDifficulty_hard: '困難',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: '取代進行中的棋盤?',
  shapeRegionsConfirmSwitchBody: '進行中的{current}遊戲將被新的{next}棋盤取代。',
  shapeRegionsBoardLabel: 'Shape Regions 棋盤,{width}×{height}',
  shapeRegionsCellAssigned: '第{row}列第{col}欄,形狀 {region}',
  shapeRegionsCellEmpty: '第{row}列第{col}欄,未分配',
  shapeRegionsClueCount: '{size} 格中的 {count} 格',
  shapeRegionsRuleBroken: '違反規則',
  shapeRegionsShape_line: '直線',
  shapeRegionsShape_block: '矩形',
  shapeRegionsShape_corner: 'L 形',
  shapeRegionsShape_tee: 'T 形',
  shapeRegionsShape_step: '階梯',
  shapeRegionsHintWrong: '醒目標示的形狀與答案不符。',
  shapeRegionsHintForced: '標記的格子只能屬於醒目標示的形狀。',
  shapeRegionsHintSole: '醒目標示的形狀只有一種放法。',
  shapeRegionsHintCommon: '無論醒目標示的形狀怎麼放,都包含標記的格子。',
  shapeRegionsHintNone: '目前沒有找到確定的一步。',
  shapeRegionsSolvedTitle: '完成!',
  shapeRegionsSolvedBody: '每個格子都屬於自己的形狀。',
  shapeRegionsHintsUsed: '已用提示',
  shapeRegionsNewBestTime: '你的最快紀錄。',
  shapeRegionsNewBoard: '新棋盤',
  shapeRegionsSolvedCount: '已解謎題',
  shapeRegionsDailySection: '每日',
  shapeRegionsDailiesCleared: '完成天數',
  shapeRegionsDailyBacklogHint: '之前的每一天都可以開啟。',
  shapeRegionsStep1Title: '數字與符號',
  shapeRegionsStep1Body: '數字是該形狀的格數,符號是它的形態。',
  shapeRegionsStep2Title: '從線索開始生長',
  shapeRegionsStep2Body: '從線索格向相鄰格拖曳,讓形狀生長。',
  shapeRegionsStep3Title: '填滿棋盤',
  shapeRegionsStep3Body: '完成時每個格子都屬於某個形狀。點一下格子可移除。',
};
