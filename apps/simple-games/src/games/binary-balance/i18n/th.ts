/**
 * th catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same.
 */
import type { BinaryBalanceMessages } from './en';

export const th: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'เลือกกระดาน',
  binaryBalanceDifficulty_easy: 'ง่าย',
  binaryBalanceDifficulty_medium: 'ปานกลาง',
  binaryBalanceDifficulty_hard: 'ยาก',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'แทนที่กระดานที่ค้างอยู่ไหม',
  binaryBalanceConfirmSwitchBody: 'เกม {current} ที่ค้างอยู่จะถูกแทนที่ด้วยกระดาน {next} ใหม่',
  binaryBalanceBoardLabel: 'กระดาน Binary Balance {size}×{size}',
  binaryBalanceCellEmpty: 'ว่าง แถว {row} คอลัมน์ {col}',
  binaryBalanceCellCircle: 'วงกลม แถว {row} คอลัมน์ {col}',
  binaryBalanceCellSquare: 'สี่เหลี่ยม แถว {row} คอลัมน์ {col}',
  binaryBalanceCellFixedCircle: 'วงกลมตั้งต้น แถว {row} คอลัมน์ {col}',
  binaryBalanceCellFixedSquare: 'สี่เหลี่ยมตั้งต้น แถว {row} คอลัมน์ {col}',
  binaryBalanceLinkSameRight: 'เหมือนช่องทางขวา',
  binaryBalanceLinkDiffRight: 'ต่างจากช่องทางขวา',
  binaryBalanceLinkSameBelow: 'เหมือนช่องด้านล่าง',
  binaryBalanceLinkDiffBelow: 'ต่างจากช่องด้านล่าง',
  binaryBalanceRuleBroken: 'ผิดกติกา',
  binaryBalanceMarkCircle: 'วงกลม',
  binaryBalanceMarkSquare: 'สี่เหลี่ยม',
  binaryBalanceHintViolation: 'ช่องที่เน้นผิดกติกา',
  binaryBalanceHintWrong: 'เครื่องหมายที่มีเส้นขอบไม่ถูกต้อง',
  binaryBalanceHintPairGap: 'คู่ที่ระบายสีจะทำให้เกิดสามช่องติด ช่องที่มีเส้นขอบจึงเป็น{mark}',
  binaryBalanceHintLineCount:
    'แถวหรือคอลัมน์ที่เน้นมีเครื่องหมายที่ระบายสีครบครึ่งแล้ว ช่องที่มีเส้นขอบจึงเป็น{mark}',
  binaryBalanceHintLinkSame:
    'เครื่องหมาย = เชื่อมช่องที่มีเส้นขอบกับช่องที่ระบายสี ช่องนี้จึงเป็น{mark}เหมือนกัน',
  binaryBalanceHintLinkDiff:
    'เครื่องหมาย × เชื่อมช่องที่มีเส้นขอบกับช่องที่ระบายสี ช่องนี้จึงเป็นเครื่องหมายอีกแบบ คือ{mark}',
  binaryBalanceHintLineCompletion:
    'ไม่ว่าจะเติมแถวหรือคอลัมน์ที่เน้นอย่างไร ช่องที่มีเส้นขอบก็เป็น{mark}',
  binaryBalanceHintHypothesis:
    'ถ้าช่องที่มีเส้นขอบเป็น{other} ตาต่อไปจะผิดกติกา ช่องนี้จึงเป็น{mark}',
  binaryBalanceHintNone: 'ตอนนี้ยังไม่พบตาเดินที่แน่นอน',
  binaryBalanceSolvedTitle: 'สำเร็จ!',
  binaryBalanceSolvedBody: 'ทุกแถวและทุกคอลัมน์สมดุล และทุกตัวเชื่อมถูกต้อง',
  binaryBalanceHintsUsed: 'คำใบ้ที่ใช้',
  binaryBalanceNewBestTime: 'เร็วที่สุดของคุณ',
  binaryBalanceNewBoard: 'กระดานใหม่',
  binaryBalanceDailySection: 'เดลี่',
  binaryBalanceDailiesSolved: 'จำนวนวันที่ผ่าน',
  binaryBalanceDailyBacklogHint: 'วันก่อนหน้าเปิดให้เล่นเสมอ',
  binaryBalanceStep1Title: 'ห้ามซ้ำสามช่องติด',
  binaryBalanceStep1Body:
    'แตะเพื่อสลับระหว่างว่าง วงกลม สี่เหลี่ยม เครื่องหมายเดียวกันห้ามติดกันสามช่อง',
  binaryBalanceStep2Title: 'ครึ่งต่อครึ่ง',
  binaryBalanceStep2Body: 'ทุกแถวและทุกคอลัมน์มีวงกลมกับสี่เหลี่ยมจำนวนเท่ากัน',
  binaryBalanceStep3Title: 'ทำตามตัวเชื่อม',
  binaryBalanceStep3Body:
    'ช่องที่เชื่อมด้วย = เหมือนกัน ช่องที่เชื่อมด้วย × ต่างกัน ติดอยู่ใช่ไหม ขอคำใบ้ได้',
};
