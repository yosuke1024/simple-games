import type { HeartsMessages } from './en';

export const th: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'เลือกคู่ต่อสู้',
  heartsDifficulty_easy: 'ง่าย',
  heartsDifficulty_normal: 'ปานกลาง',
  heartsDifficulty_hard: 'ยาก',
  heartsRecordNote: 'ชนะ {wins} · แพ้ {losses} · เสมอ {draws}',
  heartsConfirmSwitchTitle: 'แทนที่แมตช์ที่ค้างอยู่?',
  heartsConfirmSwitchBody: 'แมตช์ระดับ{current}ของคุณจะถูกแทนที่ด้วยแมตช์ระดับ{next}ใหม่',

  heartsTableLabel: 'โต๊ะ Hearts',
  heartsHandLabel: 'ไพ่ในมือคุณ',
  heartsTrickLabel: 'ไพ่ในตานี้',
  heartsTrayLabel: 'ไพ่ที่คุณจะส่งต่อ',
  heartsYou: 'คุณ',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'คุณ: มือนี้ {hand} แต้ม รวมทั้งแมตช์ {total} แต้ม',
  heartsSeatLabel: 'CPU {n}: ไพ่ {cards} ใบ มือนี้ {hand} แต้ม รวมทั้งแมตช์ {total} แต้ม',
  heartsTookLastTrick: 'ชนะตาที่แล้ว',
  heartsCardLabel: '{rank} {suit}',
  heartsSuit_spades: 'โพดำ',
  heartsSuit_hearts: 'โพแดง',
  heartsSuit_diamonds: 'ข้าวหลามตัด',
  heartsSuit_clubs: 'ดอกจิก',
  heartsCardBlocked: '{card} ตอนนี้ลงไม่ได้',
  heartsCardChosen: '{card} เลือกไว้ส่งต่อ',
  heartsTrickCard: '{card} {seat}',

  heartsPassPrompt: 'เลือกไพ่สามใบเพื่อส่งต่อ',
  heartsPassLeft: 'ส่งไปทางซ้าย',
  heartsPassAcross: 'ส่งไปฝั่งตรงข้าม',
  heartsPassRight: 'ส่งไปทางขวา',
  heartsPassConfirm: 'ส่งสามใบนี้',
  heartsPassWaiting: 'กำลังรอที่นั่งอื่น…',

  heartsPlayPrompt: 'แตะไพ่ แล้วแตะอีกครั้งเพื่อลงไพ่',
  heartsCpuTurn: 'CPU {n} กำลังลงไพ่…',
  heartsTrickYou: 'คุณชนะตานี้',
  heartsTrickCpu: 'CPU {n} ชนะตานี้',

  heartsHandTitle: 'สรุปแต้มของมือนี้',
  heartsMoonTitle: 'เก็บครบทุกแต้ม',
  heartsMoonYou: 'คุณเก็บครบทั้งยี่สิบหกแต้ม อีกสามที่นั่งจึงได้ไปที่นั่งละ 26 แต้ม',
  heartsMoonCpu: 'CPU {n} เก็บครบทั้งยี่สิบหกแต้ม คนอื่นทุกคนจึงได้ไปคนละ 26 แต้ม',
  heartsThisHand: 'มือนี้',
  heartsMatchTotal: 'รวมทั้งแมตช์',
  heartsNextHand: 'มือถัดไป',

  heartsWinTitle: 'คุณชนะ!',
  heartsWinBody: 'ตอนที่มีคนแตะร้อยแต้ม คุณมีแต้มน้อยที่สุด',
  heartsLoseTitle: 'CPU ชนะ',
  heartsLoseBody: 'ที่นั่งอื่นจบด้วยแต้มน้อยกว่า แมตช์ถัดไปเล่นฟรี',
  heartsDrawTitle: 'เสมอ',
  heartsDrawBody: 'คุณจบด้วยแต้มน้อยที่สุดเท่ากับอีกที่นั่งหนึ่ง',
  heartsFinalScores: 'แต้มสุดท้าย',

  heartsWins: 'ชนะ',
  heartsLosses: 'แพ้',
  heartsDraws: 'เสมอ',

  heartsStep1Title: 'ส่งต่อสามใบ',
  heartsStep1Body:
    'ก่อนเริ่มเกือบทุกมือ คุณเลือกไพ่สามใบส่งต่อให้คนอื่น — ทางซ้าย แล้วทางขวา แล้วฝั่งตรงข้าม แล้วมือที่ไม่มีใครส่ง',
  heartsStep2Title: 'ลงตามดอก',
  heartsStep2Body:
    'คนที่ลงใบแรกเป็นคนกำหนดดอก ถ้ายังมีดอกนั้นก็ต้องลงตาม และไพ่ดอกนั้นที่ใหญ่ที่สุดเป็นผู้ชนะตานั้น',
  heartsStep3Title: 'แต้มน้อยที่สุดชนะ',
  heartsStep3Body:
    'โพแดงที่เก็บได้ใบละหนึ่งแต้ม และ Q โพดำสิบสามแต้ม เมื่อมีคนแตะร้อยแต้ม คนที่แต้มน้อยที่สุดจะเป็นผู้ชนะ',
};
