/**
 * Indonesian catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/id.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const id: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Pilih papan',
  unblockPuzzleDifficulty_easy: 'Mudah',
  unblockPuzzleDifficulty_medium: 'Sedang',
  unblockPuzzleDifficulty_hard: 'Sulit',
  unblockPuzzleRange: '{min}–{max} langkah',
  unblockPuzzleRangeOpen: '{min} langkah atau lebih',
  unblockPuzzleConfirmSwitchTitle: 'Ganti papan yang sedang dimainkan?',
  unblockPuzzleConfirmSwitchBody:
    'Papan {current} Anda akan diganti dengan papan {next} yang baru.',
  unblockPuzzleBoardLabel:
    'Papan, {cols} kali {rows}. Pintu keluar ada di ujung kanan baris {row}.',
  unblockPuzzleBlockTarget:
    'Blok target, baris {row}, kolom {from} sampai {to}. Petak kosong: {left} kiri, {right} kanan.',
  unblockPuzzleBlockH:
    'Blok mendatar, baris {row}, kolom {from} sampai {to}. Petak kosong: {left} kiri, {right} kanan.',
  unblockPuzzleBlockV:
    'Blok tegak, kolom {col}, baris {from} sampai {to}. Petak kosong: {up} atas, {down} bawah.',
  unblockPuzzleMovesStatus: 'Langkah {moves} · minimal {min}',
  unblockPuzzleMoveLeft: 'Geser ke kiri',
  unblockPuzzleMoveRight: 'Geser ke kanan',
  unblockPuzzleMoveUp: 'Geser ke atas',
  unblockPuzzleMoveDown: 'Geser ke bawah',
  unblockPuzzleSelectPrompt: 'Ketuk blok untuk menggesernya',
  unblockPuzzleHintTarget: 'Petunjuk: geser blok target ke kolom {toFrom}–{toTo}.',
  unblockPuzzleHintH:
    'Petunjuk: geser blok di baris {row}, kolom {from}–{to}, ke kolom {toFrom}–{toTo}.',
  unblockPuzzleHintV:
    'Petunjuk: geser blok di kolom {col}, baris {from}–{to}, ke baris {toFrom}–{toTo}.',
  unblockPuzzleHintShown: 'Geser blok yang ditandai ke garis putus-putus.',
  unblockPuzzleHintNone: 'Tidak ada langkah yang ditemukan dari sini.',
  unblockPuzzleSolvedTitle: 'Selesai!',
  unblockPuzzleSolvedBody: 'Blok target sudah keluar.',
  unblockPuzzleSolvedOptimal: 'Keluar dengan langkah minimal.',
  unblockPuzzleFewestLabel: 'Langkah minimal',
  unblockPuzzleNetCellsLabel: 'Perpindahan bersih',
  unblockPuzzleHintsUsed: 'Petunjuk dipakai',
  unblockPuzzleNewBestTime: 'Tercepat Anda di {difficulty}.',
  unblockPuzzleNewBestDailyMoves: 'Langkah tersedikit Anda hari ini.',
  unblockPuzzleNewBoard: 'Papan baru',
  unblockPuzzleSolvedCount: 'Papan selesai',
  unblockPuzzleOptimalCount: 'Selesai dengan langkah minimal',
  unblockPuzzleOverallSection: 'Keseluruhan',
  unblockPuzzleDailiesCleared: 'Tantangan Harian selesai',
  unblockPuzzleStep1Title: 'Geser di jalurnya',
  unblockPuzzleStep1Body:
    'Setiap blok hanya bergeser di jalurnya sendiri: kiri-kanan atau atas-bawah.',
  unblockPuzzleStep2Title: 'Keluarkan target',
  unblockPuzzleStep2Body:
    'Geser blok target keluar lewat pintu di sebelah kanan untuk menyelesaikan papan.',
  unblockPuzzleStep3Title: 'Sekali geser, satu langkah',
  unblockPuzzleStep3Body:
    'Sejauh apa pun bergeser, tetap dihitung satu langkah, dan Urungkan serta Petunjuk selalu tersedia.',
};
