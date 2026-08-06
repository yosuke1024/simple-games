import type { Game2048Messages } from './en';

export const id: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: 'Papan 2048, 4 kali 4',
  mergeCell: 'Baris {row}, kolom {col}: {value}',
  mergeCellEmpty: 'Baris {row}, kolom {col}: kosong',
  mergeBestScore: 'Skor terbaik',
  mergeBestTile: 'Ubin terbesar',
  mergeReachedCount: 'Berapa kali mencapai 2048',
  mergeReachedTitle: 'Anda mencapai 2048!',
  mergeReachedBody: 'Lanjutkan saja — papan masih terbuka.',
  mergeKeepGoing: 'Lanjutkan',
  mergeOverTitle: 'Tidak ada langkah lagi',
  mergeOverBody: 'Semua kotak penuh dan tidak ada lagi yang bisa digabung.',
  mergeNewBestScore: 'Skor terbaik Anda sejauh ini.',
  mergeStep1Title: 'Geser untuk menyorong',
  mergeStep1Body: 'Semua ubin meluncur ke arah itu sekaligus, dan dua angka sama menjadi satu.',
  mergeStep2Title: 'Ubin baru muncul',
  mergeStep2Body: 'Satu ubin ditambahkan setiap kali langkah mengubah papan.',
  mergeStep3Title: 'Buntu? Urungkan saja',
  mergeStep3Body: 'Urungkan gratis dan tanpa batas, dan ubin yang baru muncul tidak diacak ulang.',
};
