import type { CrownGridMessages } from './en';

export const id: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Pilih papan',
  crownGridDifficulty_easy: 'Mudah',
  crownGridDifficulty_medium: 'Sedang',
  crownGridDifficulty_hard: 'Sulit',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Ganti papan yang sedang berjalan?',
  crownGridConfirmSwitchBody:
    'Permainan {current} Anda akan diganti dengan papan {next} yang baru.',
  crownGridBoardLabel: 'Papan Crown Grid, {size}×{size}',
  crownGridCellEmpty: 'Kosong, baris {row}, kolom {col}, wilayah {region}',
  crownGridCellCross: 'Dicoret, baris {row}, kolom {col}, wilayah {region}',
  crownGridCellCrown: 'Mahkota, baris {row}, kolom {col}, wilayah {region}',
  crownGridRuleBroken: 'melanggar aturan',
  crownGridHintViolation: 'Mahkota yang disorot melanggar aturan.',
  crownGridHintWrong: 'Mahkota yang ditandai tidak mungkin benar.',
  crownGridHintPlace:
    'Kotak yang ditandai harus berisi mahkota — area yang disorot menunjukkan alasannya.',
  crownGridHintEliminate:
    'Tidak ada mahkota di kotak yang ditandai — area yang disorot menunjukkan alasannya.',
  crownGridHintNone: 'Belum ada langkah pasti saat ini.',
  crownGridSolvedTitle: 'Selesai!',
  crownGridSolvedBody: 'Setiap baris, kolom, dan wilayah berisi satu mahkota.',
  crownGridHintsUsed: 'Petunjuk terpakai',
  crownGridNewBestTime: 'Tercepat sejauh ini.',
  crownGridNewBoard: 'Papan baru',
  crownGridDailySection: 'Harian',
  crownGridDailiesSolved: 'Hari terselesaikan',
  crownGridDailyBacklogHint: 'Hari-hari sebelumnya tetap terbuka.',
  crownGridStep1Title: 'Satu mahkota masing-masing',
  crownGridStep1Body: 'Setiap baris, setiap kolom, dan setiap warna berisi tepat satu mahkota.',
  crownGridStep2Title: 'Mahkota tidak bersentuhan',
  crownGridStep2Body: 'Dua mahkota tidak boleh bersebelahan, bahkan secara diagonal.',
  crownGridStep3Title: 'Ketuk dan seret',
  crownGridStep3Body:
    'Ketuk kotak untuk berganti ×, mahkota, kosong; seret untuk menandai beberapa ×. Buntu? Minta petunjuk.',
};
