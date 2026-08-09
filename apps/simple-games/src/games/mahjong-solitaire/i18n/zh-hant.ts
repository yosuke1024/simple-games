import type { MahjongMessages } from './en';

export const zhHant: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: '麻將接龍牌面，剩餘 {n} 張',
  mahjongTilesLeft: '剩餘 {n} 張',

  mahjongFaceCharacters: '{n} 萬',
  mahjongFaceDots: '{n} 筒',
  mahjongFaceBamboo: '{n} 索',
  mahjongFaceEast: '東風',
  mahjongFaceSouth: '南風',
  mahjongFaceWest: '西風',
  mahjongFaceNorth: '北風',
  mahjongFaceDragonRed: '紅中',
  mahjongFaceDragonGreen: '發財',
  mahjongFaceDragonWhite: '白板',
  mahjongFaceFlower: '花牌 {n}',
  mahjongFaceSeason: '季牌 {n}',

  mahjongTileFree: '{tile}，可以拿取',
  mahjongTileBlocked: '{tile}，被擋住',
  mahjongTileSelected: '{tile}，已選取',

  mahjongStuckTitle: '沒有可配對的牌',
  mahjongStuckBody: '復原幾步，或重試同一牌面——兩者都免費且不限次數。',

  mahjongHintNone: '現在沒有可拿取的配對。',

  mahjongClearTitle: '完成！',
  mahjongClearBody: '所有牌都已取完。',
  mahjongHintsUsed: '使用的提示',
  mahjongNewBestTime: '你的最快紀錄。',

  mahjongLevelsCleared: '通關的關卡',
  mahjongDailiesCleared: '完成的每日挑戰',
  mahjongDailyBacklogHint: '之前的每一天都可以隨時挑戰。',

  mahjongStep1Title: '拿取相同的一對',
  mahjongStep1Body: '點選兩張相同的牌將它們移除。只有上面沒有牌、且左右至少一側空著的牌才能拿取。',
  mahjongStep2Title: '花牌和季牌按組配對',
  mahjongStep2Body: '任何花牌可與任何花牌配對，任何季牌可與任何季牌配對。',
  mahjongStep3Title: '取完整個牌面',
  mahjongStep3Body: '每個牌面都一定能取完。無對可取時可復原或重試——兩者都免費且不限次數。',
};
