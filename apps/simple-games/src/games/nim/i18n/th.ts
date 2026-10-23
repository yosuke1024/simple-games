/** AI-authored translation draft; no human review claimed. See docs/NIM_RULES.md. */
import type { NimMessages } from './en';
export const th: NimMessages = {
  nimName: 'Nim',
  nimMode_easy: 'ง่าย',
  nimMode_normal: 'ปกติ',
  nimMode_hard: 'ยาก',
  nimRow: 'แถว {row}: หิน {count} ก้อน',
  nimTake: 'หยิบ {count} ก้อน',
  nimYourTurn: 'ตาของคุณ',
  nimCpuTurn: 'ตาของ CPU',
  nimPaused: 'หยุดชั่วคราว เล่นต่อเมื่อพร้อม',
  nimLastMove: 'ตาล่าสุด: หยิบ {count} ก้อนจากแถว {row}',
  nimGoal: 'หยิบหินก้อนสุดท้ายเพื่อชนะ',
  nimChooseRow: 'เลือกหนึ่งแถว',
  nimChooseCount: 'เลือกจำนวนที่ต้องการหยิบ',
  nimWon: 'คุณชนะ!',
  nimLost: 'CPU ชนะ',
  nimOpponent: 'คู่แข่ง',
  nimWins: 'ชนะ',
  nimLosses: 'แพ้',
  nimStep1Title: 'เลือกหนึ่งแถว',
  nimStep1Body: 'เลือกแถวที่มีหิน คุณเป็นผู้เริ่มก่อนเสมอ',
  nimStep2Title: 'หยิบอย่างน้อยหนึ่งก้อน',
  nimStep2Body: 'เลือกจำนวนหินที่จะหยิบจากแถวนั้น แล้วยืนยัน',
  nimStep3Title: 'หยิบก้อนสุดท้าย',
  nimStep3Body:
    'คุณกับ CPU ผลัดกันหยิบ ผู้ที่หยิบก้อนสุดท้ายชนะ ย้อนกลับจะยกเลิกทั้งตาของคุณและการตอบของ CPU',
};
