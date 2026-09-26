import type { HitAndBlowMessages } from './en';

export const tr: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: 'Zorluk seç',
  hitAndBlowDifficulty_easy: 'Kolay',
  hitAndBlowDifficulty_normal: 'Normal',
  hitAndBlowDifficulty_hard: 'Zor',
  hitAndBlowCodeNote: '{pool} sembolden {slots} tanesi',
  hitAndBlowBestNote: 'En iyi {count}',
  hitAndBlowConfirmSwitchTitle: 'Devam eden oyun değişsin mi?',
  hitAndBlowConfirmSwitchBody: '{current} oyununun yerine yeni bir {next} oyunu gelecek.',

  hitAndBlowSymbol_circle: 'Daire',
  hitAndBlowSymbol_triangle: 'Üçgen',
  hitAndBlowSymbol_square: 'Kare',
  hitAndBlowSymbol_diamond: 'Elmas',
  hitAndBlowSymbol_star: 'Yıldız',
  hitAndBlowSymbol_cross: 'Artı',
  hitAndBlowSymbol_hexagon: 'Altıgen',
  hitAndBlowSymbol_heart: 'Kalp',

  hitAndBlowGuessCounter: '{n}. tahmin',
  hitAndBlowHistoryLabel: 'Şimdiye kadarki tahminler',
  hitAndBlowHistoryEmpty: 'Tahminlerin burada sıralanacak.',
  hitAndBlowRowLabel: '{n}. tahmin: {symbols}. Doğru yer {hits}, Yanlış yer {blows}.',
  hitAndBlowDraftLabel: 'Tahminin',
  hitAndBlowSlotEmpty: 'Kutu {n}: boş',
  hitAndBlowSlotFilled: 'Kutu {n}: {symbol}',
  hitAndBlowPaletteLabel: 'Semboller',
  hitAndBlowCheck: 'Kontrol et',
  hitAndBlowHit: 'Doğru yer',
  hitAndBlowBlow: 'Yanlış yer',

  hitAndBlowWinTitle: 'Kod çözüldü',
  hitAndBlowWinBody: 'Gizli sırayı buldun.',
  hitAndBlowGuessesLabel: 'Tahmin sayısı',
  hitAndBlowNewBest: 'En az tahminin.',
  hitAndBlowSolved: 'Çözülen',
  hitAndBlowFewestGuesses: 'En az tahmin',
  hitAndBlowAverageGuesses: 'Ortalama tahmin',

  hitAndBlowStep1Title: 'Gizli sırayı bul',
  hitAndBlowStep1Body:
    'Farklı sembollerden oluşan gizli bir sıra var. Hangilerinin, hangi sırayla olduğunu bul.',
  hitAndBlowStep2Title: 'Bir tahmin oluştur',
  hitAndBlowStep2Body: "Sırayı doldurmak için sembollere dokun, sonra Kontrol et'e bas.",
  hitAndBlowStep3Title: 'İşaretleri oku',
  hitAndBlowStep3Body:
    '● Doğru yer: sembol ve yer doğru. ○ Yanlış yer: sembol doğru, yer yanlış. İstediğin kadar tahmin edebilirsin.',
};
