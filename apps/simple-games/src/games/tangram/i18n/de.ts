/**
 * Tangram — the German catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: Silhouette, Figur, Teil (all seven piece names are neuter, so "es"
 * fits every one), Ablage (tray), Spielfeld (board). "Flip" is Spiegeln /
 * gespiegelt, so it never reads as the "drehen" of a rotation. The tiers and
 * the daily follow the puzzle shelf (Leicht / Mittel / Schwer, Tagesrätsel).
 */
import type { TangramMessages } from './en';

export const de: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Leicht',
  tangramTier_medium: 'Mittel',
  tangramTier_hard: 'Schwer',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Tagesrätsel, {date}',
  tangramSilhouetteLabel: 'Silhouette: {figure}',

  tangramConfirmReplaceTitle: 'Laufende Figur ersetzen?',
  tangramConfirmReplaceBody: 'Die Figur {current} wird durch {next} ersetzt.',

  tangramPiece_L1: 'Großes Dreieck 1',
  tangramPiece_L2: 'Großes Dreieck 2',
  tangramPiece_M: 'Mittleres Dreieck',
  tangramPiece_P: 'Parallelogramm',
  tangramPiece_SQ: 'Quadrat',
  tangramPiece_S1: 'Kleines Dreieck 1',
  tangramPiece_S2: 'Kleines Dreieck 2',
  tangramPieceInTray: '{piece}, um {angle}° gedreht, in der Ablage',
  tangramPieceInTrayFlipped: '{piece}, um {angle}° gedreht, gespiegelt, in der Ablage',
  tangramPieceOnBoard: '{piece}, um {angle}° gedreht, auf dem Spielfeld',
  tangramPieceOnBoardFlipped: '{piece}, um {angle}° gedreht, gespiegelt, auf dem Spielfeld',
  tangramPieceFixed: '{piece}, um {angle}° gedreht, fest an seinem Platz',
  tangramPieceFixedFlipped: '{piece}, um {angle}° gedreht, gespiegelt, fest an seinem Platz',

  tangramRotate: 'Drehen',
  tangramFlip: 'Spiegeln',

  tangramLifted:
    '{piece} angehoben. Pfeiltasten bewegen es, Enter legt es ab, Esc legt es zurück in die Ablage.',
  tangramFitsOutlineVertex: 'Passt an eine Ecke der Silhouette',
  tangramFitsOutlineEdge: 'Passt an eine Kante der Silhouette',
  tangramFitsPieceVertex: 'Passt an eine Ecke eines anderen Teils',
  tangramFitsPieceEdge: 'Passt an eine Kante eines anderen Teils',
  tangramNoFit: 'Passt hier nicht',

  tangramStep1Title: 'Ziehen und drehen',
  tangramStep1Body:
    'Zieh ein Teil auf die Silhouette, um es abzulegen; Antippen dreht es („Spiegeln“ spiegelt das Parallelogramm).',
  tangramStep2Title: 'Hinein, nie darauf',
  tangramStep2Body: 'Ein Teil passt nur in die Silhouette und nie auf ein anderes Teil.',
  tangramStep3Title: 'Ausfüllen',
  tangramStep3Body: 'Füllen alle sieben Teile die Silhouette genau aus, ist die Figur fertig.',

  tangramResultTitle: 'Figur fertig',
  tangramNextFigure: 'Nächste Figur',
  tangramTierLabel: 'Stufe',
  tangramFigureLabel: 'Figur',

  tangramStatStarted: 'Begonnene Figuren',
  tangramStatCompleted: 'Fertige Figuren',
  tangramStatDifferent: 'Verschiedene fertige Figuren',
  tangramStatDays: 'Gelöste Tage',
  tangramStatsAll: 'Alle Spiele',
};
