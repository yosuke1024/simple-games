/**
 * Simplified Chinese catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const zhHans: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: '选择棋盘',
  shapeRegionsDifficulty_easy: '简单',
  shapeRegionsDifficulty_medium: '中等',
  shapeRegionsDifficulty_hard: '困难',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: '替换进行中的棋盘？',
  shapeRegionsConfirmSwitchBody: '进行中的{current}游戏将被新的{next}棋盘替换。',
  shapeRegionsBoardLabel: 'Shape Regions 棋盘，{width}×{height}',
  shapeRegionsCellAssigned: '第{row}行第{col}列，形状 {region}',
  shapeRegionsCellEmpty: '第{row}行第{col}列，未分配',
  shapeRegionsClueCount: '{size} 格中的 {count} 格',
  shapeRegionsRuleBroken: '违反规则',
  shapeRegionsShape_line: '直线',
  shapeRegionsShape_block: '矩形',
  shapeRegionsShape_corner: 'L 形',
  shapeRegionsShape_tee: 'T 形',
  shapeRegionsShape_step: '阶梯',
  shapeRegionsHintWrong: '高亮的形状与答案不符。',
  shapeRegionsHintForced: '标记的格子只能属于高亮的形状。',
  shapeRegionsHintSole: '高亮的形状只有一种放法。',
  shapeRegionsHintCommon: '无论高亮的形状怎么放，都包含标记的格子。',
  shapeRegionsHintNone: '目前没有找到确定的一步。',
  shapeRegionsSolvedTitle: '完成！',
  shapeRegionsSolvedBody: '每个格子都属于自己的形状。',
  shapeRegionsHintsUsed: '已用提示',
  shapeRegionsNewBestTime: '你的最快纪录。',
  shapeRegionsNewBoard: '新棋盘',
  shapeRegionsSolvedCount: '已解谜题',
  shapeRegionsDailySection: '每日',
  shapeRegionsDailiesCleared: '完成天数',
  shapeRegionsDailyBacklogHint: '之前的每一天都可以打开。',
  shapeRegionsStep1Title: '数字与符号',
  shapeRegionsStep1Body: '数字是该形状的格数，符号是它的形态。',
  shapeRegionsStep2Title: '从线索开始生长',
  shapeRegionsStep2Body: '从线索格向相邻格拖动，让形状生长。',
  shapeRegionsStep3Title: '填满棋盘',
  shapeRegionsStep3Body: '完成时每个格子都属于某个形状。点击格子可移除。',
};
