import type { Game2048Messages } from './en';

export const vi: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: 'Bàn 2048, 4 nhân 4',
  mergeCell: 'Hàng {row}, cột {col}: {value}',
  mergeCellEmpty: 'Hàng {row}, cột {col}: trống',
  mergeBestScore: 'Điểm cao nhất',
  mergeBestTile: 'Ô lớn nhất',
  mergeReachedCount: 'Số lần đạt 2048',
  mergeReachedTitle: 'Bạn đã đạt 2048!',
  mergeReachedBody: 'Cứ chơi tiếp — bàn vẫn còn chỗ.',
  mergeKeepGoing: 'Chơi tiếp',
  mergeOverTitle: 'Hết nước đi',
  mergeOverBody: 'Mọi ô đều đầy và không còn gì ghép được nữa.',
  mergeNewBestScore: 'Điểm cao nhất của bạn.',
  mergeStep1Title: 'Vuốt để trượt',
  mergeStep1Body: 'Mọi ô cùng trượt về hướng đó, và hai số giống nhau nhập thành một.',
  mergeStep2Title: 'Một ô mới xuất hiện',
  mergeStep2Body: 'Sau mỗi nước đi làm bàn thay đổi, một ô được thêm vào.',
  mergeStep3Title: 'Bí? Lùi lại một bước',
  mergeStep3Body: 'Hoàn tác miễn phí và không giới hạn, và ô vừa hiện ra không bị bốc lại.',
};
