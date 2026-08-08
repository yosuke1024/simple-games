import type { MahjongMessages } from './en';

export const ja: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: '麻雀ソリティアの盤面、残り {n} 枚',
  mahjongTilesLeft: '残り {n} 枚',

  mahjongFaceCharacters: '萬子の {n}',
  mahjongFaceDots: '筒子の {n}',
  mahjongFaceBamboo: '索子の {n}',
  mahjongFaceEast: '東',
  mahjongFaceSouth: '南',
  mahjongFaceWest: '西',
  mahjongFaceNorth: '北',
  mahjongFaceDragonRed: '中',
  mahjongFaceDragonGreen: '發',
  mahjongFaceDragonWhite: '白',
  mahjongFaceFlower: '花牌の {n}',
  mahjongFaceSeason: '季節牌の {n}',

  mahjongTileFree: '{tile}・取れます',
  mahjongTileBlocked: '{tile}・取れません',
  mahjongTileSelected: '{tile}・選択中',

  mahjongStuckTitle: '取れる組がありません',
  mahjongStuckBody: 'Undo で戻るか、同じ盤面に再挑戦できます。どちらも無料・無制限です。',

  mahjongHintNone: 'いま取れる組はありません。',

  mahjongClearTitle: 'クリア!',
  mahjongClearBody: 'すべての牌を取りきりました。',
  mahjongHintsUsed: '使ったヒント',
  mahjongNewBestTime: '自己最速です。',

  mahjongLevelsCleared: 'クリアしたレベル',
  mahjongDailiesCleared: 'クリアしたデイリー',
  mahjongDailyBacklogHint: '過去の日はいつでも挑戦できます。',

  mahjongStep1Title: '同じ牌を 2 枚取る',
  mahjongStep1Body:
    '同じ牌面の 2 枚をタップして取ります。上に牌が載っておらず、左右どちらかが空いている牌だけが取れます。',
  mahjongStep2Title: '花と季節はグループ',
  mahjongStep2Body: '花牌はどの花牌とも、季節牌はどの季節牌とも組にできます。',
  mahjongStep3Title: '盤面を取りきる',
  mahjongStep3Body:
    'どの盤面も必ず取りきれます。組がなくなったら Undo か再挑戦を — どちらも無料・無制限です。',
};
