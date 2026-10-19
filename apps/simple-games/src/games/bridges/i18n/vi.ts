/**
 * Vietnamese catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const vi: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Chọn bảng',
  bridgesDifficulty_easy: 'Dễ',
  bridgesDifficulty_medium: 'Trung bình',
  bridgesDifficulty_hard: 'Khó',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Thay thế bảng đang chơi?',
  bridgesConfirmSwitchBody: 'Bảng {current} của bạn sẽ bị thay bằng một bảng {next} mới.',
  bridgesBoardLabel: 'Bảng Bridges, {width} nhân {height}, {islands} đảo',
  bridgesIslandOpen: 'Đảo {value}, hàng {row}, cột {col}: {count} trên {value} cầu',
  bridgesIslandComplete: 'Đảo {value}, hàng {row}, cột {col}: đã đủ',
  bridgesIslandOver: 'Đảo {value}, hàng {row}, cột {col}: {count} cầu, quá nhiều',
  bridgesIslandSelected: '{island}. Đang chọn',
  bridgesIslandPartner: '{island}. Có thể nối với đảo đang chọn: {bridges} trên 2 cầu',
  bridgesIslandHinted: '{island}. Được tô sáng theo gợi ý',
  bridgesIslandHintRing: '{island}. Được tô sáng theo gợi ý, trong vòng chấm',
  bridgesAnnounceNone: 'Không có cầu giữa hàng {row1}, cột {col1} và hàng {row2}, cột {col2}',
  bridgesAnnounceOne: 'Một cầu giữa hàng {row1}, cột {col1} và hàng {row2}, cột {col2}',
  bridgesAnnounceTwo: 'Hai cầu giữa hàng {row1}, cột {col1} và hàng {row2}, cột {col2}',
  bridgesSplitNote:
    'Mọi con số đã đủ, nhưng các đảo đang chia thành {groups} nhóm. Hãy nối chúng thành một.',
  bridgesHintWrong: 'Có quá nhiều cầu giữa các đảo được tô sáng.',
  bridgesHintOne: 'Cặp được tô sáng cần ít nhất một cầu.',
  bridgesHintTwo: 'Cặp được tô sáng cần hai cầu.',
  bridgesHintOneAt: 'Hãy đếm ở đảo trong vòng chấm: cặp được tô sáng cần ít nhất một cầu.',
  bridgesHintTwoAt: 'Hãy đếm ở đảo trong vòng chấm: cặp được tô sáng cần hai cầu.',
  bridgesHintNone: 'Chưa tìm thấy nước đi chắc chắn từ đây.',
  bridgesHintWhere: 'Tô sáng: hàng {row1}, cột {col1} và hàng {row2}, cột {col2}.',
  bridgesHintWhereRing:
    'Tô sáng: hàng {row1}, cột {col1} và hàng {row2}, cột {col2}. Vòng chấm: hàng {row}, cột {col}.',
  bridgesSolvedTitle: 'Đã nối hết!',
  bridgesSolvedBody: 'Mọi đảo đã nối thành một mạng lưới.',
  bridgesHintsUsed: 'Gợi ý đã dùng',
  bridgesNewBestTime: 'Thời gian nhanh nhất của bạn.',
  bridgesNewBoard: 'Bảng mới',
  bridgesSolvedCount: 'Bảng đã giải',
  bridgesDailySection: 'Hằng ngày',
  bridgesDailiesCleared: 'Ngày đã hoàn thành',
  bridgesAllModes: 'Tất cả chế độ',
  bridgesStep1Title: 'Số là số cầu',
  bridgesStep1Body: 'Mỗi đảo có đúng số cầu bằng con số của nó.',
  bridgesStep2Title: 'Thẳng, tối đa hai',
  bridgesStep2Body:
    'Cầu chạy thẳng theo chiều ngang hoặc dọc, không bao giờ cắt nhau, và mỗi cặp đảo có tối đa hai cầu.',
  bridgesStep3Title: 'Nối tất cả',
  bridgesStep3Body:
    'Chạm một đảo, rồi chạm đảo có vòng để thêm cầu (chạm lại để có hai, lần nữa để về không), cho đến khi mọi đảo được nối.',
};
