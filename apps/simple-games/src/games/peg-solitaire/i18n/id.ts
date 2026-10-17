/**
 * Peg Solitaire — the Indonesian catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The English board
 * is "Gaya Inggris" (English style), so the button does not read as the name
 * of a language.
 */
import type { PegSolitaireMessages } from './en';

export const id: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'Gaya Inggris',
  pegSolitaireBoard_triangle: 'Segitiga',
  pegSolitaireBoardLabel_english: 'Papan gaya Inggris, 33 lubang',
  pegSolitaireBoardLabel_triangle: 'Papan segitiga, 15 lubang',
  pegSolitaireHoleCount: '{count} lubang',

  pegSolitaireChooseBoard: 'Pilih papan',
  pegSolitaireBestNote: 'Sisa tersedikit: {count}',
  pegSolitaireConfirmSwitchTitle: 'Ganti permainan yang sedang berjalan?',
  pegSolitaireConfirmSwitchBody:
    'Permainan {current} yang sedang berjalan akan diganti dengan permainan {next} yang baru.',

  pegSolitaireHoleGrid: 'Baris {row}, kolom {col}: {content}',
  pegSolitaireHoleRow: 'Baris {row}, lubang {place}: {content}',
  pegSolitaireContentPeg: 'pasak',
  pegSolitaireContentPegRing: 'pasak di lubang yang dilingkari',
  pegSolitaireContentEmpty: 'kosong',
  pegSolitaireContentEmptyRing: 'lubang yang dilingkari, kosong',
  pegSolitaireContentLanding: 'kosong, lompatan bisa mendarat di sini',
  pegSolitaireContentLandingRing: 'lubang yang dilingkari, kosong, lompatan bisa mendarat di sini',

  pegSolitairePegsLeft: 'Sisa pasak: {count}',
  pegSolitaireNoJump: 'Pasak ini belum bisa melompat.',

  pegSolitairePerfectTitle: 'Selesai sempurna!',
  pegSolitairePerfectBody: 'Pasak terakhir berada di lubang yang dilingkari.',
  pegSolitaireSingleTitle: 'Sisa satu pasak',
  pegSolitaireSingleBody: 'Pasak terakhir berada di luar lubang yang dilingkari.',
  pegSolitaireStuckTitle: 'Tidak ada lompatan lagi',
  pegSolitaireStuckBody: 'Tak ada pasak yang bisa melompat.',
  pegSolitairePegsLeftLabel: 'Sisa pasak',
  pegSolitaireFewestLabel: 'Tersedikit di papan ini',
  pegSolitaireNewFewest: 'Tersedikit sejauh ini di papan ini.',
  pegSolitaireBoardFact: 'Papan',
  pegSolitaireNewBoard: 'Papan baru',

  pegSolitaireStatFewest: 'Sisa pasak tersedikit',
  pegSolitaireStatPerfect: 'Selesai sempurna',

  pegSolitaireStep1Title: 'Lompati dan singkirkan',
  pegSolitaireStep1Body:
    'Lompatkan pasak melewati pasak di sebelahnya ke lubang kosong — pasak yang dilompati disingkirkan.',
  pegSolitaireStep2Title: 'Hanya garis lurus',
  pegSolitaireStep2Body:
    'Lompatan selalu lurus: ke atas, bawah, dan samping di Gaya Inggris, mengikuti tiga garis di Segitiga.',
  pegSolitaireStep3Title: 'Sisakan yang terakhir',
  pegSolitaireStep3Body:
    'Saat tak ada pasak yang bisa melompat, permainan berakhir — sisakan pasak terakhir di lubang yang dilingkari untuk selesai sempurna.',
};
