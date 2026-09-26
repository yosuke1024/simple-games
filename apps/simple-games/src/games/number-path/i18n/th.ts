/**
 * Thai catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const th: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'เลือกกระดาน',
  numberPathDifficulty_easy: 'ง่าย',
  numberPathDifficulty_medium: 'ปานกลาง',
  numberPathDifficulty_hard: 'ยาก',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'กระดาน Number Path ขนาด {width} คูณ {height}',
  numberPathCellPlain: 'แถว {row} คอลัมน์ {col}',
  numberPathCellNumber: 'หมายเลข {n} แถว {row} คอลัมน์ {col}',
  numberPathOnPath: 'อยู่บนเส้นทาง ลำดับที่ {step}',
  numberPathOffPath: 'ไม่อยู่บนเส้นทาง',
  numberPathHintNext: 'ช่องที่ทำเครื่องหมายคือก้าวถัดไป',
  numberPathHintBack: 'เส้นทางหลงไปแล้ว ถอยกลับไปยังช่องที่ทำเครื่องหมาย',
  numberPathHintNone: 'ตอนนี้ยังไม่มีคำใบ้',
  numberPathSolvedTitle: 'สำเร็จ!',
  numberPathSolvedBody: 'เส้นเดียว ครบทุกช่อง ตามลำดับ',
  numberPathHintsUsed: 'คำใบ้ที่ใช้',
  numberPathNewBestTime: 'เร็วที่สุดของคุณ',
  numberPathNewBoard: 'กระดานใหม่',
  numberPathSolvedCount: 'กระดานที่แก้ได้',
  numberPathDailySection: 'รายวัน',
  numberPathDailiesSolved: 'วันที่แก้ได้',
  numberPathDailyBacklogHint: 'วันก่อนหน้าทุกวันยังเปิดอยู่',
  numberPathStep1Title: 'ไล่ตามตัวเลข',
  numberPathStep1Body: 'ลากเส้นเดียวจาก 1 ผ่านตัวเลขตามลำดับ',
  numberPathStep2Title: 'ครบทุกช่อง',
  numberPathStep2Body: 'เส้นผ่านทุกช่องช่องละหนึ่งครั้งและจบที่ตัวเลขสุดท้าย',
  numberPathStep3Title: 'กำแพงขวางทาง',
  numberPathStep3Body: 'ขอบหนาข้ามไม่ได้ หากจะถอยให้ลากย้อนตามเส้นหรือแตะช่องบนเส้น',
};
