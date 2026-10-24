/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const vi: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: 'Đã đến: {count} / {total}',
  knightTourBoard: 'Bàn cờ',
  knightTourCurrent: 'Quân mã, ô hiện tại',
  knightTourVisitNumber: 'Lượt đến {count}',
  knightTourLegal: 'Ô có thể đến',
  knightTourEmpty: 'Chưa đến',
  knightTourCell: 'Hàng {row}, cột {col}: {content}',
  knightTourPaused: 'Đã tạm dừng. Tiếp tục khi sẵn sàng.',
  knightTourStuck: 'Không còn nước đi. Hoàn tác để thử đường khác.',
  knightTourInstruction: 'Đi hình chữ L đến ô có dấu chấm.',
  knightTourNewBoard: 'Bàn mới',
  knightTourWon: 'Hoàn thành hành trình!',
  knightTourWins: 'Đã hoàn thành',
  knightTourStep1Title: 'Đi hình chữ L',
  knightTourStep1Body:
    'Quân mã đi hai ô theo một hướng và một ô sang ngang; dấu chấm chỉ các ô hợp lệ.',
  knightTourStep2Title: 'Đến mỗi ô một lần',
  knightTourStep2Body: 'Mỗi ô đã đến có một số thứ tự; không thể đến lại ô đó.',
  knightTourStep3Title: 'Khám phá theo nhịp của bạn',
  knightTourStep3Body:
    'Đến tất cả các ô để hoàn thành. Nếu mắc kẹt, hãy hoàn tác để thử đường khác.',
};
