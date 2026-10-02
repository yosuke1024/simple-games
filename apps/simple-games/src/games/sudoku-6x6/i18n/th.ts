/**
 * Thai catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const th: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'เลือกกระดาน',
  sudoku6x6Difficulty_easy: 'ง่าย',
  sudoku6x6Difficulty_medium: 'ปกติ',
  sudoku6x6Difficulty_hard: 'ยาก',
  sudoku6x6ConfirmSwitchTitle: 'เปลี่ยนกระดานที่เล่นค้างอยู่?',
  sudoku6x6ConfirmSwitchBody: 'เกม {current} ของคุณจะถูกแทนที่ด้วยกระดาน {next} ใหม่',
  sudoku6x6GridLabel: 'ตารางซูโดกุ 6×6',
  sudoku6x6PadLabel: 'แป้นตัวเลข',
  sudoku6x6PadKey: '{value} เหลือ {n}',
  sudoku6x6PadNoteKey: 'โน้ต {value}',
  sudoku6x6CellEmpty: 'ว่าง แถว {row} หลัก {col}',
  sudoku6x6CellGiven: '{value} เลขตั้งต้น แถว {row} หลัก {col}',
  sudoku6x6CellEntry: '{value} แถว {row} หลัก {col}',
  sudoku6x6Erase: 'ลบ',
  sudoku6x6Notes: 'โน้ต',
  sudoku6x6HintOnlyDigit: 'ช่องนี้ใส่ได้เพียงเลขเดียว',
  sudoku6x6HintOnlyCell: 'ที่นี่ {value} ลงได้แค่ช่องนี้',
  sudoku6x6HintLockedLine: 'ในบล็อกนี้ {value} ลงได้แค่ในเส้นที่เน้นไว้',
  sudoku6x6HintLockedBox: 'ในเส้นนี้ {value} ลงได้แค่ในบล็อกที่เน้นไว้',
  sudoku6x6HintRuledOut: 'ช่องเหล่านี้ตัดตัวเลขออกจากช่องอื่นในกลุ่มเดียวกัน',
  sudoku6x6HintNone: 'ยังหาคำตอบที่แน่ชัดไม่ได้',
  sudoku6x6SolvedTitle: 'สำเร็จ!',
  sudoku6x6SolvedBody: 'ทุกแถว ทุกหลัก และทุกบล็อกมี 1-6 ครบแล้ว',
  sudoku6x6Mistakes: 'ที่ผิด',
  sudoku6x6HintsUsed: 'คำใบ้ที่ใช้',
  sudoku6x6NewBestTime: 'เร็วที่สุดของคุณ',
  sudoku6x6NewBoard: 'กระดานใหม่',
  sudoku6x6DailySection: 'รายวัน',
  sudoku6x6DailiesSolved: 'วันที่ผ่าน',
  sudoku6x6HighlightMistakes: 'แสดงที่ผิด',
  sudoku6x6HighlightMistakesNote: 'ทำเครื่องหมายเลขที่ผิดทันทีที่ใส่ ส่วนเลขซ้ำจะแสดงเสมอ',
  sudoku6x6Step1Title: '1-6 อย่างละหนึ่ง',
  sudoku6x6Step1Body: 'ทุกแถว ทุกหลัก และทุกบล็อก 2×3 มี 1 ถึง 6 อย่างละหนึ่งครั้ง',
  sudoku6x6Step2Title: 'เติมและจดโน้ต',
  sudoku6x6Step2Body: 'เลือกช่องแล้วแตะตัวเลข เปิดโน้ตเพื่อจดตัวเลขที่เป็นไปได้',
  sudoku6x6Step3Title: 'ติดขัด? ใช้คำใบ้',
  sudoku6x6Step3Body: 'คำใบ้จะแสดงช่องถัดไปที่แน่ใจได้ และเพราะอะไร',
};
