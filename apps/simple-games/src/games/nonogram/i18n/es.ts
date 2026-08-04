import type { NonogramMessages } from './en';

export const es: NonogramMessages = {
  nonoName: 'Nonograma',
  nonoBoardLabel: 'Tablero de nonograma, {size} por {size}',
  nonoCellBlank: 'Vacía, fila {row}, columna {col}',
  nonoCellFilled: 'Pintada, fila {row}, columna {col}',
  nonoCellCrossed: 'Con ×, fila {row}, columna {col}',
  nonoRowClueLabel: 'Fila {n}: {clue}',
  nonoColClueLabel: 'Columna {n}: {clue}',
  nonoSizeLabel: '{n}×{n}',
  nonoXMode: 'Modo X',
  nonoXModeNote: 'Tocar pone una ×; mantener pulsado pinta.',
  nonoHintFound: 'La línea resaltada decide una casilla.',
  nonoHintBroken: 'La línea resaltada ya no encaja con su pista.',
  nonoHintNone: 'Ahora mismo no hay un movimiento seguro.',
  nonoSolvedTitle: '¡Resuelto!',
  nonoSolvedBody: 'Todas las pistas se cumplen.',
  nonoHintsUsed: 'Pistas usadas',
  nonoNewBestTime: 'Tu mejor tiempo.',
  nonoLevelsSolved: 'Niveles resueltos',
  nonoDailiesSolved: 'Diarios resueltos',
  nonoDailyBacklogHint: 'Los días anteriores siguen abiertos.',
  nonoStep1Title: 'Los números son bloques',
  nonoStep1Body:
    'Cada número es un bloque de casillas pintadas, en orden, con al menos un hueco entre bloques.',
  nonoStep2Title: 'Descarta con ×',
  nonoStep2Body: 'Marca con una × las casillas que quedan vacías para acotar la línea.',
  nonoStep3Title: 'Cumple cada línea',
  nonoStep3Body:
    'Cuando todas las filas y columnas cuadran, el tablero está resuelto. Nunca hace falta adivinar.',
};
