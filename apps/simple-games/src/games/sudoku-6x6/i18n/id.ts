/**
 * Indonesian catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const id: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Pilih papan',
  sudoku6x6Difficulty_easy: 'Mudah',
  sudoku6x6Difficulty_medium: 'Sedang',
  sudoku6x6Difficulty_hard: 'Sulit',
  sudoku6x6ConfirmSwitchTitle: 'Ganti papan yang sedang dimainkan?',
  sudoku6x6ConfirmSwitchBody:
    'Permainan {current} Anda akan diganti dengan papan {next} yang baru.',
  sudoku6x6GridLabel: 'Papan Sudoku 6×6',
  sudoku6x6PadLabel: 'Papan angka',
  sudoku6x6PadKey: '{value}, sisa {n}',
  sudoku6x6PadNoteKey: 'Catatan {value}',
  sudoku6x6CellEmpty: 'Kosong, baris {row}, kolom {col}',
  sudoku6x6CellGiven: '{value}, angka awal, baris {row}, kolom {col}',
  sudoku6x6CellEntry: '{value}, baris {row}, kolom {col}',
  sudoku6x6Erase: 'Hapus',
  sudoku6x6Notes: 'Catatan',
  sudoku6x6HintOnlyDigit: 'Hanya satu angka yang cocok di sel ini.',
  sudoku6x6HintOnlyCell: 'Di sini {value} hanya bisa masuk ke sel ini.',
  sudoku6x6HintLockedLine: 'Dalam blok ini, {value} hanya cocok pada garis yang disorot.',
  sudoku6x6HintLockedBox: 'Pada garis ini, {value} hanya cocok di dalam blok yang disorot.',
  sudoku6x6HintRuledOut: 'Sel-sel ini menyingkirkan angka tersebut dari sel lain dalam satu unit.',
  sudoku6x6HintNone: 'Belum ada yang bisa dipastikan.',
  sudoku6x6SolvedTitle: 'Selesai!',
  sudoku6x6SolvedBody: 'Setiap baris, kolom, dan blok berisi 1-6.',
  sudoku6x6Mistakes: 'Kesalahan',
  sudoku6x6HintsUsed: 'Petunjuk terpakai',
  sudoku6x6NewBestTime: 'Tercepat sejauh ini.',
  sudoku6x6NewBoard: 'Papan baru',
  sudoku6x6DailySection: 'Harian',
  sudoku6x6DailiesSolved: 'Hari selesai',
  sudoku6x6DailyBacklogHint: 'Semua hari sebelumnya tetap terbuka.',
  sudoku6x6HighlightMistakes: 'Tandai kesalahan',
  sudoku6x6HighlightMistakesNote:
    'Menandai angka yang salah begitu diletakkan. Angka ganda selalu ditandai.',
  sudoku6x6Step1Title: '1-6, masing-masing sekali',
  sudoku6x6Step1Body: 'Setiap baris, kolom, dan blok 2×3 memuat 1 sampai 6 tepat sekali.',
  sudoku6x6Step2Title: 'Isi dan catat',
  sudoku6x6Step2Body:
    'Pilih sel lalu ketuk angka. Aktifkan Catatan untuk menulis angka yang mungkin.',
  sudoku6x6Step3Title: 'Bingung? Ambil petunjuk',
  sudoku6x6Step3Body: 'Petunjuk menunjukkan sel berikutnya yang bisa dipastikan, dan alasannya.',
};
