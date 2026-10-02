/**
 * Simplified Chinese catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const zhHans: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: '选择棋盘',
  boxRegionsDifficulty_easy: '简单',
  boxRegionsDifficulty_medium: '中等',
  boxRegionsDifficulty_hard: '困难',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: '替换进行中的棋盘？',
  boxRegionsConfirmSwitchBody: '你正在进行的{current}对局将被新的{next}棋盘替换。',
  boxRegionsBoardLabel: 'Box Regions 棋盘，{width} 乘 {height}',
  boxRegionsCellAssigned: '第 {row} 行，第 {col} 列，方框 {region}',
  boxRegionsCellEmpty: '第 {row} 行，第 {col} 列，未分配',
  boxRegionsClueCount: '{size} 格中的 {count} 格',
  boxRegionsRuleBroken: '违反规则',
  boxRegionsKind_square: '正方形',
  boxRegionsKind_tall: '竖长',
  boxRegionsKind_wide: '横长',
  boxRegionsKind_free: '任意方框',
  boxRegionsHintWrong: '高亮的方框与答案不符。',
  boxRegionsHintForced: '标记的格子只能属于高亮线索的方框。',
  boxRegionsHintSole: '这个方框只有一种画法。',
  boxRegionsHintCommon: '无论怎样画这条线索的方框，都会覆盖标记的格子。',
  boxRegionsHintNone: '目前没有找到确定的一步。',
  boxRegionsSolvedTitle: '完成！',
  boxRegionsSolvedBody: '每个格子都在自己的方框里。',
  boxRegionsHintsUsed: '已用提示',
  boxRegionsNewBestTime: '你的最快纪录。',
  boxRegionsNewBoard: '新棋盘',
  boxRegionsSolvedCount: '已解谜题',
  boxRegionsDailySection: '每日',
  boxRegionsDailiesCleared: '已完成天数',
  boxRegionsStep1Title: '划分成方框',
  boxRegionsStep1Body: '把棋盘划分成矩形，每个矩形恰好包含一条线索。',
  boxRegionsStep2Title: '读懂线索',
  boxRegionsStep2Body: '数字表示方框包含的格数；符号表示正方形、竖长、横长或任意。',
  boxRegionsStep3Title: '从角拖到角',
  boxRegionsStep3Body: '从一个角拖到对角来画方框。点按方框可删除。卡住了？试试提示。',
};
