/**
 * Vietnamese catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = Gợi ý) and Box Regions (board = bảng); an edge is a cạnh, a drawn
 * edge a đường kẻ, a dot a chấm, the loop a vòng.
 */
import type { LoopPuzzleMessages } from './en';

export const vi: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Chọn bảng',
  loopPuzzleDifficulty_easy: 'Dễ',
  loopPuzzleDifficulty_medium: 'Trung bình',
  loopPuzzleDifficulty_hard: 'Khó',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Thay thế bảng đang chơi?',
  loopPuzzleConfirmSwitchBody: 'Ván {current} của bạn sẽ bị thay bằng một bảng {next} mới.',
  loopPuzzleBoardLabel: 'Bảng Loop Puzzle, {width} nhân {height}',
  loopPuzzleEdgeHEmpty: 'Cạnh ngang, hàng {row}, cột {col}, trống',
  loopPuzzleEdgeHLine: 'Cạnh ngang, hàng {row}, cột {col}, đã kẻ',
  loopPuzzleEdgeHCross: 'Cạnh ngang, hàng {row}, cột {col}, đánh dấu ×',
  loopPuzzleEdgeVEmpty: 'Cạnh dọc, hàng {row}, cột {col}, trống',
  loopPuzzleEdgeVLine: 'Cạnh dọc, hàng {row}, cột {col}, đã kẻ',
  loopPuzzleEdgeVCross: 'Cạnh dọc, hàng {row}, cột {col}, đánh dấu ×',
  loopPuzzleClueOpen: 'Số {n}, hàng {row}, cột {col}',
  loopPuzzleClueMet: 'Số {n}, hàng {row}, cột {col}, đã đủ',
  loopPuzzleClueTooMany: 'Số {n}, hàng {row}, cột {col}, thừa đường kẻ',
  loopPuzzleClueTooFew: 'Số {n}, hàng {row}, cột {col}, không thể đủ nữa',
  loopPuzzleNoteHint: 'Được gợi ý đánh dấu',
  loopPuzzleNoteConflict: 'Vi phạm luật',
  loopPuzzleConflictBranch: 'Có một chấm nối với hơn hai đường kẻ.',
  loopPuzzleConflictDeadEnd: 'Có đường kẻ dừng ở một chấm không còn lối đi tiếp.',
  loopPuzzleConflictLoop: 'Bên ngoài một vòng khép kín vẫn còn đường kẻ khác.',
  loopPuzzleConflictTooMany: 'Có một số có nhiều đường kẻ hơn giá trị của nó.',
  loopPuzzleConflictTooFew: 'Có một số không thể có đủ đường kẻ nữa.',
  loopPuzzleConflictClosed: 'Vòng đã khép kín nhưng có một số chưa khớp.',
  loopPuzzleHintWrongLine: 'Đường kẻ được đánh dấu không thuộc vòng.',
  loopPuzzleHintWrongCross: 'Vòng đi qua dấu × được đánh dấu.',
  loopPuzzleHintCellLine: 'Số được khoanh cần một đường kẻ ở cạnh được đánh dấu.',
  loopPuzzleHintCellCross: 'Số được khoanh không cho phép kẻ ở cạnh được đánh dấu.',
  loopPuzzleHintDotLine: 'Tại chấm được khoanh, vòng phải đi qua cạnh được đánh dấu.',
  loopPuzzleHintDotCross: 'Tại chấm được khoanh, cạnh được đánh dấu không thể kẻ.',
  loopPuzzleHintLoopCross: 'Kẻ ở cạnh được đánh dấu sẽ khép một vòng quá sớm.',
  loopPuzzleHintClosedCross: 'Vòng đã khép kín nên cạnh được đánh dấu không thuộc vòng.',
  loopPuzzleHintTrialLine: 'Không kẻ ở cạnh được đánh dấu sẽ dẫn đến mâu thuẫn.',
  loopPuzzleHintTrialCross: 'Kẻ ở cạnh được đánh dấu sẽ dẫn đến mâu thuẫn.',
  loopPuzzleHintRevealLine: 'Cạnh được đánh dấu thuộc vòng.',
  loopPuzzleHintRevealCross: 'Cạnh được đánh dấu không thuộc vòng.',
  loopPuzzleHintNone: 'Hiện chưa có gợi ý.',
  loopPuzzleSolvedTitle: 'Đã giải xong!',
  loopPuzzleSolvedBody: 'Một vòng khép kín, mọi số đều đủ.',
  loopPuzzleHintsUsed: 'Gợi ý đã dùng',
  loopPuzzleNewBestTime: 'Nhanh nhất của bạn.',
  loopPuzzleNewBoard: 'Bảng mới',
  loopPuzzleSolvedCount: 'Câu đố đã giải',
  loopPuzzleDailySection: 'Hằng ngày',
  loopPuzzleDailiesCleared: 'Số ngày đã hoàn thành',
  loopPuzzleAllBoards: 'Tất cả các bảng',
  loopPuzzleStep1Title: 'Một vòng khép kín',
  loopPuzzleStep1Body: 'Nối các chấm thành một vòng khép kín, không rẽ nhánh và không tự cắt nhau.',
  loopPuzzleStep2Title: 'Đọc các số',
  loopPuzzleStep2Body: 'Mỗi số cho biết vòng đi qua bao nhiêu trong bốn cạnh của ô đó.',
  loopPuzzleStep3Title: 'Chạm vào một cạnh',
  loopPuzzleStep3Body:
    'Mỗi lần chạm, cạnh đổi thành đường kẻ, rồi thành × (không thuộc vòng), rồi trống.',
};
