/**
 * Vietnamese catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const vi: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Chọn bảng',
  boxRegionsDifficulty_easy: 'Dễ',
  boxRegionsDifficulty_medium: 'Trung bình',
  boxRegionsDifficulty_hard: 'Khó',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Thay thế bảng đang chơi?',
  boxRegionsConfirmSwitchBody: 'Ván {current} của bạn sẽ bị thay bằng một bảng {next} mới.',
  boxRegionsBoardLabel: 'Bảng Box Regions, {width} nhân {height}',
  boxRegionsCellAssigned: 'Hàng {row}, cột {col}, hộp {region}',
  boxRegionsCellEmpty: 'Hàng {row}, cột {col}, chưa thuộc hộp nào',
  boxRegionsClueCount: '{count} trên {size} ô',
  boxRegionsRuleBroken: 'vi phạm luật',
  boxRegionsKind_square: 'Vuông',
  boxRegionsKind_tall: 'Cao',
  boxRegionsKind_wide: 'Rộng',
  boxRegionsKind_free: 'Hộp tùy ý',
  boxRegionsHintWrong: 'Hộp được tô sáng không khớp với đáp án.',
  boxRegionsHintForced: 'Ô được đánh dấu chỉ có thể thuộc hộp của manh mối được tô sáng.',
  boxRegionsHintSole: 'Hộp này chỉ có thể vẽ theo một cách.',
  boxRegionsHintCommon:
    'Dù vẽ hộp của manh mối này theo cách nào, nó cũng bao phủ các ô được đánh dấu.',
  boxRegionsHintNone: 'Hiện chưa tìm thấy nước đi chắc chắn.',
  boxRegionsSolvedTitle: 'Đã giải xong!',
  boxRegionsSolvedBody: 'Mọi ô đều nằm trong hộp của mình.',
  boxRegionsHintsUsed: 'Gợi ý đã dùng',
  boxRegionsNewBestTime: 'Nhanh nhất của bạn.',
  boxRegionsNewBoard: 'Bảng mới',
  boxRegionsSolvedCount: 'Câu đố đã giải',
  boxRegionsDailySection: 'Hằng ngày',
  boxRegionsDailiesCleared: 'Số ngày đã hoàn thành',
  boxRegionsDailyBacklogHint: 'Mọi ngày trước đó vẫn mở.',
  boxRegionsStep1Title: 'Chia thành các hộp',
  boxRegionsStep1Body: 'Chia bảng thành các hình chữ nhật, mỗi hình chứa đúng một manh mối.',
  boxRegionsStep2Title: 'Đọc manh mối',
  boxRegionsStep2Body: 'Con số là số ô của hộp; ký hiệu cho biết hộp vuông, cao, rộng hay tùy ý.',
  boxRegionsStep3Title: 'Vẽ từ góc đến góc',
  boxRegionsStep3Body:
    'Kéo từ góc này sang góc kia để vẽ hộp. Chạm vào hộp để xóa. Bí? Hãy thử gợi ý.',
};
