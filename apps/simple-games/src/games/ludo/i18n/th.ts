import type { LudoMessages } from './en';

export const th: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'เลือกคู่แข่ง',
  ludoDifficulty_easy: 'ง่าย',
  ludoDifficulty_normal: 'ปานกลาง',
  ludoDifficulty_hard: 'ยาก',
  ludoRecordNote: 'ชนะ {wins} · แพ้ {losses}',
  ludoConfirmSwitchTitle: 'แทนที่แมตช์ที่ค้างอยู่?',
  ludoConfirmSwitchBody: 'แมตช์ระดับ{current}ของคุณจะถูกแทนที่ด้วยแมตช์ระดับ{next}ใหม่',

  // ---- the board ----
  ludoBoardLabel: 'กระดาน Ludo',
  ludoYou: 'คุณ',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: 'เข้าบ้านแล้ว {home} จาก 4',
  ludoSafeSquare: 'ช่องปลอดภัย',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'ในคอก',
  ludoWhereSquare: 'ที่ช่อง {n}',
  ludoWhereSafe: 'ที่ช่องปลอดภัย {n}',
  ludoWhereColumn: 'ที่ช่อง {n} ในทางเข้าบ้าน',
  ludoWhereHome: 'เข้าบ้านแล้ว',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'เดินหมากของคุณที่{where}',

  // ---- the die and the turn ----
  ludoRollAction: 'ทอย',
  ludoRollLabel: 'ทอยลูกเต๋า',
  ludoDieLabel: 'ลูกเต๋าออก {die}',
  ludoDieUnrolled: 'ยังไม่ได้ทอยลูกเต๋า',
  ludoTurnRoll: 'ตาคุณ — ทอยลูกเต๋า',
  ludoTurnMove: 'คุณทอยได้ {die} แตะหมากตัวหนึ่งเพื่อเดิน',
  ludoTurnCpu: 'CPU {n} กำลังเล่น…',
  ludoAutoPass: 'ไม่มีหมากตัวไหนเดินได้ด้วยแต้มนี้ — ข้ามตา',
  ludoThirdSix: 'ออกเลข 6 สามครั้งติดกัน — ตานี้ผ่านไป',
  ludoRollAgain: 'ออกเลข 6 — ทอยอีกครั้ง',

  // ---- the end of a match ----
  ludoWinTitle: 'คุณชนะ!',
  ludoWinBody: 'หมากทั้งสี่ตัวของคุณเข้าบ้านครบแล้ว',
  ludoLoseTitle: 'CPU {n} ชนะ',
  ludoLoseBody: 'หมากทั้งสี่ตัวของฝ่ายนั้นเข้าบ้านครบแล้ว แมตช์ถัดไปเล่นฟรี',
  ludoNoContestTitle: 'ไม่มีผลแพ้ชนะ',
  ludoNoContestBody:
    'แมตช์นี้ทอยครบตามจำนวนสูงสุดโดยไม่มีใครเข้าบ้านเลย นับเป็นแมตช์ที่เล่นแล้ว แต่ไม่นับแพ้และไม่นับชนะ',
  ludoWins: 'ชนะ',
  ludoLosses: 'แพ้',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'ออกเลข 6 หมากจึงออกจากคอกได้',
  ludoStep1Body:
    'ทอยลูกเต๋าแล้วแตะหมากตัวหนึ่งเพื่อเดิน แตะได้เฉพาะหมากที่กติกาอนุญาตเท่านั้น ตัวอื่นจะอยู่ที่เดิม',
  ludoStep2Title: 'ออกเลข 6 ได้ทอยอีกครั้ง',
  ludoStep2Body:
    'ทอยได้เลข 6 คุณจะได้ทอยอีกครั้ง แต่ถ้าออกเลข 6 สามครั้งติดกัน ตานั้นจะผ่านไปโดยไม่มีการเดินหมากเลย',
  ludoStep3Title: 'เดินไปทับฝ่ายตรงข้ามจะส่งกลับคอก',
  ludoStep3Body:
    'หมากฝ่ายตรงข้ามทุกตัวในช่องนั้นจะกลับไปที่คอกทันที ช่องปลอดภัยไม่โดนผลนี้ การกินหมากไม่ทำให้ได้ทอยเพิ่ม — มีแค่เลข 6 เท่านั้นที่ให้ทอยเพิ่ม',
  ludoStep4Title: 'ซ้อนหมากตัวเองไม่ได้ช่วยป้องกันอะไร',
  ludoStep4Body:
    'หมากของคุณสองตัวในช่องเดียวกันไม่ปิดทางใครและไม่ป้องกันอะไรเลย ถ้าฝ่ายตรงข้ามเดินมาทับช่องนั้น หมากที่ซ้อนกันทั้งหมดจะกลับคอกพร้อมกัน กองหมากจึงเป็นเป้า ไม่ใช่ป้อมปราการ',
  ludoStep5Title: 'เข้าบ้านต้องได้แต้มพอดี',
  ludoStep5Body:
    'ถ้าแต้มที่ทอยได้เกินบ้าน หมากตัวนั้นจะเดินไม่ได้เลย นำหมากทั้งสี่ตัวเข้าบ้านให้ครบเพื่อชนะ ทุกแต้มมาจาก seed ของแมตช์ ทั้งหกแต้มมีโอกาสออกเท่ากัน และไม่มีที่นั่งใดถูกทอยต่างจากที่นั่งอื่น',
};
