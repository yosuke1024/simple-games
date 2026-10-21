/**
 * Tangram — the French catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21;
 * nobody has read it, native speaker or author. The title (`tangramName`)
 * stays "Tangram".
 *
 * Terms: silhouette, figure, pièce, réserve (tray), plateau (board). Every
 * piece name is masculine (triangle, parallélogramme, carré), so the
 * participles agree with all of them. A turn is Pivoter / pivoté and "Flip"
 * is Retourner / retourné — "tourner" is avoided so the two never sound
 * alike. Tiers and the daily follow the puzzle shelf.
 */
import type { TangramMessages } from './en';

export const fr: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Facile',
  tangramTier_medium: 'Moyen',
  tangramTier_hard: 'Difficile',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Défi du jour, {date}',
  tangramSilhouetteLabel: 'Silhouette : {figure}',

  tangramConfirmReplaceTitle: 'Remplacer la figure en cours ?',
  tangramConfirmReplaceBody: 'La figure {current} sera remplacée par {next}.',

  tangramPiece_L1: 'Grand triangle 1',
  tangramPiece_L2: 'Grand triangle 2',
  tangramPiece_M: 'Triangle moyen',
  tangramPiece_P: 'Parallélogramme',
  tangramPiece_SQ: 'Carré',
  tangramPiece_S1: 'Petit triangle 1',
  tangramPiece_S2: 'Petit triangle 2',
  tangramPieceInTray: '{piece}, pivoté de {angle}°, dans la réserve',
  tangramPieceInTrayFlipped: '{piece}, pivoté de {angle}°, retourné, dans la réserve',
  tangramPieceOnBoard: '{piece}, pivoté de {angle}°, sur le plateau',
  tangramPieceOnBoardFlipped: '{piece}, pivoté de {angle}°, retourné, sur le plateau',
  tangramPieceFixed: '{piece}, pivoté de {angle}°, fixé à sa place',
  tangramPieceFixedFlipped: '{piece}, pivoté de {angle}°, retourné, fixé à sa place',

  tangramRotate: 'Pivoter',
  tangramFlip: 'Retourner',

  tangramLifted:
    '{piece} soulevé. Les flèches le déplacent, Entrée le pose, Échap le renvoie dans la réserve.',
  tangramFitsOutlineVertex: 'Se place sur un coin de la silhouette',
  tangramFitsOutlineEdge: 'Se place sur un bord de la silhouette',
  tangramFitsPieceVertex: 'Se place sur un coin d’une autre pièce',
  tangramFitsPieceEdge: 'Se place sur un bord d’une autre pièce',
  tangramNoFit: 'Ne se place pas ici',

  tangramStep1Title: 'Glisser et pivoter',
  tangramStep1Body:
    'Glissez une pièce sur la silhouette pour la poser, et touchez-la pour la faire pivoter (Retourner retourne le parallélogramme).',
  tangramStep2Title: 'Dedans, jamais dessus',
  tangramStep2Body: 'Une pièce ne se place que dans la silhouette, et jamais sur une autre pièce.',
  tangramStep3Title: 'Remplir',
  tangramStep3Body:
    'Quand les sept pièces remplissent exactement la silhouette, la figure est terminée.',

  tangramResultTitle: 'Figure terminée',
  tangramNextFigure: 'Figure suivante',
  tangramTierLabel: 'Niveau',
  tangramFigureLabel: 'Figure',

  tangramStatStarted: 'Figures commencées',
  tangramStatCompleted: 'Figures terminées',
  tangramStatDifferent: 'Figures différentes terminées',
  tangramStatDays: 'Jours réussis',
  tangramStatsAll: 'Toutes les parties',
};
