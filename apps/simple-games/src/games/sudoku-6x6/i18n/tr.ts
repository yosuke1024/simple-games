/**
 * Turkish catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const tr: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Bir tahta seç',
  sudoku6x6Difficulty_easy: 'Kolay',
  sudoku6x6Difficulty_medium: 'Orta',
  sudoku6x6Difficulty_hard: 'Zor',
  sudoku6x6ConfirmSwitchTitle: 'Devam eden tahta değiştirilsin mi?',
  sudoku6x6ConfirmSwitchBody: '{current} oyunun yeni bir {next} tahtayla değiştirilecek.',
  sudoku6x6GridLabel: 'Sudoku 6×6 ızgarası',
  sudoku6x6PadLabel: 'Sayı tuşları',
  sudoku6x6PadKey: '{value}, {n} kaldı',
  sudoku6x6PadNoteKey: 'Not {value}',
  sudoku6x6CellEmpty: 'Boş, satır {row}, sütun {col}',
  sudoku6x6CellGiven: '{value}, verili, satır {row}, sütun {col}',
  sudoku6x6CellEntry: '{value}, satır {row}, sütun {col}',
  sudoku6x6Erase: 'Sil',
  sudoku6x6Notes: 'Notlar',
  sudoku6x6HintOnlyDigit: 'Bu kareye yalnızca tek bir rakam uyuyor.',
  sudoku6x6HintOnlyCell: 'Burada {value} yalnızca bu kareye girebilir.',
  sudoku6x6HintLockedLine: 'Bu kutuda {value} yalnızca vurgulanan çizgiye uyuyor.',
  sudoku6x6HintLockedBox: 'Bu çizgide {value} yalnızca vurgulanan kutuya uyuyor.',
  sudoku6x6HintRuledOut: 'Bu kareler, rakamları aynı birimin geri kalanından eler.',
  sudoku6x6HintNone: 'Şu an çıkarılabilecek bir şey yok.',
  sudoku6x6SolvedTitle: 'Çözüldü!',
  sudoku6x6SolvedBody: 'Her satır, sütun ve kutuda 1-6 var.',
  sudoku6x6Mistakes: 'Hatalar',
  sudoku6x6HintsUsed: 'Kullanılan ipuçları',
  sudoku6x6NewBestTime: 'En hızlı zamanın.',
  sudoku6x6NewBoard: 'Yeni tahta',
  sudoku6x6DailySection: 'Günlük',
  sudoku6x6DailiesSolved: 'Çözülen günler',
  sudoku6x6DailyBacklogHint: 'Önceki tüm günler açık kalır.',
  sudoku6x6HighlightMistakes: 'Hataları göster',
  sudoku6x6HighlightMistakesNote:
    'Yanlış bir rakamı yerleştirir yerleştirmez işaretler. Tekrar eden rakamlar her zaman işaretlenir.',
  sudoku6x6Step1Title: '1-6, birer kez',
  sudoku6x6Step1Body: 'Her satır, sütun ve 2×3 kutu 1 ile 6 arasını birer kez içerir.',
  sudoku6x6Step2Title: 'Doldur ve not al',
  sudoku6x6Step2Body: "Bir kare seç ve bir sayıya dokun. Adayları yazmak için Notlar'ı aç.",
  sudoku6x6Step3Title: 'Sıkıştın mı? İpucu al',
  sudoku6x6Step3Body: 'İpucu, emin olabileceğin bir sonraki kareyi ve nedenini gösterir.',
};
