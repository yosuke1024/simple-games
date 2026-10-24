/**
 * Spanish catalog for Loop Puzzle — written with AI assistance from the
 * English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md §14). No
 * native speaker has read it; it is not to be treated as reviewed. The title
 * (`loopPuzzleName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source. Terms follow the shell
 * (`hint` = Pista) and Box Regions (board = tablero); an edge is a segmento,
 * a drawn edge a línea, the loop a bucle.
 */
import type { LoopPuzzleMessages } from './en';

export const es: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: 'Elige un tablero',
  loopPuzzleDifficulty_easy: 'Fácil',
  loopPuzzleDifficulty_medium: 'Medio',
  loopPuzzleDifficulty_hard: 'Difícil',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  loopPuzzleConfirmSwitchBody: 'Tu partida {current} se reemplazará por un tablero {next} nuevo.',
  loopPuzzleBoardLabel: 'Tablero de Loop Puzzle, {width} por {height}',
  loopPuzzleEdgeHEmpty: 'Segmento horizontal, fila {row}, columna {col}, vacío',
  loopPuzzleEdgeHLine: 'Segmento horizontal, fila {row}, columna {col}, línea',
  loopPuzzleEdgeHCross: 'Segmento horizontal, fila {row}, columna {col}, marcado con ×',
  loopPuzzleEdgeVEmpty: 'Segmento vertical, fila {row}, columna {col}, vacío',
  loopPuzzleEdgeVLine: 'Segmento vertical, fila {row}, columna {col}, línea',
  loopPuzzleEdgeVCross: 'Segmento vertical, fila {row}, columna {col}, marcado con ×',
  loopPuzzleClueOpen: 'Número {n}, fila {row}, columna {col}',
  loopPuzzleClueMet: 'Número {n}, fila {row}, columna {col}, cumplido',
  loopPuzzleClueTooMany: 'Número {n}, fila {row}, columna {col}, demasiadas líneas',
  loopPuzzleClueTooFew: 'Número {n}, fila {row}, columna {col}, ya no se puede cumplir',
  loopPuzzleNoteHint: 'Marcado por la pista',
  loopPuzzleNoteConflict: 'Incumple una regla',
  loopPuzzleConflictBranch: 'Un punto tiene más de dos líneas.',
  loopPuzzleConflictDeadEnd: 'Una línea termina en un punto sin salida.',
  loopPuzzleConflictLoop: 'Un bucle cerrado deja otras líneas fuera.',
  loopPuzzleConflictTooMany: 'Un número tiene más líneas de las que indica.',
  loopPuzzleConflictTooFew: 'Un número ya no puede tener suficientes líneas.',
  loopPuzzleConflictClosed: 'El bucle está cerrado, pero un número no cuadra.',
  loopPuzzleHintWrongLine: 'La línea marcada no forma parte del bucle.',
  loopPuzzleHintWrongCross: 'El bucle pasa por la × marcada.',
  loopPuzzleHintCellLine: 'El número rodeado necesita una línea en el segmento marcado.',
  loopPuzzleHintCellCross: 'El número rodeado no admite una línea en el segmento marcado.',
  loopPuzzleHintDotLine: 'En el punto rodeado, el bucle debe usar el segmento marcado.',
  loopPuzzleHintDotCross: 'En el punto rodeado, el segmento marcado no puede ser línea.',
  loopPuzzleHintLoopCross: 'Una línea en el segmento marcado cerraría un bucle demasiado pronto.',
  loopPuzzleHintClosedCross:
    'El bucle está cerrado, así que el segmento marcado no forma parte de él.',
  loopPuzzleHintTrialLine: 'Sin línea en el segmento marcado, hay una contradicción.',
  loopPuzzleHintTrialCross: 'Una línea en el segmento marcado lleva a una contradicción.',
  loopPuzzleHintRevealLine: 'El segmento marcado forma parte del bucle.',
  loopPuzzleHintRevealCross: 'El segmento marcado no forma parte del bucle.',
  loopPuzzleHintNone: 'No hay pista por ahora.',
  loopPuzzleSolvedTitle: '¡Resuelto!',
  loopPuzzleSolvedBody: 'Un solo bucle cerrado y todos los números cumplidos.',
  loopPuzzleHintsUsed: 'Pistas usadas',
  loopPuzzleNewBestTime: 'Tu mejor tiempo.',
  loopPuzzleNewBoard: 'Tablero nuevo',
  loopPuzzleSolvedCount: 'Puzles resueltos',
  loopPuzzleDailySection: 'Diario',
  loopPuzzleDailiesCleared: 'Días completados',
  loopPuzzleAllBoards: 'Todos los tableros',
  loopPuzzleStep1Title: 'Un solo bucle cerrado',
  loopPuzzleStep1Body: 'Une los puntos en un solo bucle cerrado que nunca se ramifica ni se cruza.',
  loopPuzzleStep2Title: 'Lee los números',
  loopPuzzleStep2Body: 'Un número indica cuántos de sus cuatro lados usa el bucle.',
  loopPuzzleStep3Title: 'Toca un segmento',
  loopPuzzleStep3Body:
    'Cada toque cambia el segmento a línea, luego a × (fuera del bucle) y luego a vacío.',
};
