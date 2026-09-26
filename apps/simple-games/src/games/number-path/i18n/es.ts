/**
 * Spanish catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const es: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: 'Elige un tablero',
  numberPathDifficulty_easy: 'Fácil',
  numberPathDifficulty_medium: 'Medio',
  numberPathDifficulty_hard: 'Difícil',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Tablero de Number Path, {width} por {height}',
  numberPathCellPlain: 'Fila {row}, columna {col}',
  numberPathCellNumber: 'Número {n}, fila {row}, columna {col}',
  numberPathOnPath: 'en el camino, paso {step}',
  numberPathOffPath: 'fuera del camino',
  numberPathHintNext: 'La casilla marcada es el siguiente paso.',
  numberPathHintBack: 'El camino se ha desviado. Retrocede hasta la casilla marcada.',
  numberPathHintNone: 'No hay pista por ahora.',
  numberPathSolvedTitle: '¡Resuelto!',
  numberPathSolvedBody: 'Una línea, cada casilla, en orden.',
  numberPathHintsUsed: 'Pistas usadas',
  numberPathNewBestTime: 'Tu mejor tiempo hasta ahora.',
  numberPathNewBoard: 'Tablero nuevo',
  numberPathSolvedCount: 'Tableros resueltos',
  numberPathDailySection: 'Diario',
  numberPathDailiesSolved: 'Días resueltos',
  numberPathDailyBacklogHint: 'Los días anteriores siguen abiertos.',
  numberPathStep1Title: 'Sigue los números',
  numberPathStep1Body: 'Traza una sola línea desde el 1, pasando por los números en orden.',
  numberPathStep2Title: 'Cubre cada casilla',
  numberPathStep2Body: 'La línea pasa una vez por cada casilla y termina en el último número.',
  numberPathStep3Title: 'Los muros cierran el paso',
  numberPathStep3Body:
    'Un borde grueso no se puede cruzar; para retroceder, arrastra hacia atrás por la línea o toca una casilla de ella.',
};
