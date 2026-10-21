/**
 * Tangram — the Turkish catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: siluet, şekil (figure), parça (piece), tepsi (tray), tahta (board,
 * as in the shell). No suffix is ever attached to a `{var}` (vowel harmony
 * would depend on the value): a separate word — "ile", "şekli" — follows the
 * slot instead. "Flip" is Ters çevir / ters çevrilmiş, apart from Döndür.
 * Tiers and the daily follow the puzzle shelf (Kolay / Orta / Zor,
 * Günlük Bulmaca).
 */
import type { TangramMessages } from './en';

export const tr: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Kolay',
  tangramTier_medium: 'Orta',
  tangramTier_hard: 'Zor',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Günlük Bulmaca, {date}',
  tangramSilhouetteLabel: 'Siluet: {figure}',

  tangramConfirmReplaceTitle: 'Devam eden şekil değiştirilsin mi?',
  tangramConfirmReplaceBody: 'Devam eden {current} şekli, {next} ile değiştirilecek.',

  tangramPiece_L1: 'Büyük üçgen 1',
  tangramPiece_L2: 'Büyük üçgen 2',
  tangramPiece_M: 'Orta üçgen',
  tangramPiece_P: 'Paralelkenar',
  tangramPiece_SQ: 'Kare',
  tangramPiece_S1: 'Küçük üçgen 1',
  tangramPiece_S2: 'Küçük üçgen 2',
  tangramPieceInTray: '{piece}, {angle}° döndürülmüş, tepside',
  tangramPieceInTrayFlipped: '{piece}, {angle}° döndürülmüş, ters çevrilmiş, tepside',
  tangramPieceOnBoard: '{piece}, {angle}° döndürülmüş, tahtada',
  tangramPieceOnBoardFlipped: '{piece}, {angle}° döndürülmüş, ters çevrilmiş, tahtada',
  tangramPieceFixed: '{piece}, {angle}° döndürülmüş, yerine sabitlenmiş',
  tangramPieceFixedFlipped: '{piece}, {angle}° döndürülmüş, ters çevrilmiş, yerine sabitlenmiş',

  tangramRotate: 'Döndür',
  tangramFlip: 'Ters çevir',

  tangramLifted: '{piece} kaldırıldı. Ok tuşları taşır, Enter yerleştirir, Esc tepsiye geri koyar.',
  tangramFitsOutlineVertex: 'Yerleşir, siluetin bir köşesinde',
  tangramFitsOutlineEdge: 'Yerleşir, siluetin bir kenarında',
  tangramFitsPieceVertex: 'Yerleşir, başka bir parçanın köşesinde',
  tangramFitsPieceEdge: 'Yerleşir, başka bir parçanın kenarında',
  tangramNoFit: 'Buraya yerleşmez',

  tangramStep1Title: 'Sürükle ve döndür',
  tangramStep1Body:
    'Parçayı siluetin üstüne sürükleyip bırak, döndürmek için ona dokun (Ters çevir düğmesi paralelkenarı ters çevirir).',
  tangramStep2Title: 'İçine, üst üste değil',
  tangramStep2Body:
    'Bir parça yalnızca siluetin içine yerleşir, asla başka bir parçanın üstüne değil.',
  tangramStep3Title: 'Doldur',
  tangramStep3Body: 'Yedi parçanın hepsi silueti tam olarak doldurunca şekil tamamlanır.',

  tangramResultTitle: 'Şekil tamamlandı',
  tangramNextFigure: 'Sonraki şekil',
  tangramTierLabel: 'Seviye',
  tangramFigureLabel: 'Şekil',

  tangramStatStarted: 'Başlanan şekiller',
  tangramStatCompleted: 'Tamamlanan şekiller',
  tangramStatDifferent: 'Tamamlanan farklı şekiller',
  tangramStatDays: 'Tamamlanan günler',
  tangramStatsAll: 'Tüm oyunlar',
};
