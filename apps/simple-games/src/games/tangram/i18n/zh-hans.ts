/**
 * Tangram — the Simplified Chinese catalog. Provenance
 * (docs/TANGRAM_RULES.md §11): `machine` — written by an AI from the English
 * source on 2026-10-21; nobody has read it, native speaker or author. The
 * title (`tangramName`) stays "Tangram" (not 七巧板 — the title rule of
 * docs/TANGRAM_RULES.md §11 keeps it the same in all 14 locales).
 *
 * Terms: 剪影 (silhouette), 图形 (figure), 拼块 (piece), 托盘 (tray),
 * 盘面 (board), 角 / 边 (corner / edge). Tiers and the daily follow the
 * puzzle shelf (简单 / 中等 / 困难, 每日挑战).
 */
import type { TangramMessages } from './en';

export const zhHans: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: '简单',
  tangramTier_medium: '中等',
  tangramTier_hard: '困难',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: '每日挑战 {date}',
  tangramSilhouetteLabel: '剪影：{figure}',

  tangramConfirmReplaceTitle: '替换进行中的图形？',
  tangramConfirmReplaceBody: '“{current}”将被“{next}”替换。',

  tangramPiece_L1: '大三角形 1',
  tangramPiece_L2: '大三角形 2',
  tangramPiece_M: '中三角形',
  tangramPiece_P: '平行四边形',
  tangramPiece_SQ: '正方形',
  tangramPiece_S1: '小三角形 1',
  tangramPiece_S2: '小三角形 2',
  tangramPieceInTray: '{piece}，旋转 {angle}°，在托盘中',
  tangramPieceInTrayFlipped: '{piece}，旋转 {angle}°，已翻转，在托盘中',
  tangramPieceOnBoard: '{piece}，旋转 {angle}°，在盘面上',
  tangramPieceOnBoardFlipped: '{piece}，旋转 {angle}°，已翻转，在盘面上',
  tangramPieceFixed: '{piece}，旋转 {angle}°，已固定在原位',
  tangramPieceFixedFlipped: '{piece}，旋转 {angle}°，已翻转，已固定在原位',

  tangramRotate: '旋转',
  tangramFlip: '翻转',

  tangramLifted: '已拿起{piece}。方向键移动，Enter 放下，Esc 放回托盘。',
  tangramFitsOutlineVertex: '可以放下，贴在剪影的角上',
  tangramFitsOutlineEdge: '可以放下，贴在剪影的边上',
  tangramFitsPieceVertex: '可以放下，贴在另一个拼块的角上',
  tangramFitsPieceEdge: '可以放下，贴在另一个拼块的边上',
  tangramNoFit: '这里放不下',

  tangramStep1Title: '拖动和旋转',
  tangramStep1Body: '把拼块拖到剪影上放下，点按它即可旋转（“翻转”按钮可翻转平行四边形）。',
  tangramStep2Title: '放在里面，不能重叠',
  tangramStep2Body: '拼块只能放在剪影里面，不能压在别的拼块上。',
  tangramStep3Title: '填满',
  tangramStep3Body: '七个拼块正好填满剪影，图形就完成了。',

  tangramResultTitle: '图形完成',
  tangramNextFigure: '下一个图形',
  tangramTierLabel: '难度',
  tangramFigureLabel: '图形',

  tangramStatStarted: '开始的图形',
  tangramStatCompleted: '完成的图形',
  tangramStatDifferent: '完成过的不同图形',
  tangramStatDays: '完成的天数',
  tangramStatsAll: '全部游戏',
};
