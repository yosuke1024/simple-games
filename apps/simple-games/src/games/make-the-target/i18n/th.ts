/**
 * Thai catalog for Make the Target — written by AI from the English source on
 * 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = โจทย์, target = เป้าหมาย (not ประตู or คะแนน), solution =
 * วิธีแก้, the result of one move = ผลลัพธ์ (not คำตอบ, which would blur it with
 * the solution). Division is read "หารด้วย", left term first. Shared words
 * follow the shell and Bridges (ง่าย / ปานกลาง / ยาก, รายวัน, วันที่ทำสำเร็จ);
 * like them, sentences end without a full stop.
 */
import type { MakeTheTargetMessages } from './en';

export const th: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'เลือกระดับความยาก',
  makeTheTargetDifficulty_easy: 'ง่าย',
  makeTheTargetDifficulty_medium: 'ปานกลาง',
  makeTheTargetDifficulty_hard: 'ยาก',
  makeTheTargetTierNote_easy: 'ตัวเลข 4 ตัว',
  makeTheTargetTierNote_medium: 'ตัวเลข 4 หรือ 5 ตัว',
  makeTheTargetTierNote_hard: 'ตัวเลข 5 ตัว',
  makeTheTargetConfirmSwitchTitle: 'แทนที่โจทย์ที่กำลังเล่นอยู่หรือไม่?',
  makeTheTargetConfirmSwitchBody:
    'โจทย์ระดับ {current} ที่เล่นอยู่จะถูกแทนที่ด้วยโจทย์ใหม่ระดับ {next}',
  makeTheTargetNumbersLabel: 'ตัวเลข',
  makeTheTargetTargetSpoken: 'เป้าหมาย {target}',
  makeTheTargetTargetLabel: 'เป้าหมาย',
  makeTheTargetOperatorsLabel: 'เครื่องหมายคำนวณ',
  makeTheTargetOp_add: 'บวก',
  makeTheTargetOp_subtract: 'ลบ',
  makeTheTargetOp_multiply: 'คูณ',
  makeTheTargetOp_divide: 'หาร',
  makeTheTargetSpokenLine_add: '{left} บวก {right} เท่ากับ {result}',
  makeTheTargetSpokenLine_subtract: '{left} ลบ {right} เท่ากับ {result}',
  makeTheTargetSpokenLine_multiply: '{left} คูณ {right} เท่ากับ {result}',
  makeTheTargetSpokenLine_divide: '{left} หารด้วย {right} เท่ากับ {result}',
  makeTheTargetSpokenUndo: 'ย้อนกลับแล้ว: {line}',
  makeTheTargetStepsLabel: 'ขั้นตอนที่ทำไปแล้ว',
  makeTheTargetMissed: 'ผลคือ {value} ไม่ใช่ {target}',
  makeTheTargetSpokenMissed: '{line} ผลคือ {value} ไม่ใช่ {target}',
  makeTheTargetShowSolution: 'ดูวิธีแก้หนึ่งแบบ',
  makeTheTargetRevealTitle: 'ดูวิธีแก้หนึ่งแบบไหม?',
  makeTheTargetRevealBody: 'โจทย์นี้จะจบตรงนี้ และไม่นับว่าแก้ได้',
  makeTheTargetRevealConfirm: 'ดู',
  makeTheTargetSolvedTitle: 'ได้ตัวเลขเป้าหมายแล้ว',
  makeTheTargetRevealedTitle: 'วิธีหนึ่งที่จะได้ {target}',
  makeTheTargetSolutionLabel: 'วิธีแก้หนึ่งแบบ',
  makeTheTargetNewBoard: 'โจทย์ใหม่',
  makeTheTargetNewBestTime: 'เร็วที่สุดของคุณ',
  makeTheTargetSolvedCount: 'โจทย์ที่แก้ได้',
  makeTheTargetDailySection: 'รายวัน',
  makeTheTargetDailiesCleared: 'วันที่ทำสำเร็จ',
  makeTheTargetAllModes: 'ทุกโหมด',
  makeTheTargetStep1Title: 'รวมสองตัว',
  makeTheTargetStep1Body:
    'แตะตัวเลข แล้วแตะ + − × หรือ ÷ แล้วแตะตัวเลขอีกตัว ตัวที่แตะก่อนจะอยู่ทางซ้าย',
  makeTheTargetStep2Title: 'ตัวเลขใหม่',
  makeTheTargetStep2Body:
    'สองตัวนั้นถูกใช้ไป และผลลัพธ์ (จำนวนเต็มที่มากกว่าศูนย์เสมอ) จะเข้ามาแทนที่',
  makeTheTargetStep3Title: 'ให้ตรงกับเป้าหมาย',
  makeTheTargetStep3Body: 'ใช้ตัวเลขให้ครบทุกตัว เมื่อตัวสุดท้ายเท่ากับเป้าหมาย ก็แก้โจทย์ได้แล้ว',
};
