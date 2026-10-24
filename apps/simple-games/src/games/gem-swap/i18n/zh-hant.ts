/**
 * Traditional Chinese catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `交換` for a swap, `一排` / `連成一排` for a line of three, `一局` for a round, `寶石` for a gem,
 * `連鎖` for the cascade, `最佳` / `紀錄` for a best (Snake), `分數` for the score (shell `score`). The
 * stuck ending is a fact about the board, never `失敗` or `遊戲結束`.
 */
import type { GemSwapMessages } from './en';

export const zhHant: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: '寶石',
  gemSwapKinds_5: '5 · 簡單',
  gemSwapKinds_6: '6 · 普通',
  gemSwapKindsCount: '{count} 種',
  gemSwapResumeNote: '分數 {score} · {kinds}',
  gemSwapBestNote: '最佳 {score}',
  gemSwapBestFor: '最佳（{kinds}）',
  gemSwapSwapsLeft: '還可交換 {count} 次',
  gemSwapBoardLabel: '寶石盤面，{size} × {size}',
  gemSwapCell: '第 {row} 列第 {col} 欄，{gem}',
  gemSwapCellSelected: '第 {row} 列第 {col} 欄，{gem}，已選取',
  gemSwapGem_hexagon: '六邊形',
  gemSwapGem_octagon: '八邊形',
  gemSwapGem_pear: '水滴',
  gemSwapGem_marquise: '欖尖形',
  gemSwapGem_shield: '盾形',
  gemSwapGem_heart: '心形',
  gemSwapNewBoard: '新盤面',
  gemSwapLiveMove: '消除 {count} 個 · 還可交換 {left} 次',
  gemSwapLiveInvalid: '這兩個不能交換',
  gemSwapLiveUndo: '已復原交換 · 還可交換 {left} 次',
  gemSwapResultTitle: '本局結束',
  gemSwapEnd_swaps: '30 次交換已全部完成。',
  gemSwapEnd_stuck: '已沒有能讓三個連成一排的交換。',
  gemSwapEnd_cap: '連鎖達到了 64 段的上限。',
  gemSwapNotCounted: '在上限處停止的一局不計入最佳。',
  gemSwapNewBest: '新紀錄（{kinds}）',
  gemSwapBestWith: '最佳（{kinds}）：{score}',
  gemSwapStep1Title: '交換',
  gemSwapStep1Body: '交換相鄰的兩顆寶石，讓三個或更多相同形狀連成一排。',
  gemSwapStep2Title: '消除',
  gemSwapStep2Body: '連成的一排會消除，新寶石從上方落下，落下後新連成的一排也會消除。',
  gemSwapStep3Title: '分數',
  gemSwapStep3Body: '一局有 30 次交換，每消除一顆寶石得一分。',
  gemSwapFigureSwap: '兩顆相鄰的寶石即將交換，交換後三個六邊形連成一排',
  gemSwapFigureClear: '一排已經消除，上方的寶石落下填補空位',
  gemSwapFigureRound: '分數 42，以及 30 次交換還剩 18 次的進度條',
};
