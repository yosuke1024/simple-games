import type { MahjongMessages } from './en';

export const tr: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Mahjong tahtası, {n} taş kaldı',
  mahjongTilesLeft: '{n} taş kaldı',

  mahjongFaceCharacters: 'Karakter {n}',
  mahjongFaceDots: 'Daire {n}',
  mahjongFaceBamboo: 'Bambu {n}',
  mahjongFaceEast: 'Doğu Rüzgârı',
  mahjongFaceSouth: 'Güney Rüzgârı',
  mahjongFaceWest: 'Batı Rüzgârı',
  mahjongFaceNorth: 'Kuzey Rüzgârı',
  mahjongFaceDragonRed: 'Kırmızı Ejderha',
  mahjongFaceDragonGreen: 'Yeşil Ejderha',
  mahjongFaceDragonWhite: 'Beyaz Ejderha',
  mahjongFaceFlower: 'Çiçek {n}',
  mahjongFaceSeason: 'Mevsim {n}',

  mahjongTileFree: '{tile}, alınabilir',
  mahjongTileBlocked: '{tile}, kapalı',
  mahjongTileSelected: '{tile}, seçili',

  mahjongStuckTitle: 'Alınabilecek eş kalmadı',
  mahjongStuckBody:
    'Birkaç hamleyi geri al veya aynı tahtayı yeniden dene — ikisi de ücretsiz ve sınırsız.',

  mahjongHintNone: 'Şu anda alınabilecek bir eş yok.',

  mahjongClearTitle: 'Tamamlandı!',
  mahjongClearBody: 'Bütün taşlar tahtadan kalktı.',
  mahjongHintsUsed: 'Kullanılan ipuçları',
  mahjongNewBestTime: 'En hızlı dereceniz.',

  mahjongLevelsCleared: 'Tamamlanan seviyeler',
  mahjongDailiesCleared: 'Tamamlanan günlükler',
  mahjongDailyBacklogHint: 'Önceki günler her zaman açık kalır.',

  mahjongStep1Title: 'Aynı çifti al',
  mahjongStep1Body:
    'Aynı yüze sahip iki taşa dokunarak onları kaldır. Bir taş, üzerinde bir şey yoksa ve sol ya da sağ yanı açıksa alınabilir.',
  mahjongStep2Title: 'Çiçekler ve mevsimler grup oluşturur',
  mahjongStep2Body: 'Her çiçek her çiçekle, her mevsim her mevsimle eşleşir.',
  mahjongStep3Title: 'Tahtayı boşalt',
  mahjongStep3Body:
    'Her tahta sonuna kadar temizlenebilir. Eş kalmazsa geri al veya yeniden dene — ikisi de ücretsiz ve sınırsız.',
};
