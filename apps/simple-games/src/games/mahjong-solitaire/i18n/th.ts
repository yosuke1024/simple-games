import type { MahjongMessages } from './en';

export const th: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'กระดานไพ่นกกระจอก เหลือ {n} ไทล์',
  mahjongTilesLeft: 'เหลือ {n} ไทล์',

  mahjongFaceCharacters: 'อักษร {n}',
  mahjongFaceDots: 'วงกลม {n}',
  mahjongFaceBamboo: 'ไผ่ {n}',
  mahjongFaceEast: 'ลมตะวันออก',
  mahjongFaceSouth: 'ลมใต้',
  mahjongFaceWest: 'ลมตะวันตก',
  mahjongFaceNorth: 'ลมเหนือ',
  mahjongFaceDragonRed: 'มังกรแดง',
  mahjongFaceDragonGreen: 'มังกรเขียว',
  mahjongFaceDragonWhite: 'มังกรขาว',
  mahjongFaceFlower: 'ดอกไม้ {n}',
  mahjongFaceSeason: 'ฤดู {n}',

  mahjongTileFree: '{tile} หยิบได้',
  mahjongTileBlocked: '{tile} ถูกขวางอยู่',
  mahjongTileSelected: '{tile} เลือกอยู่',

  mahjongStuckTitle: 'ไม่มีคู่ที่หยิบได้',
  mahjongStuckBody: 'เลิกทำบางตา หรือลองกระดานเดิมอีกครั้ง — ทั้งสองอย่างฟรีและไม่จำกัด',

  mahjongHintNone: 'ตอนนี้ไม่มีคู่ที่หยิบได้',

  mahjongClearTitle: 'สำเร็จ!',
  mahjongClearBody: 'เก็บไทล์ออกจากกระดานได้ทั้งหมดแล้ว',
  mahjongHintsUsed: 'คำใบ้ที่ใช้',
  mahjongNewBestTime: 'เวลาที่เร็วที่สุดของคุณ',

  mahjongLevelsCleared: 'ด่านที่ผ่านแล้ว',
  mahjongDailiesCleared: 'รายวันที่ผ่านแล้ว',
  mahjongDailyBacklogHint: 'วันก่อนหน้าทั้งหมดยังเปิดอยู่เสมอ',

  mahjongStep1Title: 'หยิบคู่ที่เหมือนกัน',
  mahjongStep1Body:
    'แตะไทล์หน้าเดียวกันสองอันเพื่อเก็บออก ไทล์จะหยิบได้เมื่อไม่มีอะไรทับอยู่และด้านซ้ายหรือขวาว่าง',
  mahjongStep2Title: 'ดอกไม้และฤดูเป็นกลุ่ม',
  mahjongStep2Body: 'ดอกไม้ใดก็จับคู่กับดอกไม้ใดก็ได้ และฤดูใดก็จับคู่กับฤดูใดก็ได้',
  mahjongStep3Title: 'เก็บให้หมดกระดาน',
  mahjongStep3Body:
    'ทุกกระดานเก็บหมดได้เสมอ ถ้าไม่มีคู่เหลือ ให้เลิกทำหรือลองใหม่ — ทั้งสองอย่างฟรีและไม่จำกัด',
};
