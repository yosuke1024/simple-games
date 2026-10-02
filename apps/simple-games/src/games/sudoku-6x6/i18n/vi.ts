/**
 * Vietnamese catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const vi: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Chọn một bảng',
  sudoku6x6Difficulty_easy: 'Dễ',
  sudoku6x6Difficulty_medium: 'Vừa',
  sudoku6x6Difficulty_hard: 'Khó',
  sudoku6x6ConfirmSwitchTitle: 'Thay bảng đang chơi dở?',
  sudoku6x6ConfirmSwitchBody: 'Ván {current} của bạn sẽ được thay bằng bảng {next} mới.',
  sudoku6x6GridLabel: 'Lưới Sudoku 6×6',
  sudoku6x6PadLabel: 'Bàn phím số',
  sudoku6x6PadKey: '{value}, còn {n}',
  sudoku6x6PadNoteKey: 'Ghi chú {value}',
  sudoku6x6CellEmpty: 'Trống, hàng {row}, cột {col}',
  sudoku6x6CellGiven: '{value}, đề bài, hàng {row}, cột {col}',
  sudoku6x6CellEntry: '{value}, hàng {row}, cột {col}',
  sudoku6x6Erase: 'Xóa',
  sudoku6x6Notes: 'Ghi chú',
  sudoku6x6HintOnlyDigit: 'Chỉ một chữ số hợp với ô này.',
  sudoku6x6HintOnlyCell: 'Đây là chỗ duy nhất đặt được {value}.',
  sudoku6x6HintLockedLine: 'Trong ô vuông này, {value} chỉ hợp với đường đang sáng.',
  sudoku6x6HintLockedBox: 'Trên đường này, {value} chỉ hợp trong ô vuông đang sáng.',
  sudoku6x6HintRuledOut: 'Các ô này loại chữ số khỏi những chỗ còn lại trong nhóm.',
  sudoku6x6HintNone: 'Chưa suy ra được gì lúc này.',
  sudoku6x6SolvedTitle: 'Đã giải!',
  sudoku6x6SolvedBody: 'Mỗi hàng, cột và ô vuông đều có 1-6.',
  sudoku6x6Mistakes: 'Lỗi sai',
  sudoku6x6HintsUsed: 'Gợi ý đã dùng',
  sudoku6x6NewBestTime: 'Nhanh nhất từ trước tới nay.',
  sudoku6x6NewBoard: 'Bảng mới',
  sudoku6x6DailySection: 'Hằng ngày',
  sudoku6x6DailiesSolved: 'Ngày đã giải',
  sudoku6x6HighlightMistakes: 'Hiện lỗi sai',
  sudoku6x6HighlightMistakesNote:
    'Đánh dấu chữ số sai ngay khi đặt vào. Số trùng luôn được đánh dấu.',
  sudoku6x6Step1Title: '1-6, mỗi số một lần',
  sudoku6x6Step1Body: 'Mỗi hàng, cột và ô vuông 2×3 chứa 1 đến 6 đúng một lần.',
  sudoku6x6Step2Title: 'Điền và ghi chú',
  sudoku6x6Step2Body: 'Chọn một ô rồi nhấn một số. Bật Ghi chú để ghi các số ứng viên.',
  sudoku6x6Step3Title: 'Bí? Lấy gợi ý',
  sudoku6x6Step3Body: 'Gợi ý cho biết ô tiếp theo có thể chắc chắn, và vì sao.',
};
