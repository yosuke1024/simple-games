import type { MahjongMessages } from './en';

export const vi: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Bàn mạt chược, còn {n} quân',
  mahjongTilesLeft: 'Còn {n} quân',

  mahjongFaceCharacters: 'Vạn {n}',
  mahjongFaceDots: 'Sách {n}',
  mahjongFaceBamboo: 'Tre {n}',
  mahjongFaceEast: 'Gió Đông',
  mahjongFaceSouth: 'Gió Nam',
  mahjongFaceWest: 'Gió Tây',
  mahjongFaceNorth: 'Gió Bắc',
  mahjongFaceDragonRed: 'Rồng Đỏ',
  mahjongFaceDragonGreen: 'Rồng Xanh',
  mahjongFaceDragonWhite: 'Rồng Trắng',
  mahjongFaceFlower: 'Hoa {n}',
  mahjongFaceSeason: 'Mùa {n}',

  mahjongTileFree: '{tile}, có thể lấy',
  mahjongTileBlocked: '{tile}, bị chặn',
  mahjongTileSelected: '{tile}, đang chọn',

  mahjongStuckTitle: 'Không còn cặp nào lấy được',
  mahjongStuckBody:
    'Hoàn tác vài nước hoặc chơi lại bàn này — cả hai đều miễn phí và không giới hạn.',

  mahjongHintNone: 'Hiện không có cặp nào lấy được.',

  mahjongClearTitle: 'Hoàn thành!',
  mahjongClearBody: 'Đã dọn sạch mọi quân trên bàn.',
  mahjongHintsUsed: 'Gợi ý đã dùng',
  mahjongNewBestTime: 'Thời gian nhanh nhất của bạn.',

  mahjongLevelsCleared: 'Cấp độ đã hoàn thành',
  mahjongDailiesCleared: 'Thử thách ngày đã hoàn thành',
  mahjongDailyBacklogHint: 'Những ngày trước vẫn luôn mở.',

  mahjongStep1Title: 'Lấy các cặp giống nhau',
  mahjongStep1Body:
    'Chạm vào hai quân cùng mặt để lấy chúng ra. Quân chỉ lấy được khi không có gì đè lên và bên trái hoặc bên phải còn trống.',
  mahjongStep2Title: 'Hoa và mùa là nhóm',
  mahjongStep2Body: 'Hoa nào cũng ghép được với hoa nào, mùa nào cũng ghép được với mùa nào.',
  mahjongStep3Title: 'Dọn sạch bàn',
  mahjongStep3Body:
    'Bàn nào cũng có thể dọn sạch. Nếu hết cặp, hãy hoàn tác hoặc chơi lại — cả hai đều miễn phí và không giới hạn.',
};
