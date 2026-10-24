/**
 * Tangram — the Japanese catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * written by an AI from the English source on 2026-10-21, and **nobody has
 * read it** — not the author, not any native speaker. The rest of the
 * collection's Japanese is the author's own; this game's is not, until the
 * author has read it. The title (`tangramName`) stays "Tangram" in every
 * locale.
 *
 * Terms follow the rules document: 影絵 (silhouette), 図形 (figure), 駒
 * (piece), トレイ (tray), 盤 (board); the tiers are the puzzle shelf's
 * かんたん / ふつう / むずかしい. The replace line says 置き換わる and nothing
 * that reads as "saved" or "added" (§11).
 */
import type { TangramMessages } from './en';

export const ja: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'かんたん',
  tangramTier_medium: 'ふつう',
  tangramTier_hard: 'むずかしい',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'デイリー {date}',
  tangramSilhouetteLabel: '影絵: {figure}',

  tangramConfirmReplaceTitle: '進行中の図形を置き換えますか？',
  tangramConfirmReplaceBody: '「{current}」は「{next}」に置き換わります。',

  tangramPiece_L1: '大三角 1',
  tangramPiece_L2: '大三角 2',
  tangramPiece_M: '中三角',
  tangramPiece_P: '平行四辺形',
  tangramPiece_SQ: '正方形',
  tangramPiece_S1: '小三角 1',
  tangramPiece_S2: '小三角 2',
  tangramPieceInTray: '{piece}、{angle}° 回転、トレイの中',
  tangramPieceInTrayFlipped: '{piece}、{angle}° 回転、裏返し、トレイの中',
  tangramPieceOnBoard: '{piece}、{angle}° 回転、盤の上',
  tangramPieceOnBoardFlipped: '{piece}、{angle}° 回転、裏返し、盤の上',
  tangramPieceFixed: '{piece}、{angle}° 回転、固定',
  tangramPieceFixedFlipped: '{piece}、{angle}° 回転、裏返し、固定',

  tangramRotate: '回す',
  tangramFlip: '裏返す',

  tangramLifted:
    '{piece}を持ち上げました。矢印キーで動かし、Enter で置き、Esc でトレイに戻します。',
  tangramFitsOutlineVertex: '置けます(影絵の角)',
  tangramFitsOutlineEdge: '置けます(影絵の辺)',
  tangramFitsPieceVertex: '置けます(ほかの駒の角)',
  tangramFitsPieceEdge: '置けます(ほかの駒の辺)',
  tangramNoFit: 'ここには置けません',

  tangramStep1Title: 'ドラッグして回す',
  tangramStep1Body: '駒を影絵へドラッグして置き、タップで回す(平行四辺形はボタンで裏返す)。',
  tangramStep2Title: '中に置き、重ねない',
  tangramStep2Body: '置けるのは影絵の中だけ — 駒どうしは重ならない。',
  tangramStep3Title: 'ぴったり埋める',
  tangramStep3Body: '7 枚で影絵がぴったり埋まれば、図形の完成。',

  tangramResultTitle: '図形が完成',
  tangramNextFigure: '次の図形',
  tangramTierLabel: '難易度',
  tangramFigureLabel: '図形',

  tangramStatStarted: '始めた数',
  tangramStatCompleted: '完成した数',
  tangramStatDifferent: '完成した図形の種類',
  tangramStatDays: '達成した日数',
  tangramStatsAll: 'すべてのプレイ',
};
