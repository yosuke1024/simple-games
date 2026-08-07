import type { CheckersMessages } from './en';

export const id: CheckersMessages = {
  checkersName: 'Checkers',
  checkersChooseOpponent: 'Pilih lawanmu',
  checkersDifficulty_easy: 'Mudah',
  checkersDifficulty_normal: 'Normal',
  checkersDifficulty_hard: 'Sulit',
  checkersChooseSideLabel: 'Siapa jalan duluan',
  checkersGoFirst: 'Kamu dulu',
  checkersGoSecond: 'CPU dulu',
  checkersRecordNote: 'Menang {wins} · Kalah {losses}',
  checkersBoardLabel: 'Papan Checkers, 8 kali 8',
  checkersSquareEmpty: 'Baris {row}, kolom {col}: kosong',
  checkersSquareYourMan: 'Baris {row}, kolom {col}: bidakmu',
  checkersSquareYourKing: 'Baris {row}, kolom {col}: rajamu',
  checkersSquareCpuMan: 'Baris {row}, kolom {col}: bidak CPU',
  checkersSquareCpuKing: 'Baris {row}, kolom {col}: raja CPU',
  checkersSquareSelected: 'Baris {row}, kolom {col}: bidakmu, terpilih',
  checkersSquareTarget: 'Baris {row}, kolom {col}: pindah ke sini',
  checkersYou: 'Kamu',
  checkersCpu: 'CPU',
  checkersYourTurn: 'Giliranmu',
  checkersCpuTurn: 'CPU sedang berpikir…',
  checkersMustCapture:
    'Ada bidak yang bisa dimakan — hanya bidak yang bisa melompat yang boleh jalan.',
  checkersJumpAgain: 'Lompat lagi dengan bidak yang sama.',
  checkersKings: 'Raja',
  checkersWinTitle: 'Kamu menang!',
  checkersWinBody: 'CPU tidak punya langkah tersisa.',
  checkersLoseTitle: 'CPU menang',
  checkersLoseBody: 'Tidak ada langkah tersisa. Permainan berikutnya gratis.',
  checkersDrawTitle: 'Seri',
  checkersDrawBody:
    'Lima puluh giliran tanpa makan dan tanpa bidak maju — tidak ada yang berkembang.',
  checkersWins: 'Menang',
  checkersLosses: 'Kalah',
  checkersDraws: 'Seri',
  checkersStep1Title: 'Jalan diagonal ke depan',
  checkersStep1Body:
    'Satu kotak gelap sekali jalan. Lompati bidak lawan untuk memakannya — dan saat bisa melompat, itulah satu-satunya langkah.',
  checkersStep2Title: 'Terus melompat',
  checkersStep2Body:
    'Kalau bidak yang sama bisa melompat lagi dari tempat mendarat, ia harus melompat.',
  checkersStep3Title: 'Capai baris terjauh untuk jadi raja',
  checkersStep3Body:
    'Raja juga jalan mundur. Habiskan semua bidak lawan — atau buat mereka tak bisa jalan — dan kamu menang.',
  checkersConfirmSwitchTitle: 'Ganti permainan yang sedang berjalan?',
  checkersConfirmSwitchBody:
    'Permainan {current} kamu akan diganti dengan permainan {next} yang baru.',
};
