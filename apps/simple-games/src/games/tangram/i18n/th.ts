/**
 * Tangram — the Thai catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: ภาพเงา (silhouette), รูป (figure), ชิ้น (piece), ถาด (tray),
 * กระดาน (board, as in the shell), มุม / ขอบ (corner / edge). Spoken parts
 * are separated by spaces, Thai-style, rather than commas. Tiers and the
 * daily follow the puzzle shelf (ง่าย / ปานกลาง / ยาก, รายวัน).
 */
import type { TangramMessages } from './en';

export const th: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'ง่าย',
  tangramTier_medium: 'ปานกลาง',
  tangramTier_hard: 'ยาก',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'รายวัน {date}',
  tangramSilhouetteLabel: 'ภาพเงา: {figure}',

  tangramConfirmReplaceTitle: 'แทนที่รูปที่กำลังเล่นอยู่หรือไม่?',
  tangramConfirmReplaceBody: 'รูป {current} จะถูกแทนที่ด้วย {next}',

  tangramPiece_L1: 'สามเหลี่ยมใหญ่ 1',
  tangramPiece_L2: 'สามเหลี่ยมใหญ่ 2',
  tangramPiece_M: 'สามเหลี่ยมกลาง',
  tangramPiece_P: 'สี่เหลี่ยมด้านขนาน',
  tangramPiece_SQ: 'สี่เหลี่ยมจัตุรัส',
  tangramPiece_S1: 'สามเหลี่ยมเล็ก 1',
  tangramPiece_S2: 'สามเหลี่ยมเล็ก 2',
  tangramPieceInTray: '{piece} หมุน {angle}° อยู่ในถาด',
  tangramPieceInTrayFlipped: '{piece} หมุน {angle}° พลิกแล้ว อยู่ในถาด',
  tangramPieceOnBoard: '{piece} หมุน {angle}° อยู่บนกระดาน',
  tangramPieceOnBoardFlipped: '{piece} หมุน {angle}° พลิกแล้ว อยู่บนกระดาน',
  tangramPieceFixed: '{piece} หมุน {angle}° ตรึงอยู่กับที่',
  tangramPieceFixedFlipped: '{piece} หมุน {angle}° พลิกแล้ว ตรึงอยู่กับที่',

  tangramRotate: 'หมุน',
  tangramFlip: 'พลิก',

  tangramLifted: 'ยก{piece}ขึ้นแล้ว กดลูกศรเพื่อเลื่อน กด Enter เพื่อวาง กด Esc เพื่อคืนลงถาด',
  tangramFitsOutlineVertex: 'วางได้ ที่มุมของภาพเงา',
  tangramFitsOutlineEdge: 'วางได้ ที่ขอบของภาพเงา',
  tangramFitsPieceVertex: 'วางได้ ที่มุมของชิ้นอื่น',
  tangramFitsPieceEdge: 'วางได้ ที่ขอบของชิ้นอื่น',
  tangramNoFit: 'วางตรงนี้ไม่ได้',

  tangramStep1Title: 'ลากแล้วหมุน',
  tangramStep1Body: 'ลากชิ้นไปวางบนภาพเงา แล้วแตะชิ้นเพื่อหมุน (ปุ่มพลิกใช้พลิกสี่เหลี่ยมด้านขนาน)',
  tangramStep2Title: 'อยู่ข้างใน ไม่ทับกัน',
  tangramStep2Body: 'ชิ้นวางได้เฉพาะข้างในภาพเงา และวางทับชิ้นอื่นไม่ได้',
  tangramStep3Title: 'เติมให้เต็ม',
  tangramStep3Body: 'เมื่อทั้งเจ็ดชิ้นเติมภาพเงาได้พอดี รูปก็เสร็จสมบูรณ์',

  tangramResultTitle: 'รูปเสร็จสมบูรณ์',
  tangramNextFigure: 'รูปถัดไป',
  tangramTierLabel: 'ระดับ',
  tangramFigureLabel: 'รูป',

  tangramStatStarted: 'รูปที่เริ่มเล่น',
  tangramStatCompleted: 'รูปที่ทำเสร็จ',
  tangramStatDifferent: 'รูปที่ไม่ซ้ำกันที่ทำเสร็จ',
  tangramStatDays: 'จำนวนวันที่ทำสำเร็จ',
  tangramStatsAll: 'การเล่นทั้งหมด',
};
