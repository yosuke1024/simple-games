/**
 * Simplified Chinese catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `交换` for a swap, `一排` / `连成一排` for a line of three, `一局` for a round, `宝石` for a gem,
 * `连锁` for the cascade, `最佳` / `纪录` for a best (Snake), `得分` for the score (shell `score`). The
 * stuck ending is a fact about the board, never `失败` or `游戏结束`.
 */
import type { GemSwapMessages } from './en';

export const zhHans: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: '宝石',
  gemSwapKinds_5: '5 · 简单',
  gemSwapKinds_6: '6 · 普通',
  gemSwapKindsCount: '{count} 种',
  gemSwapResumeNote: '得分 {score} · {kinds}',
  gemSwapBestNote: '最佳 {score}',
  gemSwapBestFor: '最佳（{kinds}）',
  gemSwapSwapsLeft: '还可交换 {count} 次',
  gemSwapBoardLabel: '宝石盘面，{size} × {size}',
  gemSwapCell: '第 {row} 行第 {col} 列，{gem}',
  gemSwapCellSelected: '第 {row} 行第 {col} 列，{gem}，已选中',
  gemSwapGem_hexagon: '六边形',
  gemSwapGem_octagon: '八边形',
  gemSwapGem_pear: '水滴',
  gemSwapGem_marquise: '榄尖形',
  gemSwapGem_shield: '盾形',
  gemSwapGem_heart: '心形',
  gemSwapNewBoard: '新盘面',
  gemSwapLiveMove: '消除 {count} 个 · 还可交换 {left} 次',
  gemSwapLiveInvalid: '这两个不能交换',
  gemSwapLiveUndo: '已撤销交换 · 还可交换 {left} 次',
  gemSwapResultTitle: '本局结束',
  gemSwapEnd_swaps: '30 次交换已全部完成。',
  gemSwapEnd_stuck: '已没有能让三个连成一排的交换。',
  gemSwapEnd_cap: '连锁达到了 64 段的上限。',
  gemSwapNotCounted: '在上限处停止的一局不计入最佳。',
  gemSwapNewBest: '新纪录（{kinds}）',
  gemSwapBestWith: '最佳（{kinds}）：{score}',
  gemSwapStep1Title: '交换',
  gemSwapStep1Body: '交换相邻的两颗宝石，让三个或更多相同形状连成一排。',
  gemSwapStep2Title: '消除',
  gemSwapStep2Body: '连成的一排会消除，新宝石从上方落下，落下后新连成的一排也会消除。',
  gemSwapStep3Title: '得分',
  gemSwapStep3Body: '一局有 30 次交换，每消除一颗宝石得一分。',
  gemSwapFigureSwap: '两颗相邻的宝石即将交换，交换后三个六边形连成一排',
  gemSwapFigureClear: '一排已经消除，上方的宝石落下填补空位',
  gemSwapFigureRound: '得分 42，以及 30 次交换还剩 18 次的进度条',
};
