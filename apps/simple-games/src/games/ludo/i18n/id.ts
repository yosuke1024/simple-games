import type { LudoMessages } from './en';

export const id: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Pilih lawanmu',
  ludoDifficulty_easy: 'Mudah',
  ludoDifficulty_normal: 'Sedang',
  ludoDifficulty_hard: 'Sulit',
  ludoRecordNote: 'Menang {wins} · Kalah {losses}',
  ludoConfirmSwitchTitle: 'Ganti pertandingan yang sedang berjalan?',
  ludoConfirmSwitchBody:
    'Pertandingan {current} kamu akan diganti dengan pertandingan {next} yang baru.',

  // ---- the board ----
  ludoBoardLabel: 'Papan Ludo',
  ludoYou: 'Kamu',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} dari 4 sudah sampai rumah',
  ludoSafeSquare: 'Petak aman',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'di kandang',
  ludoWhereSquare: 'di petak {n}',
  ludoWhereSafe: 'di petak aman {n}',
  ludoWhereColumn: 'di petak {n} jalur rumah',
  ludoWhereHome: 'sudah sampai rumah',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Gerakkan bidakmu yang {where}',

  // ---- the die and the turn ----
  ludoRollAction: 'Lempar',
  ludoRollLabel: 'Lempar dadu',
  ludoDieLabel: 'Dadu menunjukkan {die}',
  ludoDieUnrolled: 'Dadu belum dilempar',
  ludoTurnRoll: 'Giliranmu — lempar dadunya.',
  ludoTurnMove: 'Kamu dapat {die}. Ketuk sebuah bidak untuk menggerakkannya.',
  ludoTurnCpu: 'CPU {n} sedang bermain…',
  ludoAutoPass: 'Tidak ada bidak yang bisa jalan dengan angka itu — giliran lewat.',
  ludoThirdSix: 'Tiga kali enam berturut-turut — giliran pindah ke yang lain.',
  ludoRollAgain: 'Dapat enam — lempar lagi.',

  // ---- the end of a match ----
  ludoWinTitle: 'Kamu menang!',
  ludoWinBody: 'Keempat bidakmu sudah sampai rumah.',
  ludoLoseTitle: 'CPU {n} menang',
  ludoLoseBody: 'Keempat bidaknya sudah sampai rumah. Pertandingan berikutnya gratis.',
  ludoNoContestTitle: 'Tanpa hasil',
  ludoNoContestBody:
    'Pertandingan mencapai batas lemparan tanpa ada yang sampai rumah. Ini dihitung sebagai pertandingan yang dimainkan, tapi bukan menang maupun kalah.',
  ludoWins: 'Menang',
  ludoLosses: 'Kalah',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Angka enam mengeluarkan bidak',
  ludoStep1Body:
    'Lempar dadunya, lalu ketuk sebuah bidak untuk menggerakkannya. Hanya bidak yang diizinkan aturan yang bisa diketuk — bidak lain tetap diam.',
  ludoStep2Title: 'Angka enam dapat lempar lagi',
  ludoStep2Body:
    'Dapat angka enam dan kamu lempar sekali lagi. Tapi tiga kali enam berturut-turut, giliran langsung pindah tanpa ada bidak yang bergerak.',
  ludoStep3Title: 'Menginjak lawan mengirimnya pulang',
  ludoStep3Body:
    'Semua bidak lawan di petak itu langsung kembali ke kandangnya. Petak aman kebal dari ini. Menangkap tidak memberimu lemparan tambahan — hanya angka enam yang memberi itu.',
  ludoStep4Title: 'Menumpuk bidak sendiri tidak melindungi apa pun',
  ludoStep4Body:
    'Dua bidakmu di satu petak tidak menghalangi siapa pun dan tidak melindungi apa pun. Kalau lawan menginjak petak itu, seluruh tumpukan langsung kembali ke kandang — tumpukan itu sasaran, bukan benteng.',
  ludoStep5Title: 'Sampai rumah harus dengan angka pas',
  ludoStep5Body:
    'Lemparan yang melebihi rumah membuat bidak itu tidak bisa jalan sama sekali. Bawa keempat bidakmu sampai rumah untuk menang. Setiap angka berasal dari seed pertandingan, keenam angka sama peluangnya, dan tidak ada pemain yang dadunya beda.',
};
