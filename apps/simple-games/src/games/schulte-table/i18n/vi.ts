import type { SchulteMessages } from './en';

export const vi: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: 'Bảng số',
  schulteCell: '{value}, hàng {row}, cột {col}',
  schulteCellDone: '{value}, hàng {row}, cột {col}, đã chạm',
  schulteFind: 'Tìm',

  schulteDoneTitle: 'Đã tìm đủ',
  schulteDoneBody: 'Bạn đã chạm mọi con số theo đúng thứ tự.',
  schulteMisses: 'Chạm sai',
  schulteNewBestTime: 'Nhanh nhất từ trước tới nay.',
  schulteConfirmRestartBody: 'Ván này bắt đầu lại từ số đầu tiên.',

  schulteDailyBacklogHint: 'Mọi ngày trước đó luôn mở.',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'Cấp đã xong',
  schulteDailiesDone: 'Ngày đã xong',
  schulteTotalMisses: 'Tổng lần chạm sai',

  schulteStep1Title: 'Chạm 1, rồi 2, rồi 3',
  schulteStep1Body: 'Các con số nằm lộn xộn. Hãy chạm theo thứ tự.',
  schulteStep2Title: 'Số cần tìm nằm phía trên bảng',
  schulteStep2Body: 'Chạm sai không mất gì cả. Bảng chỉ đứng chờ.',
  schulteStep3Title: 'Hoàn thành cả bảng',
  schulteStep3Body: 'Thời gian của bạn được ghi lại. Không có giới hạn thời gian.',
};
