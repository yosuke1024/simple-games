/**
 * Tangram — the Vietnamese catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: hình bóng (silhouette), hình (figure), mảnh (piece), khay (tray),
 * bảng (board, as in the shell), góc / cạnh (corner / edge). Tiers and the
 * daily follow the puzzle shelf (Dễ / Trung bình / Khó, Thử thách hằng ngày).
 */
import type { TangramMessages } from './en';

export const vi: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Dễ',
  tangramTier_medium: 'Trung bình',
  tangramTier_hard: 'Khó',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Thử thách ngày {date}',
  tangramSilhouetteLabel: 'Hình bóng: {figure}',

  tangramConfirmReplaceTitle: 'Thay hình đang chơi?',
  tangramConfirmReplaceBody: 'Hình {current} sẽ được thay bằng {next}.',

  tangramPiece_L1: 'Tam giác lớn 1',
  tangramPiece_L2: 'Tam giác lớn 2',
  tangramPiece_M: 'Tam giác vừa',
  tangramPiece_P: 'Hình bình hành',
  tangramPiece_SQ: 'Hình vuông',
  tangramPiece_S1: 'Tam giác nhỏ 1',
  tangramPiece_S2: 'Tam giác nhỏ 2',
  tangramPieceInTray: '{piece}, xoay {angle}°, trong khay',
  tangramPieceInTrayFlipped: '{piece}, xoay {angle}°, đã lật, trong khay',
  tangramPieceOnBoard: '{piece}, xoay {angle}°, trên bảng',
  tangramPieceOnBoardFlipped: '{piece}, xoay {angle}°, đã lật, trên bảng',
  tangramPieceFixed: '{piece}, xoay {angle}°, cố định tại chỗ',
  tangramPieceFixedFlipped: '{piece}, xoay {angle}°, đã lật, cố định tại chỗ',

  tangramRotate: 'Xoay',
  tangramFlip: 'Lật',

  tangramLifted: 'Đã nhấc {piece}. Phím mũi tên để di chuyển, Enter để đặt, Esc để trả về khay.',
  tangramFitsOutlineVertex: 'Đặt được, ở một góc của hình bóng',
  tangramFitsOutlineEdge: 'Đặt được, ở một cạnh của hình bóng',
  tangramFitsPieceVertex: 'Đặt được, ở một góc của mảnh khác',
  tangramFitsPieceEdge: 'Đặt được, ở một cạnh của mảnh khác',
  tangramNoFit: 'Không đặt được ở đây',

  tangramStep1Title: 'Kéo và xoay',
  tangramStep1Body:
    'Kéo một mảnh vào hình bóng để đặt, và chạm vào mảnh để xoay (nút Lật sẽ lật hình bình hành).',
  tangramStep2Title: 'Bên trong, không chồng lên',
  tangramStep2Body: 'Mảnh chỉ đặt được bên trong hình bóng, và không bao giờ đè lên mảnh khác.',
  tangramStep3Title: 'Lấp đầy',
  tangramStep3Body: 'Khi cả bảy mảnh lấp kín vừa khít hình bóng, hình được hoàn thành.',

  tangramResultTitle: 'Đã hoàn thành hình',
  tangramNextFigure: 'Hình tiếp theo',
  tangramTierLabel: 'Cấp độ',
  tangramFigureLabel: 'Hình',

  tangramStatStarted: 'Hình đã bắt đầu',
  tangramStatCompleted: 'Hình đã hoàn thành',
  tangramStatDifferent: 'Số hình khác nhau đã hoàn thành',
  tangramStatDays: 'Ngày đã hoàn thành',
  tangramStatsAll: 'Toàn bộ lượt chơi',
};
