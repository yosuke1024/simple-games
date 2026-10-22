/**
 * Vietnamese catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `đổi chỗ` for a swap, `hàng` for a line of three, `ván` for a round, `viên ngọc` for a
 * gem, `chuỗi` for the cascade, `kỷ lục` / `cao nhất` for a best (Snake), `Điểm` for the score
 * (shell `score`). The stuck ending is a fact about the board, never `thua` or `trò chơi kết
 * thúc`.
 */
import type { GemSwapMessages } from './en';

export const vi: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Ngọc',
  gemSwapKinds_5: '5 · Dễ',
  gemSwapKinds_6: '6 · Thường',
  gemSwapKindsCount: '{count} loại',
  gemSwapResumeNote: 'Điểm {score} · {kinds}',
  gemSwapBestNote: 'Cao nhất {score}',
  gemSwapBestFor: 'Cao nhất, {kinds}',
  gemSwapSwapsLeft: 'Còn {count} lần đổi',
  gemSwapBoardLabel: 'Bảng ngọc, {size} × {size}',
  gemSwapCell: 'Hàng {row}, cột {col}, {gem}',
  gemSwapCellSelected: 'Hàng {row}, cột {col}, {gem}, đang chọn',
  gemSwapGem_hexagon: 'lục giác',
  gemSwapGem_octagon: 'bát giác',
  gemSwapGem_pear: 'giọt nước',
  gemSwapGem_marquise: 'hình thuyền',
  gemSwapGem_shield: 'khiên',
  gemSwapGem_heart: 'trái tim',
  gemSwapNewBoard: 'Bảng mới',
  gemSwapLiveMove: 'Biến mất {count} · còn {left} lần đổi',
  gemSwapLiveInvalid: 'Không đổi chỗ được hai viên này',
  gemSwapLiveUndo: 'Đã hoàn tác lần đổi · còn {left} lần đổi',
  gemSwapResultTitle: 'Hết ván',
  gemSwapEnd_swaps: 'Đã đổi đủ 30 lần.',
  gemSwapEnd_stuck: 'Không còn lần đổi nào xếp được ba viên thành hàng.',
  gemSwapEnd_cap: 'Chuỗi đã chạm giới hạn 64 bước.',
  gemSwapNotCounted: 'Ván dừng ở giới hạn không được tính vào kỷ lục.',
  gemSwapNewBest: 'Kỷ lục mới ({kinds})',
  gemSwapBestWith: 'Cao nhất ({kinds}): {score}',
  gemSwapStep1Title: 'Đổi chỗ',
  gemSwapStep1Body: 'Đổi chỗ hai viên ngọc cạnh nhau để xếp ba viên cùng hình trở lên thành hàng.',
  gemSwapStep2Title: 'Biến mất',
  gemSwapStep2Body:
    'Hàng biến mất, ngọc mới rơi xuống từ trên, và hàng nào chúng tạo ra cũng biến mất.',
  gemSwapStep3Title: 'Điểm',
  gemSwapStep3Body: 'Một ván có 30 lần đổi, mỗi viên ngọc biến mất được một điểm.',
  gemSwapFigureSwap: 'Hai viên ngọc cạnh nhau sắp đổi chỗ để ba viên lục giác thành hàng',
  gemSwapFigureClear: 'Một hàng đã biến mất và các viên ngọc phía trên rơi xuống thế chỗ',
  gemSwapFigureRound: 'Điểm 42 và một thanh còn 18 trong 30 lần đổi',
};
