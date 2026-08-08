import type { TakuzuMessages } from './en';

export const id: TakuzuMessages = {
  takuzuName: 'Takuzu',
  takuzuBoardLabel: 'Papan Takuzu, {size}×{size}',
  takuzuCellEmpty: 'Kosong, baris {row}, kolom {col}',
  takuzuCellZero: '0, baris {row}, kolom {col}',
  takuzuCellOne: '1, baris {row}, kolom {col}',
  takuzuCellFixed: 'Angka awal {digit}, baris {row}, kolom {col}',
  takuzuRuleBroken: 'melanggar aturan',
  takuzuSizeLabel: '{n}×{n}',
  takuzuHintFound: 'Baris atau kolom yang disorot menentukan kotak bertanda.',
  takuzuHintBroken: 'Baris atau kolom yang disorot melanggar aturan.',
  takuzuHintNone: 'Belum ada langkah pasti saat ini.',
  takuzuSolvedTitle: 'Selesai!',
  takuzuSolvedBody: 'Semua baris dan kolom sudah benar.',
  takuzuHintsUsed: 'Petunjuk terpakai',
  takuzuNewBestTime: 'Waktu tercepatmu.',
  takuzuLevelsSolved: 'Level selesai',
  takuzuDailiesSolved: 'Harian selesai',
  takuzuDailyBacklogHint: 'Hari-hari sebelumnya tetap terbuka.',
  takuzuStep1Title: 'Jangan tiga berturut-turut',
  takuzuStep1Body:
    'Ketuk kotak untuk berganti 0, 1, kosong. Angka yang sama tak boleh tiga berturut-turut.',
  takuzuStep2Title: 'Setengah-setengah',
  takuzuStep2Body: 'Setiap baris dan setiap kolom berisi 0 dan 1 sama banyak.',
  takuzuStep3Title: 'Tidak ada baris kembar',
  takuzuStep3Body: 'Tidak boleh ada dua baris yang sama, begitu juga dua kolom.',
};
