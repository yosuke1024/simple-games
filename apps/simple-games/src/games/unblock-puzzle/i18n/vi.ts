/**
 * Vietnamese catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/vi.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const vi: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Chọn bảng',
  unblockPuzzleDifficulty_easy: 'Dễ',
  unblockPuzzleDifficulty_medium: 'Trung bình',
  unblockPuzzleDifficulty_hard: 'Khó',
  unblockPuzzleRange: '{min}–{max} nước',
  unblockPuzzleRangeOpen: 'Từ {min} nước trở lên',
  unblockPuzzleConfirmSwitchTitle: 'Thay thế bảng đang chơi?',
  unblockPuzzleConfirmSwitchBody: 'Bảng {current} của bạn sẽ được thay bằng một bảng {next} mới.',
  unblockPuzzleBoardLabel: 'Bảng {cols} nhân {rows}. Lối ra ở đầu bên phải của hàng {row}.',
  unblockPuzzleBlockTarget:
    'Khối mục tiêu, hàng {row}, cột {from} đến {to}. Ô trống: trái {left}, phải {right}.',
  unblockPuzzleBlockH:
    'Khối ngang, hàng {row}, cột {from} đến {to}. Ô trống: trái {left}, phải {right}.',
  unblockPuzzleBlockV:
    'Khối dọc, cột {col}, hàng {from} đến {to}. Ô trống: trên {up}, dưới {down}.',
  unblockPuzzleMovesStatus: 'Nước đi {moves} · ít nhất {min}',
  unblockPuzzleMoveLeft: 'Trượt sang trái',
  unblockPuzzleMoveRight: 'Trượt sang phải',
  unblockPuzzleMoveUp: 'Trượt lên',
  unblockPuzzleMoveDown: 'Trượt xuống',
  unblockPuzzleSelectPrompt: 'Chạm vào một khối để trượt',
  unblockPuzzleHintTarget: 'Gợi ý: trượt khối mục tiêu tới cột {toFrom}–{toTo}.',
  unblockPuzzleHintH: 'Gợi ý: trượt khối ở hàng {row}, cột {from}–{to}, tới cột {toFrom}–{toTo}.',
  unblockPuzzleHintV: 'Gợi ý: trượt khối ở cột {col}, hàng {from}–{to}, tới hàng {toFrom}–{toTo}.',
  unblockPuzzleHintShown: 'Trượt khối được đánh dấu tới khung nét đứt.',
  unblockPuzzleHintNone: 'Không tìm thấy nước đi nào từ đây.',
  unblockPuzzleSolvedTitle: 'Hoàn thành!',
  unblockPuzzleSolvedBody: 'Khối mục tiêu đã ra ngoài.',
  unblockPuzzleSolvedOptimal: 'Ra ngoài với số nước ít nhất có thể.',
  unblockPuzzleFewestLabel: 'Ít nhất có thể',
  unblockPuzzleNetCellsLabel: 'Số ô dịch chuyển ròng',
  unblockPuzzleHintsUsed: 'Gợi ý đã dùng',
  unblockPuzzleNewBestTime: 'Kỷ lục mới ở mức {difficulty}.',
  unblockPuzzleNewBestDailyMoves: 'Ít nước nhất của bạn hôm nay.',
  unblockPuzzleNewBoard: 'Bảng mới',
  unblockPuzzleSolvedCount: 'Bảng đã hoàn thành',
  unblockPuzzleOptimalCount: 'Hoàn thành với ít nước nhất',
  unblockPuzzleOverallSection: 'Tổng quan',
  unblockPuzzleDailiesCleared: 'Thử thách hằng ngày đã hoàn thành',
  unblockPuzzleStep1Title: 'Trượt theo đường của nó',
  unblockPuzzleStep1Body: 'Mỗi khối chỉ trượt theo đường của chính nó: sang ngang, hoặc lên xuống.',
  unblockPuzzleStep2Title: 'Đưa mục tiêu ra ngoài',
  unblockPuzzleStep2Body: 'Trượt khối mục tiêu ra lối ra bên phải để hoàn thành bảng.',
  unblockPuzzleStep3Title: 'Một lần trượt, một nước',
  unblockPuzzleStep3Body:
    'Trượt xa bao nhiêu cũng chỉ tính một nước, và Hoàn tác cùng Gợi ý luôn có sẵn.',
};
