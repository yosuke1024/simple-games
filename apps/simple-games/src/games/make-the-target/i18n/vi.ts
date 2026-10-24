/**
 * Vietnamese catalog for Make the Target — written by AI from the English
 * source on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md
 * §13). No native speaker has read it; it is not to be treated as reviewed.
 * The title (`makeTheTargetName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source.
 *
 * Terms: problem = bài toán, target = mục tiêu (not bàn thắng or điểm),
 * solution = lời giải, the result of one move = kết quả. Division is read
 * "chia", left term first ("8 chia 2 bằng 4" divides 8). Shared words follow
 * the shell and Bridges (Dễ / Trung bình / Khó, Hằng ngày, Ngày đã hoàn thành).
 */
import type { MakeTheTargetMessages } from './en';

export const vi: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Chọn độ khó',
  makeTheTargetDifficulty_easy: 'Dễ',
  makeTheTargetDifficulty_medium: 'Trung bình',
  makeTheTargetDifficulty_hard: 'Khó',
  makeTheTargetTierNote_easy: '4 số',
  makeTheTargetTierNote_medium: '4 hoặc 5 số',
  makeTheTargetTierNote_hard: '5 số',
  makeTheTargetConfirmSwitchTitle: 'Thay bài toán đang làm?',
  makeTheTargetConfirmSwitchBody:
    'Bài toán {current} đang làm sẽ bị thay bằng một bài toán {next} mới.',
  makeTheTargetNumbersLabel: 'Các số',
  makeTheTargetTargetSpoken: 'Mục tiêu {target}',
  makeTheTargetTargetLabel: 'Mục tiêu',
  makeTheTargetOperatorsLabel: 'Phép tính',
  makeTheTargetOp_add: 'Cộng',
  makeTheTargetOp_subtract: 'Trừ',
  makeTheTargetOp_multiply: 'Nhân',
  makeTheTargetOp_divide: 'Chia',
  makeTheTargetSpokenLine_add: '{left} cộng {right} bằng {result}',
  makeTheTargetSpokenLine_subtract: '{left} trừ {right} bằng {result}',
  makeTheTargetSpokenLine_multiply: '{left} nhân {right} bằng {result}',
  makeTheTargetSpokenLine_divide: '{left} chia {right} bằng {result}',
  makeTheTargetSpokenUndo: 'Đã hoàn tác: {line}',
  makeTheTargetStepsLabel: 'Các bước đã làm',
  makeTheTargetMissed: 'Kết quả là {value}, không phải {target}.',
  makeTheTargetSpokenMissed: '{line}. Kết quả là {value}, không phải {target}.',
  makeTheTargetShowSolution: 'Xem một lời giải',
  makeTheTargetRevealTitle: 'Xem một lời giải?',
  makeTheTargetRevealBody: 'Bài toán này kết thúc tại đây và không được tính là đã giải.',
  makeTheTargetRevealConfirm: 'Xem',
  makeTheTargetSolvedTitle: 'Đã đạt mục tiêu.',
  makeTheTargetRevealedTitle: 'Một cách tạo ra {target}',
  makeTheTargetSolutionLabel: 'Một lời giải',
  makeTheTargetNewBoard: 'Bài toán mới',
  makeTheTargetNewBestTime: 'Thời gian nhanh nhất của bạn.',
  makeTheTargetSolvedCount: 'Bài toán đã giải',
  makeTheTargetDailySection: 'Hằng ngày',
  makeTheTargetDailiesCleared: 'Ngày đã hoàn thành',
  makeTheTargetAllModes: 'Tất cả chế độ',
  makeTheTargetStep1Title: 'Gộp hai số',
  makeTheTargetStep1Body:
    'Chạm một số, rồi + − × hoặc ÷, rồi một số khác\u00a0— số chạm trước nằm bên trái.',
  makeTheTargetStep2Title: 'Một số mới',
  makeTheTargetStep2Body:
    'Hai số đó được dùng hết, và kết quả\u00a0— luôn là số nguyên lớn hơn 0\u00a0— thế vào chỗ của chúng.',
  makeTheTargetStep3Title: 'Khớp với mục tiêu',
  makeTheTargetStep3Body:
    'Dùng hết tất cả các số. Khi số cuối cùng bằng mục tiêu, bài toán được giải.',
};
