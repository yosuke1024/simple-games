import type { BlockPuzzleMessages } from './en';

export const vi: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Bảng khối, 8 nhân 8',
  blockCellFilled: 'Hàng {row}, cột {col}: đã lấp',
  blockCellEmpty: 'Hàng {row}, cột {col}: trống',
  blockTrayLabel: 'Mảnh ghép',
  blockPieceLabel: 'Mảnh {n}, {cells} ô',
  blockPieceUsed: 'Mảnh {n}, đã đặt',
  blockPieceSelected: 'Đã chọn mảnh {n}',
  blockBestScore: 'Điểm cao nhất',
  blockLines: 'Số hàng đã dọn',
  blockOverTitle: 'Hết chỗ trống',
  blockOverBody: 'Không mảnh nào vừa với bảng.',
  blockNewBestScore: 'Điểm cao nhất của bạn từ trước tới nay.',
  blockStep1Title: 'Kéo một mảnh vào bảng',
  blockStep1Body: 'Kéo một trong ba mảnh vào bảng. Các mảnh không bao giờ xoay.',
  blockStep2Title: 'Lấp đầy một hàng hoặc cột',
  blockStep2Body: 'Hàng đầy sẽ biến mất, và hàng đó sáng lên ngay khi bạn còn đang cầm mảnh ghép.',
  blockStep3Title: 'Chơi đến khi không còn chỗ',
  blockStep3Body: 'Hoàn tác miễn phí và không giới hạn, nên đặt sai không mất gì.',
};
