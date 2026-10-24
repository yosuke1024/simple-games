/**
 * Thai catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * สโคปา / พรีมิเอรา / 7♦ / ข้าวหลามตัด / ไพ่ / เก็บ / วาง / คนแจก / มือ / แมตช์.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 * Sentences are separated by a space, as Thai writes them, not by a full
 * stop (`scopaSayThen`).
 */
import type { ScopaMessages } from './en';

export const th: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'เก็บ',
  scopaStep1Body:
    'ลงไพ่หนึ่งใบ แล้วเก็บไพ่บนโต๊ะที่มีค่าเท่ากันหนึ่งใบ หรือถ้าไม่มี ก็เก็บไพ่ที่รวมกันได้เท่าค่านั้น',
  scopaStep2Title: 'วาง หรือเก็บหมดโต๊ะ',
  scopaStep2Body:
    'ไพ่ที่เก็บอะไรไม่ได้จะถูกวางบนโต๊ะ และถ้าเก็บไพ่บนโต๊ะได้หมดจะได้หนึ่งแต้ม เรียกว่าสโคปา',
  scopaStep3Title: 'สิบเอ็ดแต้มชนะ',
  scopaStep3Body:
    'แต่ละมือให้หนึ่งแต้มกับไพ่มากที่สุด ข้าวหลามตัดมากที่สุด 7♦ และพรีมิเอรา และใครได้ 11 แต้มขึ้นไปโดยนำอยู่จะชนะ',

  scopaYou: 'คุณ',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'โพดำ',
  scopaSuit_hearts: 'โพแดง',
  scopaSuit_diamonds: 'ข้าวหลามตัด',
  scopaSuit_clubs: 'ดอกจิก',
  scopaCardLabel: '{face} {suit}',

  scopaTableLabel: 'โต๊ะ',
  scopaHandLabel: 'ไพ่ในมือคุณ',
  scopaHandCanTake: '{card} เก็บได้',
  scopaHandCannotTake: '{card} ตอนนี้เก็บไม่ได้',
  scopaTableCanTake: '{card} ใบนี้เก็บได้',
  scopaTableInGroup: '{card} อยู่ในชุดที่เลือก',
  scopaPlaceHere: 'วางที่นี่',
  scopaStockLabel: 'กองไพ่ เหลือ {n} ใบ',

  scopaCpuHandLabel: 'ไพ่ในมือ CPU {n} ใบ',
  scopaBandLabel:
    '{who}: รวมทั้งแมตช์ {score} แต้ม มือนี้: ไพ่ {cards} ใบ ข้าวหลามตัด {diamonds} ใบ สโคปา {scopas} ครั้ง{settebello}{dealer}',
  scopaBandSettebello: ' มี 7♦',
  scopaBandDealer: ' เป็นคนแจก',
  scopaPrimieraLabel: 'พรีมิเอราของคุณ: {total}',
  scopaPrimieraSuit: '{suit}: {card} ค่า {value}',
  scopaPrimieraMissing: '{suit}: ยังไม่มี',

  scopaLineYourTurn: 'ตาของคุณ: ลงไพ่หนึ่งใบ',
  scopaLineCpuTurn: 'ตาของ CPU',
  scopaLineDealing: 'กำลังแจกคนละสามใบ',
  scopaLinePlace: 'ใบนี้เก็บอะไรไม่ได้: วางลง หรือเลือกใบอื่น',
  scopaLineTakeOne: 'แตะอีกครั้งเพื่อเก็บ',
  scopaLineChooseSame: 'เลือกใบที่จะเก็บ',
  scopaLineBuildSum: 'เลือกไพ่ที่รวมกันได้ {n} (ตอนนี้ {sum})',
  scopaLineCpuTook: 'CPU เก็บ',
  scopaLineCpuPlaced: 'CPU วาง',
  scopaLineScopaYou: 'สโคปา: คุณเก็บหมดโต๊ะ',
  scopaLineScopaCpu: 'สโคปา: CPU เก็บหมดโต๊ะ',
  scopaLineSweepYou: 'ไพ่ที่เหลือบนโต๊ะ: เป็นของคุณ',
  scopaLineSweepCpu: 'ไพ่ที่เหลือบนโต๊ะ: เป็นของ CPU',
  scopaSayCpuTook: 'CPU ลง {card} และเก็บ {cards}',
  scopaSayCpuPlaced: 'CPU วาง {card}',
  scopaSaySweepYou: 'คุณเก็บไพ่ที่เหลือบนโต๊ะ: {cards}',
  scopaSaySweepCpu: 'CPU เก็บไพ่ที่เหลือบนโต๊ะ: {cards}',

  scopaSayThen: '{first} {then}',

  scopaDealTitle: 'มือที่ {n}',
  scopaColCategory: 'หมวด',
  scopaColPoint: 'แต้ม',
  scopaCatCards: 'ไพ่',
  scopaCatDiamonds: 'ข้าวหลามตัด',
  scopaCatPrimiera: 'พรีมิเอรา',
  scopaCatScopa: 'สโคปา',
  scopaPrimieraShort: '{total} ({suits} จาก 4 ดอก)',
  scopaDealPoints: 'มือนี้',
  scopaSweepYou: 'ไพ่ที่เหลือบนโต๊ะซึ่งคุณเก็บ: {n} ใบ',
  scopaSweepCpu: 'ไพ่ที่เหลือบนโต๊ะซึ่ง CPU เก็บ: {n} ใบ',
  scopaNextDeal: 'มือถัดไป',

  scopaWinTitle: 'คุณชนะแมตช์นี้',
  scopaLoseTitle: 'CPU ชนะแมตช์นี้',
  scopaDecidingDeal: 'มือสุดท้าย',

  scopaRecordNote: 'ชนะ {wins} · แพ้ {losses}',
  scopaWins: 'ชนะ',
  scopaLosses: 'แพ้',
};
