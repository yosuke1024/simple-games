import type { Game2048Messages } from './en';

export const tr: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048 tahtası, 4×4',
  mergeCell: 'Satır {row}, sütun {col}: {value}',
  mergeCellEmpty: 'Satır {row}, sütun {col}: boş',
  mergeBestScore: 'En yüksek puan',
  mergeBestTile: 'En büyük karo',
  mergeReachedCount: '2048’e kaç kez ulaştın',
  mergeReachedTitle: '2048’e ulaştın!',
  mergeReachedBody: 'Devam et — tahtada hâlâ yer var.',
  mergeKeepGoing: 'Devam et',
  mergeOverTitle: 'Hamle kalmadı',
  mergeOverBody: 'Bütün kareler dolu ve birleşebilecek bir şey yok.',
  mergeNewBestScore: 'Şimdiye kadarki en yüksek puanın.',
  mergeStep1Title: 'Kaydırarak it',
  mergeStep1Body: 'Bütün karolar aynı anda o yöne kayar ve aynı iki sayı tek karo olur.',
  mergeStep2Title: 'Yeni bir karo gelir',
  mergeStep2Body: 'Tahtayı değiştiren her hamleden sonra bir karo eklenir.',
  mergeStep3Title: 'Tıkandın mı? Geri al',
  mergeStep3Body: 'Geri alma ücretsiz ve sınırsızdır, az önce gelen karoyu yeniden çekmez.',
};
