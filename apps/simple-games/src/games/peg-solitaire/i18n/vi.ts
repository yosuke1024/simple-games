/**
 * Peg Solitaire — the Vietnamese catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The English board
 * is "Kiểu Anh" (English style), so the button does not read as the name of
 * a language. "Bảng" for a board follows the shell's `tryAgain`, which sits
 * on the same result card as "Bảng mới".
 */
import type { PegSolitaireMessages } from './en';

export const vi: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'Kiểu Anh',
  pegSolitaireBoard_triangle: 'Tam giác',
  pegSolitaireBoardLabel_english: 'Bảng kiểu Anh, 33 lỗ',
  pegSolitaireBoardLabel_triangle: 'Bảng tam giác, 15 lỗ',
  pegSolitaireHoleCount: '{count} lỗ',

  pegSolitaireChooseBoard: 'Chọn bảng',
  pegSolitaireBestNote: 'Còn ít nhất: {count}',
  pegSolitaireConfirmSwitchTitle: 'Thay ván đang chơi?',
  pegSolitaireConfirmSwitchBody: 'Ván {current} đang chơi sẽ được thay bằng một ván {next} mới.',

  pegSolitaireHoleGrid: 'Hàng {row}, cột {col}: {content}',
  pegSolitaireHoleRow: 'Hàng {row}, lỗ {place}: {content}',
  pegSolitaireContentPeg: 'có quân',
  pegSolitaireContentPegRing: 'có quân, lỗ có vòng',
  pegSolitaireContentEmpty: 'trống',
  pegSolitaireContentEmptyRing: 'trống, lỗ có vòng',
  pegSolitaireContentLanding: 'trống, có thể nhảy tới đây',
  pegSolitaireContentLandingRing: 'trống, lỗ có vòng, có thể nhảy tới đây',

  pegSolitairePegsLeft: 'Quân còn lại: {count}',
  pegSolitaireNoJump: 'Quân này hiện không nhảy được.',

  pegSolitairePerfectTitle: 'Thắng hoàn hảo!',
  pegSolitairePerfectBody: 'Quân cuối cùng nằm ở lỗ có vòng.',
  pegSolitaireSingleTitle: 'Còn một quân',
  pegSolitaireSingleBody: 'Quân cuối cùng nằm ngoài lỗ có vòng.',
  pegSolitaireStuckTitle: 'Hết nước nhảy',
  pegSolitaireStuckBody: 'Không quân nào nhảy được nữa.',
  pegSolitairePegsLeftLabel: 'Quân còn lại',
  pegSolitaireFewestLabel: 'Ít nhất trên bảng này',
  pegSolitaireNewFewest: 'Ít hơn mọi lần trên bảng này.',
  pegSolitaireBoardFact: 'Bảng',
  pegSolitaireNewBoard: 'Bảng mới',

  pegSolitaireStatFewest: 'Ít quân còn lại nhất',
  pegSolitaireStatPerfect: 'Thắng hoàn hảo',

  pegSolitaireStep1Title: 'Nhảy và loại bỏ',
  pegSolitaireStep1Body:
    'Cho một quân nhảy qua quân bên cạnh vào lỗ trống — quân bị nhảy qua sẽ bị loại bỏ.',
  pegSolitaireStep2Title: 'Chỉ theo đường thẳng',
  pegSolitaireStep2Body:
    'Nhảy theo đường thẳng: lên, xuống và sang ngang ở Kiểu Anh, dọc theo ba đường ở Tam giác.',
  pegSolitaireStep3Title: 'Để lại quân cuối',
  pegSolitaireStep3Body:
    'Khi không quân nào nhảy được nữa, ván kết thúc — để quân cuối cùng ở lỗ có vòng là thắng hoàn hảo.',
};
