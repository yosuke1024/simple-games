import type { MahjongMessages } from './en';

export const zhHans: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: '麻将连连看牌面，剩余 {n} 张',
  mahjongTilesLeft: '剩余 {n} 张',

  mahjongFaceCharacters: '{n} 万',
  mahjongFaceDots: '{n} 筒',
  mahjongFaceBamboo: '{n} 条',
  mahjongFaceEast: '东风',
  mahjongFaceSouth: '南风',
  mahjongFaceWest: '西风',
  mahjongFaceNorth: '北风',
  mahjongFaceDragonRed: '红中',
  mahjongFaceDragonGreen: '发财',
  mahjongFaceDragonWhite: '白板',
  mahjongFaceFlower: '花牌 {n}',
  mahjongFaceSeason: '季牌 {n}',

  mahjongTileFree: '{tile}，可以拿取',
  mahjongTileBlocked: '{tile}，被挡住',
  mahjongTileSelected: '{tile}，已选中',

  mahjongStuckTitle: '没有可配对的牌',
  mahjongStuckBody: '撤销几步，或重试同一牌面——两者都免费且不限次数。',

  mahjongHintNone: '现在没有可拿取的配对。',

  mahjongClearTitle: '完成！',
  mahjongClearBody: '所有牌都已取完。',
  mahjongHintsUsed: '使用的提示',
  mahjongNewBestTime: '你的最快纪录。',

  mahjongLevelsCleared: '通关的关卡',
  mahjongDailiesCleared: '完成的每日挑战',
  mahjongDailyBacklogHint: '之前的每一天都可以随时挑战。',

  mahjongStep1Title: '拿取相同的一对',
  mahjongStep1Body: '点击两张相同的牌将它们移除。只有上面没有牌、且左右至少一侧空着的牌才能拿取。',
  mahjongStep2Title: '花牌和季牌按组配对',
  mahjongStep2Body: '任意花牌可与任意花牌配对，任意季牌可与任意季牌配对。',
  mahjongStep3Title: '取完整个牌面',
  mahjongStep3Body: '每个牌面都一定能取完。无对可取时可撤销或重试——两者都免费且不限次数。',
};
