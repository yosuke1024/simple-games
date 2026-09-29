/**
 * tr catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same.
 */
import type { BinaryBalanceMessages } from './en';

export const tr: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Tahta seç',
  binaryBalanceDifficulty_easy: 'Kolay',
  binaryBalanceDifficulty_medium: 'Orta',
  binaryBalanceDifficulty_hard: 'Zor',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Devam eden tahta değişsin mi?',
  binaryBalanceConfirmSwitchBody: '{current} oyununun yerine yeni bir {next} tahtası gelecek.',
  binaryBalanceBoardLabel: 'Binary Balance tahtası, {size}×{size}',
  binaryBalanceCellEmpty: 'Boş, satır {row}, sütun {col}',
  binaryBalanceCellCircle: 'Daire, satır {row}, sütun {col}',
  binaryBalanceCellSquare: 'Kare, satır {row}, sütun {col}',
  binaryBalanceCellFixedCircle: 'Verili daire, satır {row}, sütun {col}',
  binaryBalanceCellFixedSquare: 'Verili kare, satır {row}, sütun {col}',
  binaryBalanceLinkSameRight: 'sağdaki kareyle aynı',
  binaryBalanceLinkDiffRight: 'sağdaki kareden farklı',
  binaryBalanceLinkSameBelow: 'alttaki kareyle aynı',
  binaryBalanceLinkDiffBelow: 'alttaki kareden farklı',
  binaryBalanceRuleBroken: 'bir kuralı bozuyor',
  binaryBalanceMarkCircle: 'daire',
  binaryBalanceMarkSquare: 'kare',
  binaryBalanceHintViolation: 'Vurgulanan kareler bir kuralı bozuyor.',
  binaryBalanceHintWrong: 'Çerçeveli işaret doğru olamaz.',
  binaryBalanceHintPairGap: 'Renkli çift yan yana üç yapacağı için çerçeveli kare {mark}.',
  binaryBalanceHintLineCount:
    'Vurgulanan çizgi renkli işaretin yarısını zaten taşıyor, bu yüzden çerçeveli kare {mark}.',
  binaryBalanceHintLinkSame:
    'Bir = çerçeveli kareyi renkli kareye bağlıyor, bu yüzden o da {mark}.',
  binaryBalanceHintLinkDiff:
    'Bir × çerçeveli kareyi renkli kareye bağlıyor, bu yüzden öbür işareti alıyor: {mark}.',
  binaryBalanceHintLineCompletion:
    'Vurgulanan çizgiyi tamamlamanın her yolu çerçeveli kareye {mark} koyuyor.',
  binaryBalanceHintHypothesis:
    'Çerçeveli kare {other} olsaydı, sonraki hamleler bir kuralı bozardı, bu yüzden {mark}.',
  binaryBalanceHintNone: 'Şu an kesin bir hamle bulunamadı.',
  binaryBalanceSolvedTitle: 'Çözüldü!',
  binaryBalanceSolvedBody: 'Her çizgi dengede ve her bağ tutuyor.',
  binaryBalanceHintsUsed: 'Kullanılan ipuçları',
  binaryBalanceNewBestTime: 'En hızlı süren.',
  binaryBalanceNewBoard: 'Yeni tahta',
  binaryBalanceDailySection: 'Günlük',
  binaryBalanceDailiesSolved: 'Çözülen gün',
  binaryBalanceDailyBacklogHint: 'Önceki günler açık kalır.',
  binaryBalanceStep1Title: 'Asla üç yan yana',
  binaryBalanceStep1Body:
    'Dokununca boş, daire, kare arasında geçer. Aynı işaret üç kez yan yana gelemez.',
  binaryBalanceStep2Title: 'Yarı yarıya',
  binaryBalanceStep2Body: 'Her satır ve her sütunda daire ve kare sayısı eşit olur.',
  binaryBalanceStep3Title: 'Bağları izle',
  binaryBalanceStep3Body:
    '= ile bağlı kareler aynıdır; × ile bağlı kareler farklıdır. Takıldın mı? İpucu iste.',
};
