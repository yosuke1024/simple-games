/**
 * Tangram — the Spanish catalog (neutral, leaning Latin American, as the
 * rest of the app). Provenance (docs/TANGRAM_RULES.md §11): `machine` —
 * written by an AI from the English source on 2026-10-21; nobody has read
 * it, native speaker or author. The title (`tangramName`) stays "Tangram".
 *
 * Terms: silueta, figura, pieza, bandeja (tray), tablero (board). Every
 * piece name is masculine (triángulo, paralelogramo, cuadrado), so the
 * participles agree with all of them. "Flip" is Voltear / volteado, apart
 * from Girar / girado. Tiers and the daily follow the puzzle shelf.
 */
import type { TangramMessages } from './en';

export const es: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: 'Fácil',
  tangramTier_medium: 'Medio',
  tangramTier_hard: 'Difícil',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: 'Reto diario, {date}',
  tangramSilhouetteLabel: 'Silueta: {figure}',

  tangramConfirmReplaceTitle: '¿Reemplazar la figura en curso?',
  tangramConfirmReplaceBody: 'La figura {current} se reemplazará por {next}.',

  tangramPiece_L1: 'Triángulo grande 1',
  tangramPiece_L2: 'Triángulo grande 2',
  tangramPiece_M: 'Triángulo mediano',
  tangramPiece_P: 'Paralelogramo',
  tangramPiece_SQ: 'Cuadrado',
  tangramPiece_S1: 'Triángulo pequeño 1',
  tangramPiece_S2: 'Triángulo pequeño 2',
  tangramPieceInTray: '{piece}, girado {angle}°, en la bandeja',
  tangramPieceInTrayFlipped: '{piece}, girado {angle}°, volteado, en la bandeja',
  tangramPieceOnBoard: '{piece}, girado {angle}°, en el tablero',
  tangramPieceOnBoardFlipped: '{piece}, girado {angle}°, volteado, en el tablero',
  tangramPieceFixed: '{piece}, girado {angle}°, fijo en su sitio',
  tangramPieceFixedFlipped: '{piece}, girado {angle}°, volteado, fijo en su sitio',

  tangramRotate: 'Girar',
  tangramFlip: 'Voltear',

  tangramLifted:
    '{piece} levantado. Las flechas lo mueven, Enter lo coloca y Esc lo devuelve a la bandeja.',
  tangramFitsOutlineVertex: 'Encaja en una esquina de la silueta',
  tangramFitsOutlineEdge: 'Encaja en un borde de la silueta',
  tangramFitsPieceVertex: 'Encaja en una esquina de otra pieza',
  tangramFitsPieceEdge: 'Encaja en un borde de otra pieza',
  tangramNoFit: 'No encaja aquí',

  tangramStep1Title: 'Arrastra y gira',
  tangramStep1Body:
    'Arrastra una pieza a la silueta para colocarla y tócala para girarla (Voltear le da la vuelta al paralelogramo).',
  tangramStep2Title: 'Dentro, nunca encima',
  tangramStep2Body: 'Una pieza solo encaja dentro de la silueta, y nunca sobre otra pieza.',
  tangramStep3Title: 'Rellénala',
  tangramStep3Body:
    'Cuando las siete piezas llenan la silueta exactamente, la figura está completa.',

  tangramResultTitle: 'Figura completa',
  tangramNextFigure: 'Siguiente figura',
  tangramTierLabel: 'Nivel',
  tangramFigureLabel: 'Figura',

  tangramStatStarted: 'Figuras empezadas',
  tangramStatCompleted: 'Figuras completadas',
  tangramStatDifferent: 'Figuras distintas completadas',
  tangramStatDays: 'Días completados',
  tangramStatsAll: 'Todas las partidas',
};
