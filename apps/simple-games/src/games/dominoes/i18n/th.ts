import type { DominoesMessages } from './en';

export const th: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: 'ชนะ {wins} · แพ้ {losses}',

  dominoesTileLabel: 'โดมิโน {a}–{b}',
  dominoesLineLabel: 'แถวการเล่น: {count} ตัว ปลายซ้าย {left} ปลายขวา {right}',
  dominoesHandLabel: 'โดมิโนของคุณ',
  dominoesPlayLeft: 'วางที่ปลายซ้าย ({value})',
  dominoesPlayRight: 'วางที่ปลายขวา ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'กองจั่ว',
  dominoesCpuTiles: 'CPU ถือโดมิโน {count} ตัว',
  dominoesBoneyardTiles: 'กองจั่ว: {count} ตัว',
  dominoesDraw: 'จั่ว',
  dominoesPass: 'ผ่าน',

  dominoesYourTurn: 'ตาของคุณ',
  dominoesCpuTurn: 'CPU กำลังคิด…',
  dominoesCpuDrew: 'CPU จั่วโดมิโนหนึ่งตัว',
  dominoesCpuPassed: 'CPU ผ่านตา ตาของคุณ',
  dominoesMustDraw: 'ไม่มีตัวที่วางได้ ให้จั่วจากกองจั่ว',
  dominoesNoTileFits: 'ไม่มีตัวที่วางได้และกองจั่วก็หมดแล้ว ให้ผ่าน',
  dominoesChooseEnd: 'เลือกปลายที่จะวางตัวนี้',
  dominoesOpenedYou: 'คุณเปิดเกมด้วย {tile}',
  dominoesOpenedCpu: 'CPU เปิดเกมด้วย {tile} ตาของคุณ',

  dominoesWinTitle: 'คุณชนะ!',
  dominoesWinBodyOut: 'คุณวางตัวสุดท้ายหมดแล้ว',
  dominoesWinBodyBlocked: 'ไม่มีใครวางได้ และแต้มของคุณน้อยกว่า',
  dominoesLoseTitle: 'CPU ชนะ',
  dominoesLoseBodyOut: 'CPU วางตัวสุดท้ายหมดแล้ว',
  dominoesLoseBodyBlocked: 'ไม่มีใครวางได้ และแต้มของ CPU น้อยกว่า',
  dominoesDrawTitle: 'เสมอ',
  dominoesDrawBody: 'ไม่มีใครวางได้ และแต้มเท่ากัน',
  dominoesScoreYou: 'คุณได้ {points} แต้ม',
  dominoesScoreCpu: 'CPU ได้ {points} แต้ม',
  dominoesPipsLeft: 'แต้มที่เหลือ: คุณ {you}, CPU {cpu}',

  dominoesWins: 'ชนะ',
  dominoesLosses: 'แพ้',
  dominoesDraws: 'เสมอ',

  dominoesStep1Title: 'จับคู่ที่ปลายด้านใดด้านหนึ่ง',
  dominoesStep1Body: 'วางตัวที่มีตัวเลขตรงกับปลายด้านใดด้านหนึ่งที่เปิดอยู่ของแถว',
  dominoesStep2Title: 'ติดหรือเปล่า? จั่ว',
  dominoesStep2Body:
    'ถ้าไม่มีตัวที่วางได้ ให้จั่วจากกองจั่วไปเรื่อยๆ จนกว่าจะได้ตัวที่วางได้ ผ่านได้เมื่อกองจั่วหมดเท่านั้น',
  dominoesStep3Title: 'วางหมดก่อนคือชนะ',
  dominoesStep3Body: 'วางตัวสุดท้ายเพื่อชนะ แต้มที่เหลือในมืออีกฝ่ายคือคะแนนของคุณ',
};
