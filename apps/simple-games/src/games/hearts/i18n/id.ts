import type { HeartsMessages } from './en';

export const id: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Pilih lawan Anda',
  heartsDifficulty_easy: 'Mudah',
  heartsDifficulty_normal: 'Sedang',
  heartsDifficulty_hard: 'Sulit',
  heartsRecordNote: 'Menang {wins} · Kalah {losses} · Seri {draws}',
  heartsConfirmSwitchTitle: 'Ganti pertandingan yang sedang berjalan?',
  heartsConfirmSwitchBody:
    'Pertandingan {current} Anda akan diganti dengan pertandingan {next} baru.',

  heartsTableLabel: 'Meja Hearts',
  heartsHandLabel: 'Kartu Anda',
  heartsTrickLabel: 'Trik di meja',
  heartsTrayLabel: 'Kartu yang Anda oper',
  heartsYou: 'Anda',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Anda: {hand} poin di ronde ini, {total} di pertandingan',
  heartsSeatLabel: 'CPU {n}: {cards} kartu, {hand} poin di ronde ini, {total} di pertandingan',
  heartsTookLastTrick: 'Memenangkan trik terakhir',
  heartsCardLabel: '{rank} {suit}',
  heartsSuit_spades: 'sekop',
  heartsSuit_hearts: 'hati',
  heartsSuit_diamonds: 'wajik',
  heartsSuit_clubs: 'keriting',
  heartsCardBlocked: '{card}, belum boleh dimainkan',
  heartsCardChosen: '{card}, dipilih untuk dioper',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Pilih tiga kartu untuk dioper',
  heartsPassLeft: 'Mengoper ke kiri',
  heartsPassAcross: 'Mengoper ke seberang',
  heartsPassRight: 'Mengoper ke kanan',
  heartsPassConfirm: 'Oper tiga ini',
  heartsPassWaiting: 'Menunggu pemain lain…',

  heartsPlayPrompt: 'Ketuk kartu, lalu ketuk lagi untuk memainkannya',
  heartsCpuTurn: 'CPU {n} sedang bermain…',
  heartsTrickYou: 'Anda memenangkan trik ini',
  heartsTrickCpu: 'CPU {n} memenangkan trik ini',

  heartsHandTitle: 'Ronde dihitung',
  heartsMoonTitle: 'Menyapu semua poin',
  heartsMoonYou:
    'Anda mengambil semua dua puluh enam poin, jadi tiga pemain lain masing-masing mendapat 26.',
  heartsMoonCpu: 'CPU {n} mengambil semua dua puluh enam poin, jadi semua pemain lain mendapat 26.',
  heartsThisHand: 'Ronde ini',
  heartsMatchTotal: 'Pertandingan',
  heartsNextHand: 'Ronde berikutnya',

  heartsWinTitle: 'Anda menang!',
  heartsWinBody: 'Poin paling sedikit saat ada yang melewati seratus.',
  heartsLoseTitle: 'CPU menang',
  heartsLoseBody: 'Pemain lain selesai dengan poin lebih sedikit. Pertandingan berikutnya gratis.',
  heartsDrawTitle: 'Seri',
  heartsDrawBody: 'Anda selesai sama rendahnya dengan pemain lain.',
  heartsFinalScores: 'Skor akhir',

  heartsWins: 'Menang',
  heartsLosses: 'Kalah',
  heartsDraws: 'Seri',

  heartsStep1Title: 'Oper tiga kartu',
  heartsStep1Body:
    'Sebelum hampir setiap ronde, Anda memilih tiga kartu dan mengopernya — ke kiri, lalu ke kanan, lalu ke seberang, lalu satu ronde tanpa operan.',
  heartsStep2Title: 'Ikuti jenis kartunya',
  heartsStep2Body:
    'Kartu pertama menentukan jenisnya dan Anda harus mengikutinya selama masih punya; kartu tertinggi dari jenis itu memenangkan trik.',
  heartsStep3Title: 'Poin paling sedikit menang',
  heartsStep3Body:
    'Setiap hati yang Anda ambil bernilai satu poin dan Q sekop tiga belas, jadi saat ada yang melewati seratus, poin paling sedikit yang menang.',
};
