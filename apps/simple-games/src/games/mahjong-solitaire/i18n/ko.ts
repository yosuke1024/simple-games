import type { MahjongMessages } from './en';

export const ko: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: '마작 솔리테어 보드, {n}장 남음',
  mahjongTilesLeft: '{n}장 남음',

  mahjongFaceCharacters: '만자 {n}',
  mahjongFaceDots: '통자 {n}',
  mahjongFaceBamboo: '삭자 {n}',
  mahjongFaceEast: '동풍',
  mahjongFaceSouth: '남풍',
  mahjongFaceWest: '서풍',
  mahjongFaceNorth: '북풍',
  mahjongFaceDragonRed: '홍중',
  mahjongFaceDragonGreen: '발',
  mahjongFaceDragonWhite: '백',
  mahjongFaceFlower: '꽃패 {n}',
  mahjongFaceSeason: '계절패 {n}',

  mahjongTileFree: '{tile}, 가져올 수 있음',
  mahjongTileBlocked: '{tile}, 막혀 있음',
  mahjongTileSelected: '{tile}, 선택됨',

  mahjongStuckTitle: '맞출 수 있는 짝이 없습니다',
  mahjongStuckBody:
    '실행 취소로 되돌리거나 같은 보드를 다시 도전하세요. 둘 다 무료이며 제한이 없습니다.',

  mahjongHintNone: '지금 가져올 수 있는 짝이 없습니다.',

  mahjongClearTitle: '클리어!',
  mahjongClearBody: '모든 패를 치웠습니다.',
  mahjongHintsUsed: '사용한 힌트',
  mahjongNewBestTime: '자신의 최고 기록입니다.',

  mahjongLevelsCleared: '클리어한 레벨',
  mahjongDailiesCleared: '클리어한 데일리',
  mahjongDailyBacklogHint: '지난 날짜는 언제든 도전할 수 있습니다.',

  mahjongStep1Title: '같은 패 두 장을 가져오기',
  mahjongStep1Body:
    '같은 그림의 패 두 장을 탭하여 치웁니다. 위에 패가 없고 좌우 중 한쪽이 비어 있는 패만 가져올 수 있습니다.',
  mahjongStep2Title: '꽃패와 계절패는 그룹',
  mahjongStep2Body: '꽃패는 어떤 꽃패와도, 계절패는 어떤 계절패와도 짝이 됩니다.',
  mahjongStep3Title: '보드를 모두 치우기',
  mahjongStep3Body:
    '모든 보드는 반드시 끝까지 치울 수 있습니다. 짝이 없어지면 실행 취소나 재도전을 — 둘 다 무료이며 제한이 없습니다.',
};
