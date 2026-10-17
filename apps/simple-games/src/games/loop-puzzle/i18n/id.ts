/**
 * Indonesian catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = Petunjuk) and Box Regions (board = papan); an edge is a sisi, a
 * drawn edge a garis, the loop a jalur tertutup (not "lingkaran", which would
 * clash with "dilingkari", the ringed number or dot of a hint).
 */
import type { LoopPuzzleMessages } from './en';

export const id: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Pilih papan',
  loopPuzzleDifficulty_easy: 'Mudah',
  loopPuzzleDifficulty_medium: 'Sedang',
  loopPuzzleDifficulty_hard: 'Sulit',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Ganti papan yang sedang dimainkan?',
  loopPuzzleConfirmSwitchBody:
    'Permainan {current} Anda akan diganti dengan papan {next} yang baru.',
  loopPuzzleBoardLabel: 'Papan Loop Puzzle, {width} kali {height}',
  loopPuzzleEdgeHEmpty: 'Sisi mendatar, baris {row}, kolom {col}, kosong',
  loopPuzzleEdgeHLine: 'Sisi mendatar, baris {row}, kolom {col}, bergaris',
  loopPuzzleEdgeHCross: 'Sisi mendatar, baris {row}, kolom {col}, bertanda ×',
  loopPuzzleEdgeVEmpty: 'Sisi tegak, baris {row}, kolom {col}, kosong',
  loopPuzzleEdgeVLine: 'Sisi tegak, baris {row}, kolom {col}, bergaris',
  loopPuzzleEdgeVCross: 'Sisi tegak, baris {row}, kolom {col}, bertanda ×',
  loopPuzzleClueOpen: 'Angka {n}, baris {row}, kolom {col}',
  loopPuzzleClueMet: 'Angka {n}, baris {row}, kolom {col}, terpenuhi',
  loopPuzzleClueTooMany: 'Angka {n}, baris {row}, kolom {col}, garis terlalu banyak',
  loopPuzzleClueTooFew: 'Angka {n}, baris {row}, kolom {col}, tidak bisa terpenuhi lagi',
  loopPuzzleNoteHint: 'Ditandai oleh petunjuk',
  loopPuzzleNoteConflict: 'Melanggar aturan',
  loopPuzzleConflictBranch: 'Ada titik dengan lebih dari dua garis.',
  loopPuzzleConflictDeadEnd: 'Ada garis yang berhenti di titik tanpa jalan lanjut.',
  loopPuzzleConflictLoop: 'Ada garis lain di luar jalur yang sudah tertutup.',
  loopPuzzleConflictTooMany: 'Ada angka dengan garis lebih banyak dari nilainya.',
  loopPuzzleConflictTooFew: 'Ada angka yang tidak bisa lagi mendapat cukup garis.',
  loopPuzzleConflictClosed: 'Jalur sudah tertutup, tetapi ada angka yang tidak cocok.',
  loopPuzzleHintWrongLine: 'Garis yang ditandai bukan bagian dari jalur.',
  loopPuzzleHintWrongCross: 'Jalur melewati × yang ditandai.',
  loopPuzzleHintCellLine: 'Angka yang dilingkari membutuhkan garis di sisi yang ditandai.',
  loopPuzzleHintCellCross:
    'Angka yang dilingkari tidak memberi tempat garis di sisi yang ditandai.',
  loopPuzzleHintDotLine: 'Di titik yang dilingkari, jalur harus melewati sisi yang ditandai.',
  loopPuzzleHintDotCross: 'Di titik yang dilingkari, sisi yang ditandai tidak bisa bergaris.',
  loopPuzzleHintLoopCross: 'Garis di sisi yang ditandai akan menutup jalur terlalu cepat.',
  loopPuzzleHintClosedCross: 'Jalur sudah tertutup, jadi sisi yang ditandai bukan bagian darinya.',
  loopPuzzleHintTrialLine: 'Tanpa garis di sisi yang ditandai, akan timbul kontradiksi.',
  loopPuzzleHintTrialCross: 'Garis di sisi yang ditandai akan menimbulkan kontradiksi.',
  loopPuzzleHintRevealLine: 'Sisi yang ditandai adalah bagian dari jalur.',
  loopPuzzleHintRevealCross: 'Sisi yang ditandai bukan bagian dari jalur.',
  loopPuzzleHintNone: 'Belum ada petunjuk saat ini.',
  loopPuzzleSolvedTitle: 'Selesai!',
  loopPuzzleSolvedBody: 'Satu jalur tertutup, semua angka terpenuhi.',
  loopPuzzleHintsUsed: 'Petunjuk dipakai',
  loopPuzzleNewBestTime: 'Tercepat Anda.',
  loopPuzzleNewBoard: 'Papan baru',
  loopPuzzleSolvedCount: 'Teka-teki selesai',
  loopPuzzleDailySection: 'Harian',
  loopPuzzleDailiesCleared: 'Hari terselesaikan',
  loopPuzzleAllBoards: 'Semua papan',
  loopPuzzleStep1Title: 'Satu jalur tertutup',
  loopPuzzleStep1Body:
    'Hubungkan titik-titik menjadi satu jalur tertutup yang tidak bercabang atau bersilangan.',
  loopPuzzleStep2Title: 'Baca angkanya',
  loopPuzzleStep2Body: 'Angka menunjukkan berapa dari empat sisinya yang dilewati jalur.',
  loopPuzzleStep3Title: 'Ketuk sebuah sisi',
  loopPuzzleStep3Body:
    'Setiap ketukan mengubah sisi menjadi garis, lalu × (bukan bagian jalur), lalu kosong.',
};
