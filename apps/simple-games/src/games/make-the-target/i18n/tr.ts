/**
 * Turkish catalog for Make the Target — written by AI from the English source
 * on 2026-10-21 (provenance `machine`, docs/MAKE_THE_TARGET_RULES.md §13). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`makeTheTargetName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 *
 * Terms: problem = soru (not "sorun", which reads as trouble), target = hedef
 * (not gol or puan), solution = çözüm, the result of one move = sonuç.
 * Expressions are read artı / eksi / çarpı / bölü with "eşittir", left term
 * first. No case suffix is attached to a number placeholder. Shared words
 * follow the shell and Bridges (Kolay / Orta / Zor, Günlük, Tamamlanan günler).
 */
import type { MakeTheTargetMessages } from './en';

export const tr: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: 'Bir zorluk seç',
  makeTheTargetDifficulty_easy: 'Kolay',
  makeTheTargetDifficulty_medium: 'Orta',
  makeTheTargetDifficulty_hard: 'Zor',
  makeTheTargetTierNote_easy: '4 sayı',
  makeTheTargetTierNote_medium: '4 veya 5 sayı',
  makeTheTargetTierNote_hard: '5 sayı',
  makeTheTargetConfirmSwitchTitle: 'Devam eden soru değiştirilsin mi?',
  makeTheTargetConfirmSwitchBody:
    'Devam eden {current} soru, yeni bir {next} soruyla değiştirilecek.',
  makeTheTargetNumbersLabel: 'Sayılar',
  makeTheTargetTargetSpoken: 'Hedef {target}',
  makeTheTargetTargetLabel: 'Hedef',
  makeTheTargetOperatorsLabel: 'İşlem işaretleri',
  makeTheTargetOp_add: 'Topla',
  makeTheTargetOp_subtract: 'Çıkar',
  makeTheTargetOp_multiply: 'Çarp',
  makeTheTargetOp_divide: 'Böl',
  makeTheTargetSpokenLine_add: '{left} artı {right} eşittir {result}',
  makeTheTargetSpokenLine_subtract: '{left} eksi {right} eşittir {result}',
  makeTheTargetSpokenLine_multiply: '{left} çarpı {right} eşittir {result}',
  makeTheTargetSpokenLine_divide: '{left} bölü {right} eşittir {result}',
  makeTheTargetSpokenUndo: 'Geri alındı: {line}',
  makeTheTargetStepsLabel: 'Şimdiye kadarki adımlar',
  makeTheTargetMissed: 'Bu {value} eder, {target} değil.',
  makeTheTargetSpokenMissed: '{line}. Bu {value} eder, {target} değil.',
  makeTheTargetShowSolution: 'Bir çözüm göster',
  makeTheTargetRevealTitle: 'Bir çözüm gösterilsin mi?',
  makeTheTargetRevealBody: 'Bu soru burada biter ve çözülmüş sayılmaz.',
  makeTheTargetRevealConfirm: 'Göster',
  makeTheTargetSolvedTitle: 'Hedefe ulaşıldı.',
  makeTheTargetRevealedTitle: '{target} sayısına ulaşmanın bir yolu',
  makeTheTargetSolutionLabel: 'Bir çözüm',
  makeTheTargetNewBoard: 'Yeni soru',
  makeTheTargetNewBestTime: 'En hızlı zamanın.',
  makeTheTargetSolvedCount: 'Çözülen sorular',
  makeTheTargetDailySection: 'Günlük',
  makeTheTargetDailiesCleared: 'Tamamlanan günler',
  makeTheTargetAllModes: 'Tüm modlar',
  makeTheTargetStep1Title: 'İkisini birleştir',
  makeTheTargetStep1Body:
    'Bir sayıya, sonra + − × ya da ÷ işaretine, sonra başka bir sayıya dokun; ilk dokunduğun sayı solda olur.',
  makeTheTargetStep2Title: 'Yeni bir sayı',
  makeTheTargetStep2Body:
    'O ikisi kullanılmış olur ve sonuç\u00a0— her zaman sıfırdan büyük bir tam sayı\u00a0— onların yerini alır.',
  makeTheTargetStep3Title: 'Hedefe ulaş',
  makeTheTargetStep3Body: 'Bütün sayıları kullan. Son sayı hedefe eşit olunca soru çözülmüş olur.',
};
