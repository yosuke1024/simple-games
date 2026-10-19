/**
 * Peg Solitaire — the Thai catalog. Provenance (docs/PEG_SOLITAIRE_RULES.md
 * §15): `machine` — written by an AI from the English source; no native
 * speaker has read it. The title (`pegSolitaireName`) is a proper noun and
 * stays as-is. The English board is "แบบอังกฤษ" (English style), so the
 * button does not read as the name of a language.
 */
import type { PegSolitaireMessages } from './en';

export const th: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'แบบอังกฤษ',
  pegSolitaireBoard_triangle: 'สามเหลี่ยม',
  pegSolitaireBoardLabel_english: 'กระดานแบบอังกฤษ 33 หลุม',
  pegSolitaireBoardLabel_triangle: 'กระดานสามเหลี่ยม 15 หลุม',
  pegSolitaireHoleCount: '{count} หลุม',

  pegSolitaireChooseBoard: 'เลือกกระดาน',
  pegSolitaireBestNote: 'เหลือน้อยสุด: {count}',
  pegSolitaireConfirmSwitchTitle: 'แทนที่เกมที่ค้างอยู่?',
  pegSolitaireConfirmSwitchBody:
    'เกมบนกระดาน{current}ที่ค้างอยู่จะถูกแทนที่ด้วยเกมใหม่บนกระดาน{next}',

  pegSolitaireHoleGrid: 'แถว {row} คอลัมน์ {col}: {content}',
  pegSolitaireHoleRow: 'แถว {row} หลุมที่ {place}: {content}',
  pegSolitaireContentPeg: 'มีหมุด',
  pegSolitaireContentPegRing: 'มีหมุด ในหลุมที่มีวงแหวน',
  pegSolitaireContentEmpty: 'ว่าง',
  pegSolitaireContentEmptyRing: 'ว่าง หลุมที่มีวงแหวน',
  pegSolitaireContentLanding: 'ว่าง กระโดดมาลงที่นี่ได้',
  pegSolitaireContentLandingRing: 'ว่าง หลุมที่มีวงแหวน กระโดดมาลงที่นี่ได้',

  pegSolitairePegsLeft: 'หมุดที่เหลือ: {count}',
  pegSolitaireNoJump: 'ตอนนี้หมุดนี้กระโดดไม่ได้',

  pegSolitairePerfectTitle: 'เคลียร์สมบูรณ์!',
  pegSolitairePerfectBody: 'หมุดตัวสุดท้ายอยู่ในหลุมที่มีวงแหวน',
  pegSolitaireSingleTitle: 'เหลือหมุด 1 ตัว',
  pegSolitaireSingleBody: 'หมุดตัวสุดท้ายอยู่นอกหลุมที่มีวงแหวน',
  pegSolitaireStuckTitle: 'ไม่มีทางกระโดดแล้ว',
  pegSolitaireStuckBody: 'ไม่มีหมุดตัวไหนกระโดดได้อีก',
  pegSolitairePegsLeftLabel: 'หมุดที่เหลือ',
  pegSolitaireFewestLabel: 'น้อยสุดบนกระดานนี้',
  pegSolitaireNewFewest: 'น้อยกว่าทุกครั้งบนกระดานนี้',
  pegSolitaireBoardFact: 'กระดาน',
  pegSolitaireNewBoard: 'กระดานใหม่',

  pegSolitaireStatFewest: 'หมุดเหลือน้อยที่สุด',
  pegSolitaireStatPerfect: 'เคลียร์สมบูรณ์',

  pegSolitaireStep1Title: 'กระโดดแล้วเก็บออก',
  pegSolitaireStep1Body: 'ให้หมุดกระโดดข้ามหมุดข้างๆ ลงหลุมว่าง — หมุดที่ถูกข้ามจะถูกเก็บออก',
  pegSolitaireStep2Title: 'เป็นเส้นตรงเท่านั้น',
  pegSolitaireStep2Body:
    'กระโดดเป็นเส้นตรง: แบบอังกฤษไปทางบน ล่าง และด้านข้าง สามเหลี่ยมไปตามเส้นทั้งสามแนว',
  pegSolitaireStep3Title: 'เหลือตัวสุดท้าย',
  pegSolitaireStep3Body:
    'เมื่อไม่มีหมุดกระโดดได้ เกมจะจบ — ให้หมุดตัวสุดท้ายอยู่ในหลุมที่มีวงแหวนเพื่อเคลียร์สมบูรณ์',
};
