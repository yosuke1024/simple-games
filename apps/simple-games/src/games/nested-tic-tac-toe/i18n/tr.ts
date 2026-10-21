/**
 * Nested Tic-Tac-Toe — the Turkish catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = küçük tahta · square = kare ·
 * send = göndermek · take / taken = almak / alınmış (never "kazanmak", which
 * is the match) · closed = kapalı · open = açık · first / second = İlk /
 * İkinci · cross / circle = çarpı / yuvarlak. A noun after a number stays
 * singular in Turkish, so the record note keeps the board games' shape.
 */
import type { NestedTicTacToeMessages } from './en';

export const tr: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Rakibini seç',
  nestedTicTacToeDifficulty_easy: 'Kolay',
  nestedTicTacToeDifficulty_normal: 'Normal',
  nestedTicTacToeDifficulty_hard: 'Zor',
  nestedTicTacToeRecordNote: '{wins} galibiyet · {losses} yenilgi',
  nestedTicTacToeChooseSideLabel: 'Kim önce oynasın',
  nestedTicTacToePlayFirst: 'İlk',
  nestedTicTacToePlaySecond: 'İkinci',
  nestedTicTacToePlayFirstLabel: 'İlk, çarpıyla oynar',
  nestedTicTacToePlaySecondLabel: 'İkinci, yuvarlakla oynar',
  nestedTicTacToeConfirmSwitchTitle: 'Devam eden oyun değiştirilsin mi?',
  nestedTicTacToeConfirmSwitchBody: '{current} oyunun yeni bir {next} oyunuyla değiştirilecek.',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe tahtası, dokuz küçük tahta',
  nestedTicTacToeSmallOpen: 'Küçük tahta {board}: açık',
  nestedTicTacToeSmallPlayable: 'Küçük tahta {board}: açık, buraya oyna',
  nestedTicTacToeSmallMine: 'Küçük tahta {board}: sen aldın',
  nestedTicTacToeSmallCpu: 'Küçük tahta {board}: CPU aldı',
  nestedTicTacToeSmallDrawn: 'Küçük tahta {board}: berabere (kapalı)',
  nestedTicTacToeCellEmpty: 'Küçük tahta {board}, kare {square}: boş',
  nestedTicTacToeCellPlayable: 'Küçük tahta {board}, kare {square}: buraya oyna',
  nestedTicTacToeCellYourCross: 'Küçük tahta {board}, kare {square}: senin çarpın',
  nestedTicTacToeCellYourCircle: 'Küçük tahta {board}, kare {square}: senin yuvarlağın',
  nestedTicTacToeCellCpuCross: 'Küçük tahta {board}, kare {square}: CPU’nun çarpısı',
  nestedTicTacToeCellCpuCircle: 'Küçük tahta {board}, kare {square}: CPU’nun yuvarlağı',
  nestedTicTacToeYourTurnSent: 'Sıra sende — çerçeveli tahtaya oyna',
  nestedTicTacToeYourTurnFree: 'Sıra sende — açık herhangi bir tahtaya oyna',
  nestedTicTacToeCpuTurn: 'Sıra CPU’da',
  nestedTicTacToeWinTitle: 'Kazandın',
  nestedTicTacToeWinBody: 'Üç tahtan bir sıra oluşturdu.',
  nestedTicTacToeLoseTitle: 'CPU kazandı',
  nestedTicTacToeLoseBody: 'CPU bir sıra oluşturan üç tahta aldı.',
  nestedTicTacToeDrawTitle: 'Berabere',
  nestedTicTacToeDrawBody:
    'Tüm küçük tahtalar kapandı ve kimsenin üç tahtası bir sıra oluşturmadı.',
  nestedTicTacToeBoardsYou: 'Senin tahtaların',
  nestedTicTacToeBoardsCpu: 'CPU’nun tahtaları',
  nestedTicTacToeWins: 'Galibiyet',
  nestedTicTacToeLosses: 'Yenilgi',
  nestedTicTacToeDraws: 'Beraberlik',
  nestedTicTacToeStep1Title: 'Hamlen rakibini gönderir',
  nestedTicTacToeStep1Body:
    'Küçük bir tahtada oynadığın kare, rakibinin sonra oynayacağı tahtayı belirler.',
  nestedTicTacToeStep2Title: 'Alınmış ya da dolu: açık herhangi bir tahta',
  nestedTicTacToeStep2Body: 'O tahta alınmış ya da doluysa, açık herhangi bir tahtaya oyna.',
  nestedTicTacToeStep3Title: 'Bir sırada üç tahta',
  nestedTicTacToeStep3Body:
    'Üçlü sıra küçük bir tahtayı alır; alınmış üç tahtadan oluşan sıra oyunu kazanır.',
};
