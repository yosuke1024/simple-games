import type { GinRummyMessages } from './en';

export const id: GinRummyMessages = {
  ginName: 'Gin Rummy',

  ginChooseOpponent: 'Pilih lawan',
  ginDifficulty_easy: 'Mudah',
  ginDifficulty_normal: 'Sedang',
  ginDifficulty_hard: 'Sulit',
  ginRecordNote: 'Menang {wins} · Kalah {losses}',
  ginConfirmSwitchTitle: 'Ganti pertandingan yang sedang berjalan?',
  ginConfirmSwitchBody: 'Pertandingan {current} Anda akan diganti dengan pertandingan {next} baru.',

  ginTableLabel: 'Meja Gin Rummy',
  ginHandLabel: 'Kartu Anda',
  ginOpponentLabel: 'CPU memegang {n} kartu',
  ginStockLabel: 'Tumpukan tertutup, {n} kartu',
  ginDiscardLabel: 'Tumpukan buangan, {card} di atas',
  ginDiscardEmpty: 'Tumpukan buangan, kosong',
  ginCardLabel: '{rank} {suit}',
  ginSuit_spades: 'sekop',
  ginSuit_hearts: 'hati',
  ginSuit_diamonds: 'wajik',
  ginSuit_clubs: 'keriting',
  ginCardInMeld: '{card}, kombinasi {n}',
  ginCardDeadwood: '{card}, kartu sisa',
  ginDeadwood: 'Sisa',
  ginYou: 'Anda',
  ginCpu: 'CPU',

  ginUpcardPrompt: 'Ambil kartu terbuka, atau lewati',
  ginDrawPrompt: 'Ambil dari tumpukan tertutup atau buangan',
  ginDiscardPrompt: 'Ketuk kartu, lalu ketuk lagi untuk membuangnya',
  ginKnockPrompt: 'Ketuk kartu untuk knock, lalu ketuk lagi',
  ginCpuTurn: 'CPU sedang berpikir…',
  ginCpuPassed: 'CPU melewati kartu terbuka',
  ginCpuDrewStock: 'CPU mengambil dari tumpukan tertutup',
  ginCpuTookDiscard: 'CPU mengambil {card}',
  ginCpuDiscarded: 'CPU membuang {card}',
  ginTake: 'Ambil',
  ginPass: 'Lewati',
  ginKnock: 'Knock',

  ginHandGinTitle: 'Gin',
  ginHandKnockTitle: 'Knock',
  ginHandUndercutTitle: 'Undercut',
  ginHandDeadTitle: 'Ronde mati',
  ginHandDeadBody:
    'Tersisa dua kartu di tumpukan tertutup. Tidak ada yang mendapat poin, dan pembagi yang sama membagi lagi.',
  ginHandYouTook: 'Anda mendapat {points}',
  ginHandCpuTook: 'CPU mendapat {points}',
  ginYourMelds: 'Kombinasi Anda',
  ginCpuMelds: 'Kombinasi CPU',
  ginLaidOff: 'Kartu titipan',
  ginNextHand: 'Ronde berikutnya',

  ginWinTitle: 'Anda menang!',
  ginWinBody: 'Seratus poin lebih dulu daripada CPU.',
  ginLoseTitle: 'CPU menang',
  ginLoseBody: 'CPU melewati seratus lebih dulu. Pertandingan berikutnya gratis.',

  ginWins: 'Menang',
  ginLosses: 'Kalah',

  ginStep1Title: 'Ambil satu, buang satu',
  ginStep1Body:
    'Ambil dari tumpukan tertutup atau kartu teratas buangan, lalu buang satu kartu lain.',
  ginStep2Title: 'Set dan urutan',
  ginStep2Body:
    'Tiga kartu bernilai sama, atau tiga berurutan sejenis — sisanya dihitung otomatis untuk Anda.',
  ginStep3Title: 'Knock pada sepuluh atau kurang',
  ginStep3Body: 'Begitu sisa Anda sepuluh atau kurang, tombol Knock muncul dan mengakhiri ronde.',
};
