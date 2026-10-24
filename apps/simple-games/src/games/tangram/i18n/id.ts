/**
 * Tangram — the Indonesian catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: siluet, bentuk (figure), kepingan (piece), baki (tray), papan
 * (board, as in the shell). Tiers and the daily follow the puzzle shelf
 * (Mudah / Sedang / Sulit, Tantangan Harian).
 */
import type { TangramMessages } from './en';

export const id: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Mudah',
  tangramTier_medium: 'Sedang',
  tangramTier_hard: 'Sulit',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Tantangan Harian, {date}',
  tangramSilhouetteLabel: 'Siluet: {figure}',

  tangramConfirmReplaceTitle: 'Ganti bentuk yang sedang dimainkan?',
  tangramConfirmReplaceBody: 'Bentuk {current} akan diganti dengan {next}.',

  tangramPiece_L1: 'Segitiga besar 1',
  tangramPiece_L2: 'Segitiga besar 2',
  tangramPiece_M: 'Segitiga sedang',
  tangramPiece_P: 'Jajar genjang',
  tangramPiece_SQ: 'Persegi',
  tangramPiece_S1: 'Segitiga kecil 1',
  tangramPiece_S2: 'Segitiga kecil 2',
  tangramPieceInTray: '{piece}, diputar {angle}°, di baki',
  tangramPieceInTrayFlipped: '{piece}, diputar {angle}°, dibalik, di baki',
  tangramPieceOnBoard: '{piece}, diputar {angle}°, di papan',
  tangramPieceOnBoardFlipped: '{piece}, diputar {angle}°, dibalik, di papan',
  tangramPieceFixed: '{piece}, diputar {angle}°, tetap di tempatnya',
  tangramPieceFixedFlipped: '{piece}, diputar {angle}°, dibalik, tetap di tempatnya',

  tangramRotate: 'Putar',
  tangramFlip: 'Balik',

  tangramLifted:
    '{piece} diangkat. Tombol panah menggerakkannya, Enter menaruhnya, Esc mengembalikannya ke baki.',
  tangramFitsOutlineVertex: 'Pas di sudut siluet',
  tangramFitsOutlineEdge: 'Pas di sisi siluet',
  tangramFitsPieceVertex: 'Pas di sudut kepingan lain',
  tangramFitsPieceEdge: 'Pas di sisi kepingan lain',
  tangramNoFit: 'Tidak pas di sini',

  tangramStep1Title: 'Seret dan putar',
  tangramStep1Body:
    'Seret kepingan ke siluet untuk menaruhnya, lalu ketuk untuk memutarnya (tombol Balik membalik jajar genjang).',
  tangramStep2Title: 'Di dalam, tak menumpuk',
  tangramStep2Body: 'Kepingan hanya pas di dalam siluet, dan tak pernah di atas kepingan lain.',
  tangramStep3Title: 'Isi penuh',
  tangramStep3Body: 'Saat ketujuh kepingan mengisi siluet dengan tepat, bentuknya selesai.',

  tangramResultTitle: 'Bentuk selesai',
  tangramNextFigure: 'Bentuk berikutnya',
  tangramTierLabel: 'Tingkat',
  tangramFigureLabel: 'Bentuk',

  tangramStatStarted: 'Bentuk dimulai',
  tangramStatCompleted: 'Bentuk selesai',
  tangramStatDifferent: 'Bentuk berbeda yang selesai',
  tangramStatDays: 'Hari selesai',
  tangramStatsAll: 'Semua permainan',
};
