import type { MahjongMessages } from './en';

export const id: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Papan mahjong, {n} ubin tersisa',
  mahjongTilesLeft: '{n} ubin tersisa',

  mahjongFaceCharacters: 'Karakter {n}',
  mahjongFaceDots: 'Lingkaran {n}',
  mahjongFaceBamboo: 'Bambu {n}',
  mahjongFaceEast: 'Angin Timur',
  mahjongFaceSouth: 'Angin Selatan',
  mahjongFaceWest: 'Angin Barat',
  mahjongFaceNorth: 'Angin Utara',
  mahjongFaceDragonRed: 'Naga Merah',
  mahjongFaceDragonGreen: 'Naga Hijau',
  mahjongFaceDragonWhite: 'Naga Putih',
  mahjongFaceFlower: 'Bunga {n}',
  mahjongFaceSeason: 'Musim {n}',

  mahjongTileFree: '{tile}, bisa diambil',
  mahjongTileBlocked: '{tile}, terhalang',
  mahjongTileSelected: '{tile}, terpilih',

  mahjongStuckTitle: 'Tidak ada pasangan yang bebas',
  mahjongStuckBody:
    'Urungkan beberapa langkah atau coba lagi papan yang sama — keduanya gratis dan tanpa batas.',

  mahjongHintNone: 'Saat ini tidak ada pasangan yang bebas.',

  mahjongClearTitle: 'Selesai!',
  mahjongClearBody: 'Semua ubin sudah keluar dari papan.',
  mahjongHintsUsed: 'Petunjuk yang dipakai',
  mahjongNewBestTime: 'Waktu tercepatmu.',

  mahjongLevelsCleared: 'Level yang diselesaikan',
  mahjongDailiesCleared: 'Harian yang diselesaikan',
  mahjongDailyBacklogHint: 'Semua hari sebelumnya tetap terbuka.',

  mahjongStep1Title: 'Ambil pasangan yang sama',
  mahjongStep1Body:
    'Ketuk dua ubin bergambar sama untuk mengambilnya. Ubin bisa diambil bila tidak ada apa pun di atasnya dan sisi kiri atau kanannya terbuka.',
  mahjongStep2Title: 'Bunga dan musim adalah kelompok',
  mahjongStep2Body:
    'Bunga mana pun cocok dengan bunga mana pun, dan musim mana pun dengan musim mana pun.',
  mahjongStep3Title: 'Kosongkan papan',
  mahjongStep3Body:
    'Setiap papan pasti bisa diselesaikan. Jika tidak ada pasangan tersisa, urungkan atau coba lagi — keduanya gratis dan tanpa batas.',
};
