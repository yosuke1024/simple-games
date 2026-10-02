import type { CrownGridMessages } from './en';

export const vi: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Chọn bảng',
  crownGridDifficulty_easy: 'Dễ',
  crownGridDifficulty_medium: 'Vừa',
  crownGridDifficulty_hard: 'Khó',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Thay bảng đang chơi?',
  crownGridConfirmSwitchBody: 'Ván {current} của bạn sẽ được thay bằng bảng {next} mới.',
  crownGridBoardLabel: 'Bảng Crown Grid, {size}×{size}',
  crownGridCellEmpty: 'Trống, hàng {row}, cột {col}, vùng {region}',
  crownGridCellCross: 'Gạch chéo, hàng {row}, cột {col}, vùng {region}',
  crownGridCellCrown: 'Vương miện, hàng {row}, cột {col}, vùng {region}',
  crownGridRuleBroken: 'phạm luật',
  crownGridHintViolation: 'Các vương miện được tô sáng đang phạm luật.',
  crownGridHintWrong: 'Vương miện được đánh dấu không thể đúng.',
  crownGridHintSingle_row: 'Hàng được tô sáng chỉ còn một ô cho vương miện: ô có viền.',
  crownGridHintSingle_col: 'Cột được tô sáng chỉ còn một ô cho vương miện: ô có viền.',
  crownGridHintSingle_region: 'Vùng được tô sáng chỉ còn một ô cho vương miện: ô có viền.',
  crownGridHintConfine_regionRow:
    'Vùng được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, tất cả đều nằm trên cùng một hàng — nên các ô còn lại của hàng đó (có viền) bị loại.',
  crownGridHintConfine_regionCol:
    'Vùng được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, tất cả đều nằm trên cùng một cột — nên các ô còn lại của cột đó (có viền) bị loại.',
  crownGridHintConfine_rowRegion:
    'Hàng được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, tất cả đều nằm trong cùng một vùng — nên các ô còn lại của vùng đó (có viền) bị loại.',
  crownGridHintConfine_colRegion:
    'Cột được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, tất cả đều nằm trong cùng một vùng — nên các ô còn lại của vùng đó (có viền) bị loại.',
  crownGridHintAttack_row:
    'Một vương miện đặt ở ô có viền sẽ loại mọi ô tô màu, khiến hàng được tô sáng không còn chỗ nào cho vương miện của nó.',
  crownGridHintAttack_col:
    'Một vương miện đặt ở ô có viền sẽ loại mọi ô tô màu, khiến cột được tô sáng không còn chỗ nào cho vương miện của nó.',
  crownGridHintAttack_region:
    'Một vương miện đặt ở ô có viền sẽ loại mọi ô tô màu, khiến vùng được tô sáng không còn chỗ nào cho vương miện của nó.',
  crownGridHintPair_regionsRows:
    'Hai vùng được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, vừa khít trong đúng hai hàng — nên các ô còn lại của hai hàng đó (có viền) bị loại.',
  crownGridHintPair_regionsCols:
    'Hai vùng được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, vừa khít trong đúng hai cột — nên các ô còn lại của hai cột đó (có viền) bị loại.',
  crownGridHintPair_rowsRegions:
    'Hai hàng được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, vừa khít trong đúng hai vùng — nên các ô còn lại của hai vùng đó (có viền) bị loại.',
  crownGridHintPair_colsRegions:
    'Hai cột được tô sáng chỉ có thể đặt vương miện vào các ô tô màu, vừa khít trong đúng hai vùng — nên các ô còn lại của hai vùng đó (có viền) bị loại.',
  crownGridHintHypothesis_row:
    'Hãy thử đặt vương miện vào ô có viền: các nước đi bị buộc theo sau khiến hàng được tô sáng không còn chỗ cho vương miện, nên ô đó không thể đúng.',
  crownGridHintHypothesis_col:
    'Hãy thử đặt vương miện vào ô có viền: các nước đi bị buộc theo sau khiến cột được tô sáng không còn chỗ cho vương miện, nên ô đó không thể đúng.',
  crownGridHintHypothesis_region:
    'Hãy thử đặt vương miện vào ô có viền: các nước đi bị buộc theo sau khiến vùng được tô sáng không còn chỗ cho vương miện, nên ô đó không thể đúng.',
  crownGridHintNone: 'Hiện chưa có nước đi chắc chắn.',
  crownGridSolvedTitle: 'Hoàn thành!',
  crownGridSolvedBody: 'Mỗi hàng, mỗi cột và mỗi vùng đều có một vương miện.',
  crownGridHintsUsed: 'Gợi ý đã dùng',
  crownGridNewBestTime: 'Nhanh nhất từ trước tới nay.',
  crownGridNewBoard: 'Bảng mới',
  crownGridDailySection: 'Hằng ngày',
  crownGridDailiesSolved: 'Số ngày đã giải',
  crownGridStep1Title: 'Mỗi nơi một vương miện',
  crownGridStep1Body: 'Mỗi hàng, mỗi cột và mỗi màu có đúng một vương miện.',
  crownGridStep2Title: 'Vương miện không chạm nhau',
  crownGridStep2Body: 'Hai vương miện không bao giờ đứng cạnh nhau, kể cả theo đường chéo.',
  crownGridStep3Title: 'Chạm và kéo',
  crownGridStep3Body:
    'Chạm một ô để đổi ×, vương miện, trống; kéo để đánh dấu nhiều ×. Bí? Hãy xin gợi ý.',
};
