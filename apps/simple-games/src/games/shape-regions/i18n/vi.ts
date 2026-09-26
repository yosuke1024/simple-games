/**
 * Vietnamese catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const vi: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Chọn bàn chơi',
  shapeRegionsDifficulty_easy: 'Dễ',
  shapeRegionsDifficulty_medium: 'Vừa',
  shapeRegionsDifficulty_hard: 'Khó',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Thay bàn chơi đang dở?',
  shapeRegionsConfirmSwitchBody: 'Ván {current} của bạn sẽ được thay bằng một bàn {next} mới.',
  shapeRegionsBoardLabel: 'Bàn Shape Regions, {width} nhân {height}',
  shapeRegionsCellAssigned: 'Hàng {row}, cột {col}, hình {region}',
  shapeRegionsCellEmpty: 'Hàng {row}, cột {col}, chưa gán',
  shapeRegionsClueCount: '{count} trên {size} ô',
  shapeRegionsRuleBroken: 'phạm luật',
  shapeRegionsShape_line: 'Đường thẳng',
  shapeRegionsShape_block: 'Hình chữ nhật',
  shapeRegionsShape_corner: 'Góc vuông',
  shapeRegionsShape_tee: 'Hình chữ T',
  shapeRegionsShape_step: 'Bậc thang',
  shapeRegionsHintWrong: 'Hình được tô sáng không khớp với đáp án.',
  shapeRegionsHintForced: 'Ô được đánh dấu chỉ có thể thuộc hình được tô sáng.',
  shapeRegionsHintSole: 'Hình được tô sáng chỉ có một cách đặt.',
  shapeRegionsHintCommon: 'Dù hình được tô sáng đặt thế nào, các ô đánh dấu vẫn nằm trong đó.',
  shapeRegionsHintNone: 'Hiện chưa tìm được nước đi chắc chắn.',
  shapeRegionsSolvedTitle: 'Đã giải!',
  shapeRegionsSolvedBody: 'Mọi ô đều thuộc về hình của nó.',
  shapeRegionsHintsUsed: 'Gợi ý đã dùng',
  shapeRegionsNewBestTime: 'Nhanh nhất từ trước đến nay.',
  shapeRegionsNewBoard: 'Bàn mới',
  shapeRegionsSolvedCount: 'Câu đố đã giải',
  shapeRegionsDailySection: 'Hằng ngày',
  shapeRegionsDailiesCleared: 'Ngày đã hoàn thành',
  shapeRegionsDailyBacklogHint: 'Mọi ngày trước đó vẫn mở.',
  shapeRegionsStep1Title: 'Số và ký hiệu',
  shapeRegionsStep1Body: 'Số là số ô của hình; ký hiệu là dạng của nó.',
  shapeRegionsStep2Title: 'Mở rộng từ gợi ý',
  shapeRegionsStep2Body: 'Kéo từ ô gợi ý qua các ô kề để mở rộng hình.',
  shapeRegionsStep3Title: 'Lấp đầy bàn',
  shapeRegionsStep3Body: 'Khi xong, mọi ô đều thuộc một hình. Chạm vào ô để bỏ nó ra.',
};
