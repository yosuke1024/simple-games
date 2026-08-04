import type { SlidingPuzzleMessages } from './en';

export const id: SlidingPuzzleMessages = {
  slideName: 'Sliding Puzzle',
  slideBoardLabel: 'Papan sliding puzzle',
  slideTileLabel: '{value}, baris {row}, kolom {col}',
  slideBlankLabel: 'Kosong, baris {row}, kolom {col}',
  slideSizeLabel: '{n}x{n}',
  slideMoves: 'Langkah',
  slideBestMoves: 'Langkah tersedikit',
  slideSolvedTitle: 'Selesai!',
  slideSolvedBody: 'Semua angka kembali berurutan.',
  slideNewBestMoves: 'Langkah tersedikit sejauh ini.',
  slideNewBestTime: 'Tercepat sejauh ini.',
  slideLevelsSolved: 'Level selesai',
  slideDailiesSolved: 'Harian selesai',
  slideDailyBacklogHint: 'Setiap hari sebelumnya selalu terbuka.',
  slideStep1Title: 'Ketuk ubin di sebelah kosong',
  slideStep1Body: 'Ketuk ubin yang bersebelahan dengan kotak kosong, ubin itu meluncur ke sana.',
  slideStep2Title: 'Beberapa ubin sekaligus',
  slideStep2Body: 'Dalam baris atau kolom yang sama, semua ubin di antaranya ikut bergeser.',
  slideStep3Title: 'Urutkan mulai dari 1',
  slideStep3Body: 'Susun angka sesuai urutan baca dengan kotak kosong di pojok kanan bawah.',
};
