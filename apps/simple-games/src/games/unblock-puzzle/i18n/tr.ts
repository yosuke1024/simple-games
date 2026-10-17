/**
 * Turkish catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/tr.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const tr: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Bir tahta seç',
  unblockPuzzleDifficulty_easy: 'Kolay',
  unblockPuzzleDifficulty_medium: 'Orta',
  unblockPuzzleDifficulty_hard: 'Zor',
  unblockPuzzleRange: '{min}–{max} hamle',
  unblockPuzzleRangeOpen: '{min} ve üzeri hamle',
  unblockPuzzleConfirmSwitchTitle: 'Devam eden tahta değiştirilsin mi?',
  unblockPuzzleConfirmSwitchBody: '{current} tahtan yeni bir {next} tahtayla değiştirilecek.',
  unblockPuzzleBoardLabel: 'Tahta, {cols} çarpı {rows}. Çıkış {row}. satırın sağ ucunda.',
  unblockPuzzleBlockTarget:
    'Hedef blok, {row}. satır, {from}–{to}. sütunlar. Boş kareler: solda {left}, sağda {right}.',
  unblockPuzzleBlockH:
    'Yatay blok, {row}. satır, {from}–{to}. sütunlar. Boş kareler: solda {left}, sağda {right}.',
  unblockPuzzleBlockV:
    'Dikey blok, {col}. sütun, {from}–{to}. satırlar. Boş kareler: yukarıda {up}, aşağıda {down}.',
  unblockPuzzleMovesStatus: 'Hamle {moves} · en az {min}',
  unblockPuzzleMoveLeft: 'Sola kaydır',
  unblockPuzzleMoveRight: 'Sağa kaydır',
  unblockPuzzleMoveUp: 'Yukarı kaydır',
  unblockPuzzleMoveDown: 'Aşağı kaydır',
  unblockPuzzleSelectPrompt: 'Kaydırmak için bir bloğa dokun',
  unblockPuzzleHintTarget: 'İpucu: Hedef bloğu {toFrom}–{toTo}. sütunlara kaydır.',
  unblockPuzzleHintH:
    'İpucu: {row}. satırda {from}–{to}. sütunlardaki bloğu {toFrom}–{toTo}. sütunlara kaydır.',
  unblockPuzzleHintV:
    'İpucu: {col}. sütunda {from}–{to}. satırlardaki bloğu {toFrom}–{toTo}. satırlara kaydır.',
  unblockPuzzleHintShown: 'İşaretli bloğu kesik çizgili çerçeveye kaydır.',
  unblockPuzzleHintNone: 'Buradan bir hamle bulunamadı.',
  unblockPuzzleSolvedTitle: 'Tamamlandı!',
  unblockPuzzleSolvedBody: 'Hedef blok dışarı çıktı.',
  unblockPuzzleSolvedOptimal: 'Mümkün olan en az hamleyle çıktı.',
  unblockPuzzleFewestLabel: 'En az hamle',
  unblockPuzzleNetCellsLabel: 'Net kaydırılan kare',
  unblockPuzzleHintsUsed: 'Kullanılan ipuçları',
  unblockPuzzleNewBestTime: '{difficulty} seviyede en iyi süren.',
  unblockPuzzleNewBestDailyMoves: 'Bugünkü tahtada en az hamlen.',
  unblockPuzzleNewBoard: 'Yeni tahta',
  unblockPuzzleSolvedCount: 'Tamamlanan tahtalar',
  unblockPuzzleOptimalCount: 'En az hamleyle tamamlanan',
  unblockPuzzleOverallSection: 'Genel',
  unblockPuzzleDailiesCleared: 'Tamamlanan Günlük Bulmacalar',
  unblockPuzzleStep1Title: 'Kendi hattında kaydır',
  unblockPuzzleStep1Body:
    'Her blok yalnızca kendi hattında kayar: yatay olanlar sağa sola, dikey olanlar yukarı aşağı.',
  unblockPuzzleStep2Title: 'Hedefi çıkar',
  unblockPuzzleStep2Body: 'Tahtayı tamamlamak için hedef bloğu sağdaki çıkıştan dışarı kaydır.',
  unblockPuzzleStep3Title: 'Bir kaydırma, bir hamle',
  unblockPuzzleStep3Body:
    'Ne kadar uzağa kayarsa kaysın, bir kaydırma bir hamle sayılır ve Geri al ile İpucu her zaman kullanılabilir.',
};
