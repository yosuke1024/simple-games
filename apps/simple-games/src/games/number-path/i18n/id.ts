/**
 * Indonesian catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const id: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Pilih papan',
  numberPathDifficulty_easy: 'Mudah',
  numberPathDifficulty_medium: 'Sedang',
  numberPathDifficulty_hard: 'Sulit',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Papan Number Path, {width} kali {height}',
  numberPathCellPlain: 'Baris {row}, kolom {col}',
  numberPathCellNumber: 'Angka {n}, baris {row}, kolom {col}',
  numberPathOnPath: 'di jalur, langkah ke-{step}',
  numberPathOffPath: 'di luar jalur',
  numberPathHintNext: 'Kotak yang ditandai adalah langkah berikutnya.',
  numberPathHintBack: 'Jalur sudah menyimpang. Mundur ke kotak yang ditandai.',
  numberPathHintNone: 'Belum ada petunjuk saat ini.',
  numberPathHintMarked: 'petunjuk',
  numberPathSolvedTitle: 'Selesai!',
  numberPathSolvedBody: 'Satu garis, semua kotak, berurutan.',
  numberPathHintsUsed: 'Petunjuk dipakai',
  numberPathNewBestTime: 'Tercepat Anda sejauh ini.',
  numberPathNewBoard: 'Papan baru',
  numberPathSolvedCount: 'Papan selesai',
  numberPathDailySection: 'Harian',
  numberPathDailiesSolved: 'Hari selesai',
  numberPathStep1Title: 'Ikuti angkanya',
  numberPathStep1Body: 'Tarik satu garis dari 1 dan lewati angka secara berurutan.',
  numberPathStep2Title: 'Isi semua kotak',
  numberPathStep2Body: 'Garis melewati setiap kotak tepat sekali dan berakhir di angka terakhir.',
  numberPathStep3Title: 'Tembok menghalangi',
  numberPathStep3Body:
    'Tepi tebal tidak bisa dilewati; untuk mundur, tarik balik di sepanjang garis atau ketuk kotak di atasnya.',
};
