import type { BlockPuzzleMessages } from './en';

export const tr: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Blok tahtası, 8 çarpı 8',
  blockCellFilled: '{row}. satır, {col}. sütun: dolu',
  blockCellEmpty: '{row}. satır, {col}. sütun: boş',
  blockTrayLabel: 'Parçalar',
  blockPieceLabel: '{n}. parça, {cells} kare',
  blockPieceUsed: '{n}. parça, yerleştirildi',
  blockPieceSelected: '{n}. parça seçildi',
  blockBestScore: 'En iyi skor',
  blockLines: 'Temizlenen sıra',
  blockOverTitle: 'Yer kalmadı',
  blockOverBody: 'Hiçbir parça tahtaya sığmıyor.',
  blockNewBestScore: 'Şimdiye kadarki en iyi skorun.',
  blockStep1Title: 'Bir parçayı sürükle',
  blockStep1Body: 'Üç parçadan birini tahtaya taşı. Parçalar hiç dönmez.',
  blockStep2Title: 'Bir satır veya sütun doldur',
  blockStep2Body: 'Dolan sıra temizlenir, aynı anda birden fazlası daha çok puan getirir.',
  blockStep3Title: 'Hiçbiri sığmayana kadar oyna',
  blockStep3Body: 'Geri alma ücretsiz ve sınırsız, yanlış koymanın bedeli yok.',
};
