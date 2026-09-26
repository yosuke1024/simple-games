/**
 * Turkish catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const tr: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Bir tahta seç',
  numberPathDifficulty_easy: 'Kolay',
  numberPathDifficulty_medium: 'Orta',
  numberPathDifficulty_hard: 'Zor',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path tahtası, {width}×{height}',
  numberPathCellPlain: 'Satır {row}, sütun {col}',
  numberPathCellNumber: 'Sayı {n}, satır {row}, sütun {col}',
  numberPathOnPath: 'yol üzerinde, {step}. adım',
  numberPathOffPath: 'yol dışında',
  numberPathHintNext: 'İşaretli kare bir sonraki adım.',
  numberPathHintBack: 'Yol saptı. İşaretli kareye kadar geri dön.',
  numberPathHintNone: 'Şu an ipucu yok.',
  numberPathHintMarked: 'ipucu',
  numberPathSolvedTitle: 'Çözüldü!',
  numberPathSolvedBody: 'Tek çizgi, her kare, sırayla.',
  numberPathHintsUsed: 'Kullanılan ipuçları',
  numberPathNewBestTime: 'Şimdiye kadarki en hızlın.',
  numberPathNewBoard: 'Yeni tahta',
  numberPathSolvedCount: 'Çözülen tahtalar',
  numberPathDailySection: 'Günlük',
  numberPathDailiesSolved: 'Çözülen günler',
  numberPathDailyBacklogHint: 'Önceki her gün açık kalır.',
  numberPathStep1Title: 'Sayıları izle',
  numberPathStep1Body: '1’den başlayarak tek bir çizgi çiz ve sayılardan sırayla geç.',
  numberPathStep2Title: 'Her kareyi kapla',
  numberPathStep2Body: 'Çizgi her kareden tam bir kez geçer ve son sayıda biter.',
  numberPathStep3Title: 'Duvarlar yolu keser',
  numberPathStep3Body:
    'Kalın kenar geçilemez; geri dönmek için çizgi boyunca geriye sürükle ya da üzerindeki bir kareye dokun.',
};
