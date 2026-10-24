/**
 * Turkish catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = İpucu) and Box Regions (board = tahta); an edge is a kenar, a
 * drawn edge a çizgi, the loop a döngü.
 */
import type { LoopPuzzleMessages } from './en';

export const tr: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Bir tahta seç',
  loopPuzzleDifficulty_easy: 'Kolay',
  loopPuzzleDifficulty_medium: 'Orta',
  loopPuzzleDifficulty_hard: 'Zor',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: 'Devam eden tahta değiştirilsin mi?',
  loopPuzzleConfirmSwitchBody: '{current} oyununuz yeni bir {next} tahtayla değiştirilecek.',
  loopPuzzleBoardLabel: 'Loop Puzzle tahtası, {width} çarpı {height}',
  loopPuzzleEdgeHEmpty: 'Yatay kenar, satır {row}, sütun {col}, boş',
  loopPuzzleEdgeHLine: 'Yatay kenar, satır {row}, sütun {col}, çizgi',
  loopPuzzleEdgeHCross: 'Yatay kenar, satır {row}, sütun {col}, × işaretli',
  loopPuzzleEdgeVEmpty: 'Dikey kenar, satır {row}, sütun {col}, boş',
  loopPuzzleEdgeVLine: 'Dikey kenar, satır {row}, sütun {col}, çizgi',
  loopPuzzleEdgeVCross: 'Dikey kenar, satır {row}, sütun {col}, × işaretli',
  loopPuzzleClueOpen: 'Sayı {n}, satır {row}, sütun {col}',
  loopPuzzleClueMet: 'Sayı {n}, satır {row}, sütun {col}, tamam',
  loopPuzzleClueTooMany: 'Sayı {n}, satır {row}, sütun {col}, çizgi fazla',
  loopPuzzleClueTooFew: 'Sayı {n}, satır {row}, sütun {col}, artık tamamlanamaz',
  loopPuzzleNoteHint: 'İpucunun işaretlediği',
  loopPuzzleNoteConflict: 'Bir kuralı bozuyor',
  loopPuzzleConflictBranch: 'Bir noktada ikiden fazla çizgi var.',
  loopPuzzleConflictDeadEnd: 'Bir çizgi, devamı olmayan bir noktada bitiyor.',
  loopPuzzleConflictLoop: 'Kapalı bir döngünün dışında başka çizgiler var.',
  loopPuzzleConflictTooMany: 'Bir sayının, gösterdiğinden fazla çizgisi var.',
  loopPuzzleConflictTooFew: 'Bir sayı artık yeterli çizgiye ulaşamıyor.',
  loopPuzzleConflictClosed: 'Döngü kapandı ama bir sayı tutmuyor.',
  loopPuzzleHintWrongLine: 'İşaretli çizgi döngünün parçası değil.',
  loopPuzzleHintWrongCross: 'Döngü, işaretli × üzerinden geçiyor.',
  loopPuzzleHintCellLine: 'Daire içindeki sayı, işaretli kenarda çizgi gerektiriyor.',
  loopPuzzleHintCellCross: 'Daire içindeki sayı, işaretli kenara çizgi bırakmıyor.',
  loopPuzzleHintDotLine: 'Daire içindeki noktada döngü işaretli kenarı kullanmalı.',
  loopPuzzleHintDotCross: 'Daire içindeki noktada işaretli kenar çizgi olamaz.',
  loopPuzzleHintLoopCross: 'İşaretli kenara çizgi çekmek bir döngüyü çok erken kapatır.',
  loopPuzzleHintClosedCross: 'Döngü kapalı, bu yüzden işaretli kenar döngüye ait değil.',
  loopPuzzleHintTrialLine: 'İşaretli kenarda çizgi olmazsa çelişki çıkar.',
  loopPuzzleHintTrialCross: 'İşaretli kenara çizgi çekmek çelişkiye yol açar.',
  loopPuzzleHintRevealLine: 'İşaretli kenar döngünün parçası.',
  loopPuzzleHintRevealCross: 'İşaretli kenar döngünün parçası değil.',
  loopPuzzleHintNone: 'Şu an ipucu yok.',
  loopPuzzleSolvedTitle: 'Çözüldü!',
  loopPuzzleSolvedBody: 'Tek bir kapalı döngü, her sayı tamam.',
  loopPuzzleHintsUsed: 'Kullanılan ipuçları',
  loopPuzzleNewBestTime: 'Şimdiye kadarki en hızlı sürün.',
  loopPuzzleNewBoard: 'Yeni tahta',
  loopPuzzleSolvedCount: 'Çözülen bulmacalar',
  loopPuzzleDailySection: 'Günlük',
  loopPuzzleDailiesCleared: 'Tamamlanan günler',
  loopPuzzleAllBoards: 'Tüm tahtalar',
  loopPuzzleStep1Title: 'Tek bir kapalı döngü',
  loopPuzzleStep1Body:
    'Noktaları, hiç dallanmayan ve kendini kesmeyen tek bir kapalı döngüde birleştir.',
  loopPuzzleStep2Title: 'Sayıları oku',
  loopPuzzleStep2Body: 'Bir sayı, dört kenarından kaçını döngünün kullandığını söyler.',
  loopPuzzleStep3Title: 'Bir kenara dokun',
  loopPuzzleStep3Body:
    'Her dokunuş kenarı önce çizgiye, sonra × işaretine (döngüde değil), sonra boşa çevirir.',
};
