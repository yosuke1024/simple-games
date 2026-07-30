import type { Messages } from './en';

export const id: Messages = {
  numberMatchName: 'Number Match',
  tagline: 'Bisa offline. Tanpa akun. Tanpa paywall.',

  resume: 'Lanjutkan',
  dailyChallenge: 'Tantangan Harian',
  dailyDoneBadge: 'Selesai hari ini',
  howToPlay: 'Cara Bermain',
  statistics: 'Statistik',
  settings: 'Pengaturan',

  modeLevel: 'Level {n}',
  levelSelect: 'Pilih Level',
  levelLocked: 'Level {n}, terkunci',
  nextLevel: 'Level Berikutnya',
  levelsTitle: 'Level',
  reachedLevel: 'Level tercapai',

  score: 'Skor',
  best: 'Terbaik',
  newBest: 'Rekor baru!',
  scoreMatches: 'Pencocokan',
  scoreRows: 'Bonus baris',
  scoreClearBonus: 'Bonus selesai',
  scoreNoHint: 'Bonus tanpa petunjuk',
  bestScores: 'Skor Terbaik',
  totalBest: 'Total skor terbaik level',

  dailyPast: 'Harian Lampau',
  dailyToday: 'Hari ini',
  dailyBacklogHint: 'Selesaikan satu hari untuk membuka hari sebelumnya.',
  modeDaily: 'Harian',
  undo: 'Urungkan',
  hint: 'Petunjuk',
  addNumbers: 'Tambah',
  timeLabel: 'Waktu',
  movesLabel: 'Langkah',
  boardLabel: 'Papan permainan',
  cellLabel: '{value}, baris {row}, kolom {col}',
  cellLabelStone: 'Batu, baris {row}, kolom {col}',
  cellLabelWild: 'Wild, baris {row}, kolom {col}',
  hintNoneToast: 'Tidak ada pasangan — coba "Tambah".',
  wildIntroToast: 'Kotak ✦ bisa dipasangkan dengan angka apa pun.',
  stoneIntroToast: 'Batu tidak bisa dihapus dan menghalangi jalan.',

  clearTitle: 'Papan bersih!',
  clearBody: 'Semua angka berhasil dihapus.',
  gameOverTitle: 'Tidak ada langkah lagi',
  gameOverBody: 'Papan sudah mencapai batas.',
  tryAgain: 'Ulangi papan yang sama',
  backHome: 'Beranda',

  confirmNewGameTitle: 'Mulai permainan baru?',
  confirmNewGameBody: 'Permainan yang sedang berjalan akan hilang.',
  cancel: 'Batal',
  confirm: 'Mulai',

  step1Title: 'Sama, atau berjumlah 10',
  step1Body: 'Pasangkan dua angka yang sama, atau yang jumlahnya 10.',
  step2Title: 'Pilih dua yang terhubung',
  step2Body:
    'Mendatar, menurun, diagonal — atau dari ujung baris ke awal baris berikutnya. Sel kosong bukan penghalang, tetapi angka yang masih ada di antaranya menutup jalur.',
  step3Title: 'Hapus semua untuk menang',
  step3Body:
    'Jika buntu, tekan "Tambah" untuk menambahkan angka tersisa. Urungkan dan petunjuk selalu gratis.',
  startPlaying: 'Mulai Bermain',
  next: 'Lanjut',
  back: 'Kembali',
  close: 'Tutup',

  language: 'Bahasa',
  languageSystem: 'Ikuti perangkat',
  theme: 'Tema',
  themeSystem: 'Sistem',
  themeLight: 'Terang',
  themeDark: 'Gelap',
  sound: 'Suara',
  vibration: 'Getaran',
  reducedMotion: 'Kurangi animasi',
  privacyPolicy: 'Kebijakan Privasi',
  resetData: 'Hapus Data Lokal',
  resetConfirmTitle: 'Hapus semua data lokal?',
  resetConfirmBody:
    'Permainan, statistik, dan pengaturan di perangkat ini akan dihapus. Tidak bisa dibatalkan.',
  delete: 'Hapus',
  version: 'Versi',

  privacy1:
    'Tanpa akun, tanpa pendaftaran. Kami tidak mengumpulkan nama, email, kontak, atau lokasi Anda.',
  privacy2:
    'Progres permainan, statistik, dan pengaturan hanya disimpan di perangkat ini. Kami tidak mengoperasikan server dan tidak ada sinkronisasi cloud.',
  privacy3:
    'Saat online, iklan dari Google AdMob dapat muncul; Google dapat memproses ID iklan perangkat sesuai kebijakan privasinya sendiri. Saat offline, tidak ada iklan dan tidak ada permintaan iklan yang dikirim.',
  privacy4: 'Menghapus aplikasi, atau memakai "Hapus Data Lokal", akan menghapus data Anda.',

  played: 'Permainan dimainkan',
  cleared: 'Berhasil dibersihkan',
  gameOverCount: 'Game over',
  totalTime: 'Total waktu bermain',
  bestTime: 'Selesai tercepat',

  // Collection shell
  collectionTagline: 'Sepenuhnya gratis. Sepenuhnya offline. Langsung main.',
  gamesHeading: 'Game',
  numberMatchBlurb: 'Pasangkan angka yang sama atau berjumlah 10.',
  backToGames: 'Semua game',
  learnMore: 'Pelajari Lebih Lanjut',

  // About & open source
  aboutTitle: 'Tentang aplikasi',
  viewSource: 'Lihat Kode Sumber',
  reportBug: 'Laporkan Masalah',
  suggestGame: 'Usulkan Game',
  viewLicenses: 'Lihat Lisensi',

  // Ads & support
  removeAdsTitle: 'Hapus Iklan & Dukung Simple Games',
  adSupportBody:
    'Simple Games menampilkan satu banner iklan kecil hanya saat online, untuk membantu pemeliharaan dan pengembangan aplikasi. Tidak ingin iklan? Sekali beli, iklan hilang selamanya.',
  removeAdsAction: 'Hapus Iklan',
  restorePurchase: 'Pulihkan Pembelian',
  purchaseThanks: 'Banner iklan sudah dihapus. Terima kasih telah mendukung Simple Games.',
  privacy5:
    'Tersedia pembelian sekali bayar (opsional) untuk menghapus banner iklan. Pembayaran diproses oleh Google Play; PixApps tidak pernah menerima atau menyimpan detail pembayaran.',

  // Sudoku
  sudokuName: 'Sudoku',
  sudokuBlurb: 'Isi setiap baris, kolom, dan blok dengan 1-9.',
  sudokuGridLabel: 'Papan Sudoku',
  sudokuPadLabel: 'Papan angka',
  sudokuPadKey: '{value}, sisa {n}',
  sudokuPadNoteKey: 'Catatan {value}',
  sudokuCellEmpty: 'Kosong, baris {row}, kolom {col}',
  sudokuCellGiven: '{value}, angka awal, baris {row}, kolom {col}',
  sudokuCellEntry: '{value}, baris {row}, kolom {col}',
  sudokuErase: 'Hapus',
  sudokuNotes: 'Catatan',
  sudokuMistakes: 'Kesalahan',
  sudokuTier_easy: 'Mudah',
  sudokuTier_medium: 'Sedang',
  sudokuTier_hard: 'Sulit',
  sudokuSolvedTitle: 'Selesai!',
  sudokuSolvedBody: 'Setiap baris, kolom, dan blok berisi 1-9.',
  sudokuNewBestTime: 'Tercepat sejauh ini.',
  sudokuLevelsSolved: 'Level selesai',
  sudokuDailiesSolved: 'Harian selesai',
  sudokuAverageTime: 'Waktu rata-rata',
  sudokuHighlightMistakes: 'Tandai kesalahan',
  sudokuHighlightMistakesNote: 'Menandai angka yang tidak sesuai jawaban. Angka ganda selalu ditandai.',
  sudokuHintNone: 'Belum ada yang bisa dipastikan.',
  sudokuHintOnlyDigit: 'Hanya satu angka yang cocok di sel ini.',
  sudokuHintOnlyCell: 'Di sini {value} hanya bisa masuk ke sel ini.',
  sudokuHintLockedLine: 'Dalam blok ini, {value} hanya cocok pada garis yang disorot.',
  sudokuHintLockedBox: 'Pada garis ini, {value} hanya cocok di dalam blok yang disorot.',
  sudokuHintRuledOut: 'Sel-sel ini menyingkirkan angka tersebut dari sel lain dalam satu unit.',
  sudokuStep1Title: '1-9, masing-masing sekali',
  sudokuStep1Body: 'Setiap baris, kolom, dan blok 3x3 memuat 1 sampai 9 tepat sekali.',
  sudokuStep2Title: 'Catat kemungkinannya',
  sudokuStep2Body: 'Tekan Catatan untuk menulis angka yang mungkin sambil menyempitkan pilihan.',
  sudokuStep3Title: 'Bingung? Ambil petunjuk',
  sudokuStep3Body: 'Petunjuk menunjukkan sel mana yang sudah pasti dan alasannya. Petunjuk dan undo selalu gratis.',

  // ---- Sliding Puzzle ----
  slideName: 'Sliding Puzzle',
  slideBlurb: 'Geser angka kembali ke urutannya.',

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

  // ---- 2048 ----
  g2048Name: '2048',
  g2048Blurb: 'Geser angka yang sama agar menyatu dan berlipat hingga 2048.',

  g2048ModeClassic: 'Klasik',
  g2048DailyPlayedBadge: 'Sudah main hari ini',

  g2048BoardLabel: 'Papan 2048',
  g2048CellLabel: '{value}, baris {row}, kolom {col}',
  g2048CellEmpty: 'Kosong, baris {row}, kolom {col}',
  g2048Restart: 'Mulai Ulang',

  g2048OverBody: 'Papan penuh dan tidak ada angka yang bisa digabung.',
  g2048WinTitle: 'Anda membuat 2048!',
  g2048WinBody: 'Belum berakhir — teruslah bermain selama Anda mau.',
  g2048KeepPlaying: 'Lanjut Bermain',

  g2048BestScore: 'Skor terbaik',
  g2048BestTile: 'Angka tertinggi',
  g2048Wins: 'Berhasil mencapai 2048',
  g2048DaysPlayed: 'Hari dimainkan',

  g2048Step1Title: 'Geser untuk memindah',
  g2048Step1Body: 'Geser, dan semua angka bergerak ke arah itu sekaligus.',
  g2048Step2Title: 'Angka sama menyatu',
  g2048Step2Body: 'Dua angka yang sama bergabung menjadi dua kali lipatnya.',
  g2048Step3Title: 'Buat 2048',
  g2048Step3Body: 'Buntu? Undo selalu gratis dan tanpa batas, sesering yang Anda mau.',

  // ---- Minesweeper ----
  minesName: 'Minesweeper',
  minesBlurb: 'Buka semua kotak yang tidak berisi ranjau.',

  // Home
  minesChooseBoard: 'Pilih papan',
  minesDifficulty_easy: 'Mudah',
  minesDifficulty_medium: 'Sedang',
  minesDifficulty_hard: 'Sulit',
  minesBoardNote: '{width}×{height} · {mines} ranjau',
  minesConfirmSwitchTitle: 'Ganti papan yang sedang berjalan?',
  minesConfirmSwitchBody: 'Permainan {current} Anda akan diganti dengan papan {next} yang baru.',

  // Board
  minesBoardLabel: 'Ladang ranjau, {width} kolom dan {height} baris',
  minesCellHidden: 'Belum dibuka, baris {row}, kolom {col}',
  minesCellFlagged: 'Ditandai, baris {row}, kolom {col}',
  minesCellEmpty: 'Kosong, baris {row}, kolom {col}',
  minesCellNumber: '{count} ranjau di sekitar, baris {row}, kolom {col}',
  minesCellMine: 'Ranjau, baris {row}, kolom {col}',
  minesMinesLeft: 'Sisa ranjau',
  minesTapToStart: 'Ketuk kotak mana pun. Ketukan pertama selalu aman.',

  // Actions
  minesFlagMode: 'Mode tanda',
  minesFlagModeNote: 'Ketuk untuk menandai; tekan lama untuk membuka.',
  minesHintFound: 'Kotak ini aman — angka yang disorot menjelaskan alasannya.',
  minesHintNone: 'Belum ada yang bisa dipastikan.',
  minesNewBoard: 'Papan baru',

  // Result
  minesWonTitle: 'Selesai!',
  minesWonBody: 'Semua kotak tanpa ranjau sudah terbuka.',
  minesLostTitle: 'Ranjau terbuka',
  minesLostBody: 'Permainan ini berakhir di sini. Papan yang sama siap dicoba lagi.',
  minesNewBestTime: 'Tercepat sejauh ini.',
  minesHintsUsed: 'Petunjuk',

  // Statistics
  minesGamesWon: 'Permainan menang',
  minesWinRate: 'Tingkat menang',
  minesDailySection: 'Harian',
  minesDailiesCleared: 'Hari terselesaikan',

  // Quick Rules
  minesStep1Title: 'Angka menghitung ranjau',
  minesStep1Body: 'Angka menyebut berapa ranjau di delapan kotak sekelilingnya.',
  minesStep2Title: 'Tandai yang sudah pasti',
  minesStep2Body: 'Tekan lama sebuah kotak untuk menandainya. Dengan mode tanda, cukup diketuk.',
  minesStep3Title: 'Buka sisanya untuk menang',
  minesStep3Body: 'Ketukan pertama selalu aman, dan tidak ada papan yang perlu ditebak.',
};
