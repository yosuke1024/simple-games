/**
 * Vietnamese catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const vi: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Chọn bảng',
  numberPathDifficulty_easy: 'Dễ',
  numberPathDifficulty_medium: 'Vừa',
  numberPathDifficulty_hard: 'Khó',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Bảng Number Path, {width} nhân {height}',
  numberPathCellPlain: 'Hàng {row}, cột {col}',
  numberPathCellNumber: 'Số {n}, hàng {row}, cột {col}',
  numberPathOnPath: 'trên đường đi, bước {step}',
  numberPathOffPath: 'ngoài đường đi',
  numberPathHintNext: 'Ô được đánh dấu là bước tiếp theo.',
  numberPathHintBack: 'Đường đi đã lệch. Hãy lùi về ô được đánh dấu.',
  numberPathHintNone: 'Hiện chưa có gợi ý.',
  numberPathHintMarked: 'gợi ý',
  numberPathSolvedTitle: 'Xong!',
  numberPathSolvedBody: 'Một nét, mọi ô, đúng thứ tự.',
  numberPathHintsUsed: 'Gợi ý đã dùng',
  numberPathNewBestTime: 'Nhanh nhất của bạn từ trước đến nay.',
  numberPathNewBoard: 'Bảng mới',
  numberPathSolvedCount: 'Bảng đã giải',
  numberPathDailySection: 'Hằng ngày',
  numberPathDailiesSolved: 'Ngày đã giải',
  numberPathStep1Title: 'Đi theo các số',
  numberPathStep1Body: 'Vẽ một đường từ 1, đi qua các số theo thứ tự.',
  numberPathStep2Title: 'Phủ kín mọi ô',
  numberPathStep2Body: 'Đường đi qua mỗi ô đúng một lần và kết thúc ở số cuối cùng.',
  numberPathStep3Title: 'Tường chặn lối',
  numberPathStep3Body:
    'Không thể vượt qua cạnh dày; để lùi lại, kéo ngược theo đường hoặc chạm vào một ô trên đó.',
};
