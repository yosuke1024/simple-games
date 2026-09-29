/**
 * vi catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same. The two marks are a sun
 * and a moon (the ordinary words for the celestial bodies).
 */
import type { BinaryBalanceMessages } from './en';

export const vi: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Chọn bảng',
  binaryBalanceDifficulty_easy: 'Dễ',
  binaryBalanceDifficulty_medium: 'Vừa',
  binaryBalanceDifficulty_hard: 'Khó',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Thay bảng đang chơi?',
  binaryBalanceConfirmSwitchBody: 'Ván {current} của bạn sẽ được thay bằng bảng {next} mới.',
  binaryBalanceBoardLabel: 'Bảng Binary Balance, {size}×{size}',
  binaryBalanceCellEmpty: 'Trống, hàng {row}, cột {col}',
  binaryBalanceCellSun: 'Mặt trời, hàng {row}, cột {col}',
  binaryBalanceCellMoon: 'Mặt trăng, hàng {row}, cột {col}',
  binaryBalanceCellFixedSun: 'Mặt trời cố định, hàng {row}, cột {col}',
  binaryBalanceCellFixedMoon: 'Mặt trăng cố định, hàng {row}, cột {col}',
  binaryBalanceLinkSameRight: 'giống ô bên phải',
  binaryBalanceLinkDiffRight: 'khác ô bên phải',
  binaryBalanceLinkSameBelow: 'giống ô bên dưới',
  binaryBalanceLinkDiffBelow: 'khác ô bên dưới',
  binaryBalanceRuleBroken: 'phạm luật',
  binaryBalanceMarkSun: 'mặt trời',
  binaryBalanceMarkMoon: 'mặt trăng',
  binaryBalanceHintViolation: 'Các ô được tô sáng đang phạm luật.',
  binaryBalanceHintWrong: 'Ký hiệu có viền không thể đúng.',
  binaryBalanceHintPairGap: 'Cặp ô được tô màu sẽ tạo ra ba ô liền nhau, nên ô có viền là {mark}.',
  binaryBalanceHintLineCount:
    'Hàng hoặc cột được tô sáng đã có đủ một nửa ký hiệu được tô màu, nên ô có viền là {mark}.',
  binaryBalanceHintLinkSame: 'Dấu = nối ô có viền với ô được tô màu, nên ô này cũng là {mark}.',
  binaryBalanceHintLinkDiff:
    'Dấu × nối ô có viền với ô được tô màu, nên ô này là ký hiệu còn lại: {mark}.',
  binaryBalanceHintLineCompletion:
    'Mọi cách hoàn thành hàng hoặc cột được tô sáng đều đặt {mark} vào ô có viền.',
  binaryBalanceHintHypothesis:
    'Nếu ô có viền là {other}, các nước đi sau đó sẽ phạm luật, nên ô này là {mark}.',
  binaryBalanceHintNone: 'Hiện chưa có nước đi chắc chắn.',
  binaryBalanceSolvedTitle: 'Hoàn thành!',
  binaryBalanceSolvedBody: 'Mọi hàng và cột đều cân bằng, và mọi liên kết đều đúng.',
  binaryBalanceHintsUsed: 'Gợi ý đã dùng',
  binaryBalanceNewBestTime: 'Thời gian nhanh nhất của bạn.',
  binaryBalanceNewBoard: 'Bảng mới',
  binaryBalanceDailySection: 'Thử thách ngày',
  binaryBalanceDailiesSolved: 'Số ngày đã giải',
  binaryBalanceDailyBacklogHint: 'Những ngày trước luôn mở.',
  binaryBalanceStep1Title: 'Không ba ô liền nhau',
  binaryBalanceStep1Body:
    'Chạm để đổi giữa trống, mặt trời, mặt trăng. Cùng một ký hiệu không được nằm ba ô liền nhau.',
  binaryBalanceStep2Title: 'Chia đều',
  binaryBalanceStep2Body: 'Mỗi hàng và mỗi cột có số mặt trời bằng số mặt trăng.',
  binaryBalanceStep3Title: 'Theo các liên kết',
  binaryBalanceStep3Body:
    'Các ô nối bằng = thì giống nhau; các ô nối bằng × thì khác nhau. Bí rồi? Hãy xin gợi ý.',
};
