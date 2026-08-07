import type { SchulteMessages } from './en';

export const tr: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: 'Sayı tahtası',
  schulteCell: '{value}, satır {row}, sütun {col}',
  schulteCellDone: '{value}, satır {row}, sütun {col}, dokunuldu',
  schulteFind: 'Bul',

  schulteDoneTitle: 'Hepsi bulundu',
  schulteDoneBody: 'Bütün sayılara sırayla dokundun.',
  schulteMisses: 'Yanlış dokunuş',
  schulteNewBestTime: 'En hızlı zamanın.',
  schulteConfirmRestartBody: 'Bu tur ilk sayıdan yeniden başlar.',

  schulteDailyBacklogHint: 'Geçmiş günlerin hepsi açık kalır.',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'Tamamlanan seviyeler',
  schulteDailiesDone: 'Tamamlanan günlükler',
  schulteTotalMisses: 'Toplam yanlış dokunuş',

  schulteStep1Title: 'Önce 1, sonra 2, sonra 3',
  schulteStep1Body: 'Sayılar dağınık duruyor. Sırayla dokun.',
  schulteStep2Title: 'Aranan sayı tahtanın üstünde',
  schulteStep2Body: 'Yanlış dokunuşun bir bedeli yok. Tahta öylece bekler.',
  schulteStep3Title: 'Tahtayı bitir',
  schulteStep3Body: 'Süren kaydedilir. Zaman sınırı yoktur.',
};
