import type { TakuzuMessages } from './en';

export const es: TakuzuMessages = {
  takuzuName: 'Takuzu',
  takuzuBoardLabel: 'Tablero de Takuzu, {size} por {size}',
  takuzuCellEmpty: 'Vacía, fila {row}, columna {col}',
  takuzuCellZero: '0, fila {row}, columna {col}',
  takuzuCellOne: '1, fila {row}, columna {col}',
  takuzuCellFixed: '{digit} inicial, fila {row}, columna {col}',
  takuzuRuleBroken: 'incumple una regla',
  takuzuSizeLabel: '{n}×{n}',
  takuzuHintFound: 'La línea resaltada decide la casilla marcada.',
  takuzuHintBroken: 'La línea resaltada incumple una regla.',
  takuzuHintNone: 'Ahora mismo no hay un movimiento seguro.',
  takuzuSolvedTitle: '¡Resuelto!',
  takuzuSolvedBody: 'Todas las filas y columnas cuadran.',
  takuzuHintsUsed: 'Pistas usadas',
  takuzuNewBestTime: 'Tu mejor tiempo.',
  takuzuLevelsSolved: 'Niveles resueltos',
  takuzuDailiesSolved: 'Diarios resueltos',
  takuzuDailyBacklogHint: 'Los días anteriores siguen abiertos.',
  takuzuStep1Title: 'Nunca tres seguidas',
  takuzuStep1Body:
    'Toca una casilla para pasar por 0, 1 y vacía. La misma cifra no puede ir tres veces seguidas.',
  takuzuStep2Title: 'Mitad y mitad',
  takuzuStep2Body: 'Cada fila y cada columna lleva tantos 0 como 1.',
  takuzuStep3Title: 'Ninguna línea repetida',
  takuzuStep3Body: 'No puede haber dos filas iguales, ni dos columnas iguales.',
};
