/**
 * Thai catalog for Loop Puzzle — written with AI assistance from the English
 * source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No native
 * speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = คำใบ้) and Box Regions (board = กระดาน); an edge is ขอบ, a drawn
 * edge เส้น, a dot จุด, the loop วงปิด / วง. The hint's ring is "เน้นไว้"
 * (highlighted), not "วงกลมไว้", so it never reads as the loop itself; the
 * marked edge is "ที่ชี้ไว้" (pointed out), shorter than "ที่ทำเครื่องหมายไว้"
 * so a hint stays within two lines at 360px.
 */
import type { LoopPuzzleMessages } from './en';

export const th: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'เลือกกระดาน',
  loopPuzzleDifficulty_easy: 'ง่าย',
  loopPuzzleDifficulty_medium: 'ปานกลาง',
  loopPuzzleDifficulty_hard: 'ยาก',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'แทนที่กระดานที่กำลังเล่นอยู่หรือไม่?',
  loopPuzzleConfirmSwitchBody: 'เกมระดับ {current} ของคุณจะถูกแทนที่ด้วยกระดานระดับ {next} ใหม่',
  loopPuzzleBoardLabel: 'กระดาน Loop Puzzle ขนาด {width} คูณ {height}',
  loopPuzzleEdgeHEmpty: 'ขอบแนวนอน แถว {row} คอลัมน์ {col} ว่าง',
  loopPuzzleEdgeHLine: 'ขอบแนวนอน แถว {row} คอลัมน์ {col} มีเส้น',
  loopPuzzleEdgeHCross: 'ขอบแนวนอน แถว {row} คอลัมน์ {col} มีเครื่องหมาย ×',
  loopPuzzleEdgeVEmpty: 'ขอบแนวตั้ง แถว {row} คอลัมน์ {col} ว่าง',
  loopPuzzleEdgeVLine: 'ขอบแนวตั้ง แถว {row} คอลัมน์ {col} มีเส้น',
  loopPuzzleEdgeVCross: 'ขอบแนวตั้ง แถว {row} คอลัมน์ {col} มีเครื่องหมาย ×',
  loopPuzzleClueOpen: 'ตัวเลข {n} แถว {row} คอลัมน์ {col}',
  loopPuzzleClueMet: 'ตัวเลข {n} แถว {row} คอลัมน์ {col} ครบแล้ว',
  loopPuzzleClueTooMany: 'ตัวเลข {n} แถว {row} คอลัมน์ {col} เส้นเกิน',
  loopPuzzleClueTooFew: 'ตัวเลข {n} แถว {row} คอลัมน์ {col} ไม่มีทางครบแล้ว',
  loopPuzzleNoteHint: 'คำใบ้ชี้ไว้',
  loopPuzzleNoteConflict: 'ผิดกฎ',
  loopPuzzleConflictBranch: 'มีจุดที่มีเส้นมากกว่าสองเส้น',
  loopPuzzleConflictDeadEnd: 'มีเส้นที่ไปจบที่จุดซึ่งไปต่อไม่ได้',
  loopPuzzleConflictLoop: 'มีวงปิดแล้ว แต่ยังมีเส้นอื่นอยู่นอกวง',
  loopPuzzleConflictTooMany: 'มีตัวเลขที่มีเส้นรอบตัวมากกว่าค่าของมัน',
  loopPuzzleConflictTooFew: 'มีตัวเลขที่ไม่มีทางได้เส้นครบแล้ว',
  loopPuzzleConflictClosed: 'วงปิดแล้ว แต่ยังมีตัวเลขที่ไม่ตรง',
  loopPuzzleHintWrongLine: 'เส้นที่ชี้ไว้ไม่ได้อยู่ในวง',
  loopPuzzleHintWrongCross: 'วงต้องผ่าน × ที่ชี้ไว้',
  loopPuzzleHintCellLine: 'ตัวเลขที่เน้นไว้ต้องมีเส้นบนขอบที่ชี้ไว้',
  loopPuzzleHintCellCross: 'ตัวเลขที่เน้นไว้ไม่เหลือเส้นให้ขอบที่ชี้ไว้',
  loopPuzzleHintDotLine: 'ที่จุดที่เน้นไว้ วงต้องผ่านขอบที่ชี้ไว้',
  loopPuzzleHintDotCross: 'ที่จุดที่เน้นไว้ ขอบที่ชี้ไว้เป็นเส้นไม่ได้',
  loopPuzzleHintLoopCross: 'ถ้าขีดเส้นบนขอบที่ชี้ไว้ วงจะปิดเร็วเกินไป',
  loopPuzzleHintClosedCross: 'วงปิดแล้ว ขอบที่ชี้ไว้จึงไม่ได้อยู่ในวง',
  loopPuzzleHintTrialLine: 'ถ้าขอบที่ชี้ไว้ไม่มีเส้น จะเกิดข้อขัดแย้ง',
  loopPuzzleHintTrialCross: 'ถ้าขีดเส้นบนขอบที่ชี้ไว้ จะเกิดข้อขัดแย้ง',
  loopPuzzleHintRevealLine: 'ขอบที่ชี้ไว้เป็นส่วนหนึ่งของวง',
  loopPuzzleHintRevealCross: 'ขอบที่ชี้ไว้ไม่ได้เป็นส่วนหนึ่งของวง',
  loopPuzzleHintNone: 'ตอนนี้ยังไม่มีคำใบ้',
  loopPuzzleSolvedTitle: 'แก้สำเร็จ!',
  loopPuzzleSolvedBody: 'วงปิดหนึ่งวง ตัวเลขครบทุกตัว',
  loopPuzzleHintsUsed: 'คำใบ้ที่ใช้',
  loopPuzzleNewBestTime: 'เร็วที่สุดของคุณ',
  loopPuzzleNewBoard: 'กระดานใหม่',
  loopPuzzleSolvedCount: 'ปริศนาที่แก้แล้ว',
  loopPuzzleDailySection: 'รายวัน',
  loopPuzzleDailiesCleared: 'วันที่ทำเสร็จ',
  loopPuzzleAllBoards: 'ทุกกระดาน',
  loopPuzzleStep1Title: 'วงปิดหนึ่งวง',
  loopPuzzleStep1Body: 'เชื่อมจุดให้เป็นวงปิดวงเดียว ที่ไม่แตกแขนงและไม่ตัดกันเอง',
  loopPuzzleStep2Title: 'อ่านตัวเลข',
  loopPuzzleStep2Body: 'ตัวเลขบอกว่าวงผ่านขอบของช่องนั้นกี่ด้าน',
  loopPuzzleStep3Title: 'แตะขอบ',
  loopPuzzleStep3Body:
    'แตะขอบแต่ละครั้งจะเปลี่ยนเป็นเส้น แล้วเป็น × (ไม่อยู่ในวง) แล้วกลับเป็นว่าง',
};
