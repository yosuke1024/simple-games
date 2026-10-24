/**
 * Tangram — the Traditional Chinese catalog. Provenance
 * (docs/TANGRAM_RULES.md §11): `machine` — written by an AI from the English
 * source on 2026-10-21; nobody has read it, native speaker or author. The
 * title (`tangramName`) stays "Tangram" (not 七巧板 — the title rule of
 * docs/TANGRAM_RULES.md §11 keeps it the same in all 14 locales).
 *
 * Terms: 剪影 (silhouette), 圖形 (figure), 拼塊 (piece), 托盤 (tray),
 * 盤面 (board), 角 / 邊 (corner / edge). Tiers and the daily follow the
 * puzzle shelf (簡單 / 中等 / 困難, 每日挑戰).
 */
import type { TangramMessages } from './en';

export const zhHant: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: '簡單',
  tangramTier_medium: '中等',
  tangramTier_hard: '困難',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: '每日挑戰 {date}',
  tangramSilhouetteLabel: '剪影：{figure}',

  tangramConfirmReplaceTitle: '要取代進行中的圖形嗎？',
  tangramConfirmReplaceBody: '「{current}」將被「{next}」取代。',

  tangramPiece_L1: '大三角形 1',
  tangramPiece_L2: '大三角形 2',
  tangramPiece_M: '中三角形',
  tangramPiece_P: '平行四邊形',
  tangramPiece_SQ: '正方形',
  tangramPiece_S1: '小三角形 1',
  tangramPiece_S2: '小三角形 2',
  tangramPieceInTray: '{piece}，旋轉 {angle}°，在托盤中',
  tangramPieceInTrayFlipped: '{piece}，旋轉 {angle}°，已翻轉，在托盤中',
  tangramPieceOnBoard: '{piece}，旋轉 {angle}°，在盤面上',
  tangramPieceOnBoardFlipped: '{piece}，旋轉 {angle}°，已翻轉，在盤面上',
  tangramPieceFixed: '{piece}，旋轉 {angle}°，已固定在原位',
  tangramPieceFixedFlipped: '{piece}，旋轉 {angle}°，已翻轉，已固定在原位',

  tangramRotate: '旋轉',
  tangramFlip: '翻轉',

  tangramLifted: '已拿起{piece}。方向鍵移動，Enter 放下，Esc 放回托盤。',
  tangramFitsOutlineVertex: '可以放下，貼在剪影的角上',
  tangramFitsOutlineEdge: '可以放下，貼在剪影的邊上',
  tangramFitsPieceVertex: '可以放下，貼在另一個拼塊的角上',
  tangramFitsPieceEdge: '可以放下，貼在另一個拼塊的邊上',
  tangramNoFit: '這裡放不下',

  tangramStep1Title: '拖曳和旋轉',
  tangramStep1Body: '把拼塊拖到剪影上放下，點按它就能旋轉（「翻轉」按鈕可翻轉平行四邊形）。',
  tangramStep2Title: '放在裡面，不能重疊',
  tangramStep2Body: '拼塊只能放在剪影裡面，不能壓在別的拼塊上。',
  tangramStep3Title: '填滿',
  tangramStep3Body: '七個拼塊剛好填滿剪影，圖形就完成了。',

  tangramResultTitle: '圖形完成',
  tangramNextFigure: '下一個圖形',
  tangramTierLabel: '難度',
  tangramFigureLabel: '圖形',

  tangramStatStarted: '開始的圖形',
  tangramStatCompleted: '完成的圖形',
  tangramStatDifferent: '完成過的不同圖形',
  tangramStatDays: '完成的天數',
  tangramStatsAll: '全部遊戲',
};
