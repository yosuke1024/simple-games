/**
 * Spanish catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const es: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: 'Elige un tablero',
  sudoku6x6Difficulty_easy: 'Fácil',
  sudoku6x6Difficulty_medium: 'Medio',
  sudoku6x6Difficulty_hard: 'Difícil',
  sudoku6x6ConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  sudoku6x6ConfirmSwitchBody: 'Tu partida {current} se reemplazará por un nuevo tablero {next}.',
  sudoku6x6GridLabel: 'Cuadrícula de Sudoku 6×6',
  sudoku6x6PadLabel: 'Teclado numérico',
  sudoku6x6PadKey: '{value}, quedan {n}',
  sudoku6x6PadNoteKey: 'Nota {value}',
  sudoku6x6CellEmpty: 'Vacía, fila {row}, columna {col}',
  sudoku6x6CellGiven: '{value}, inicial, fila {row}, columna {col}',
  sudoku6x6CellEntry: '{value}, fila {row}, columna {col}',
  sudoku6x6Erase: 'Borrar',
  sudoku6x6Notes: 'Notas',
  sudoku6x6HintOnlyDigit: 'Solo una cifra cabe en esta casilla.',
  sudoku6x6HintOnlyCell: 'Aquí {value} solo puede ir en esta casilla.',
  sudoku6x6HintLockedLine: 'En este bloque, {value} solo cabe en la línea resaltada.',
  sudoku6x6HintLockedBox: 'En esta línea, {value} solo cabe en el bloque resaltado.',
  sudoku6x6HintRuledOut: 'Estas casillas descartan esas cifras en el resto del grupo.',
  sudoku6x6HintNone: 'Todavía no se puede deducir nada.',
  sudoku6x6SolvedTitle: '¡Resuelto!',
  sudoku6x6SolvedBody: 'Cada fila, columna y bloque contiene 1-6.',
  sudoku6x6Mistakes: 'Errores',
  sudoku6x6HintsUsed: 'Pistas usadas',
  sudoku6x6NewBestTime: 'Tu tiempo más rápido.',
  sudoku6x6NewBoard: 'Tablero nuevo',
  sudoku6x6DailySection: 'Diario',
  sudoku6x6DailiesSolved: 'Días resueltos',
  sudoku6x6DailyBacklogHint: 'Todos los días anteriores siguen abiertos.',
  sudoku6x6HighlightMistakes: 'Mostrar errores',
  sudoku6x6HighlightMistakesNote:
    'Marca una cifra incorrecta en cuanto se coloca. Las repetidas siempre se marcan.',
  sudoku6x6Step1Title: '1-6, uno de cada',
  sudoku6x6Step1Body: 'Cada fila, columna y bloque de 2×3 contiene del 1 al 6 exactamente una vez.',
  sudoku6x6Step2Title: 'Rellena y anota',
  sudoku6x6Step2Body:
    'Elige una casilla y toca un número. Activa Notas para apuntar los candidatos.',
  sudoku6x6Step3Title: '¿Sin ideas? Pide una pista',
  sudoku6x6Step3Body:
    'Una pista muestra la siguiente casilla de la que puedes estar seguro, y por qué.',
};
