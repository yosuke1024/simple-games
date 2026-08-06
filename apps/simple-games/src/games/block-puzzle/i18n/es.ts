import type { BlockPuzzleMessages } from './en';

export const es: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Tablero de bloques, 8 por 8',
  blockCellFilled: 'Fila {row}, columna {col}: ocupada',
  blockCellEmpty: 'Fila {row}, columna {col}: vacía',
  blockTrayLabel: 'Piezas',
  blockPieceLabel: 'Pieza {n}, {cells} casillas',
  blockPieceUsed: 'Pieza {n}, ya colocada',
  blockPieceSelected: 'Pieza {n} seleccionada',
  blockBestScore: 'Mejor puntuación',
  blockLines: 'Líneas completadas',
  blockOverTitle: 'No queda sitio',
  blockOverBody: 'Ninguna pieza cabe en el tablero.',
  blockNewBestScore: 'Tu mejor puntuación hasta ahora.',
  blockStep1Title: 'Arrastra una pieza',
  blockStep1Body: 'Lleva cualquiera de las tres piezas al tablero. Nunca giran.',
  blockStep2Title: 'Completa una fila o columna',
  blockStep2Body: 'Una línea llena desaparece, y despejar varias a la vez vale más.',
  blockStep3Title: 'Juega hasta que no quepa nada',
  blockStep3Body: 'Deshacer es gratis e ilimitado: colocar mal no cuesta nada.',
};
