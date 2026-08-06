import type { BlockPuzzleMessages } from './en';

export const id: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Papan blok, 8 kali 8',
  blockCellFilled: 'Baris {row}, kolom {col}: terisi',
  blockCellEmpty: 'Baris {row}, kolom {col}: kosong',
  blockTrayLabel: 'Kepingan',
  blockPieceLabel: 'Keping {n}, {cells} kotak',
  blockPieceUsed: 'Keping {n}, sudah ditempatkan',
  blockPieceSelected: 'Keping {n} dipilih',
  blockBestScore: 'Skor terbaik',
  blockLines: 'Garis dibersihkan',
  blockOverTitle: 'Tidak ada ruang lagi',
  blockOverBody: 'Tidak ada keping yang muat di papan.',
  blockNewBestScore: 'Skor terbaikmu sejauh ini.',
  blockStep1Title: 'Seret keping ke papan',
  blockStep1Body: 'Pindahkan salah satu dari tiga keping ke papan. Keping tidak pernah berputar.',
  blockStep2Title: 'Penuhi satu baris atau kolom',
  blockStep2Body:
    'Garis yang penuh akan hilang, dan membersihkan beberapa sekaligus lebih bernilai.',
  blockStep3Title: 'Main sampai tak ada yang muat',
  blockStep3Body: 'Urungkan gratis dan tanpa batas, jadi salah taruh tidak merugikan.',
};
