/**
 * Spanish catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/es.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const es: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Elige un tablero',
  unblockPuzzleDifficulty_easy: 'Fácil',
  unblockPuzzleDifficulty_medium: 'Medio',
  unblockPuzzleDifficulty_hard: 'Difícil',
  unblockPuzzleRange: '{min}–{max} jugadas',
  unblockPuzzleRangeOpen: '{min} jugadas o más',
  unblockPuzzleConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  unblockPuzzleConfirmSwitchBody:
    'Tu tablero {current} se reemplazará por un tablero {next} nuevo.',
  unblockPuzzleBoardLabel:
    'Tablero de {cols} por {rows}. La salida está en el extremo derecho de la fila {row}.',
  unblockPuzzleBlockTarget:
    'Bloque objetivo, fila {row}, columnas {from} a {to}. Casillas libres: {left} a la izquierda, {right} a la derecha.',
  unblockPuzzleBlockH:
    'Bloque horizontal, fila {row}, columnas {from} a {to}. Casillas libres: {left} a la izquierda, {right} a la derecha.',
  unblockPuzzleBlockV:
    'Bloque vertical, columna {col}, filas {from} a {to}. Casillas libres: {up} arriba, {down} abajo.',
  unblockPuzzleMovesStatus: 'Jugadas {moves} · mínimo {min}',
  unblockPuzzleMoveLeft: 'Mover a la izquierda',
  unblockPuzzleMoveRight: 'Mover a la derecha',
  unblockPuzzleMoveUp: 'Mover hacia arriba',
  unblockPuzzleMoveDown: 'Mover hacia abajo',
  unblockPuzzleSelectPrompt: 'Toca un bloque para moverlo',
  unblockPuzzleHintTarget: 'Pista: desliza el bloque objetivo a las columnas {toFrom}–{toTo}.',
  unblockPuzzleHintH:
    'Pista: desliza el bloque de la fila {row}, columnas {from}–{to}, a las columnas {toFrom}–{toTo}.',
  unblockPuzzleHintV:
    'Pista: desliza el bloque de la columna {col}, filas {from}–{to}, a las filas {toFrom}–{toTo}.',
  unblockPuzzleHintShown: 'Desliza el bloque marcado al contorno punteado.',
  unblockPuzzleHintNone: 'No se encontró ninguna jugada desde aquí.',
  unblockPuzzleSolvedTitle: '¡Completado!',
  unblockPuzzleSolvedBody: 'El bloque objetivo ha salido.',
  unblockPuzzleSolvedOptimal: 'Salió con el mínimo de jugadas.',
  unblockPuzzleFewestLabel: 'Mínimo posible',
  unblockPuzzleNetCellsLabel: 'Desplazamiento neto',
  unblockPuzzleHintsUsed: 'Pistas usadas',
  unblockPuzzleNewBestTime: 'Tu mejor tiempo en nivel {difficulty}.',
  unblockPuzzleNewBestDailyMoves: 'Tu mínimo de jugadas de hoy.',
  unblockPuzzleNewBoard: 'Tablero nuevo',
  unblockPuzzleSolvedCount: 'Tableros completados',
  unblockPuzzleOptimalCount: 'Completados con el mínimo de jugadas',
  unblockPuzzleOverallSection: 'General',
  unblockPuzzleDailiesCleared: 'Retos diarios completados',
  unblockPuzzleStep1Title: 'Desliza por su línea',
  unblockPuzzleStep1Body:
    'Cada bloque solo se desliza por su propia línea: de lado a lado, o arriba y abajo.',
  unblockPuzzleStep2Title: 'Libera el objetivo',
  unblockPuzzleStep2Body:
    'Saca el bloque objetivo por la salida de la derecha para completar el tablero.',
  unblockPuzzleStep3Title: 'Un deslizamiento, una jugada',
  unblockPuzzleStep3Body:
    'Cada deslizamiento cuenta como una jugada, sin importar la distancia, y Deshacer y Pista siempre están ahí.',
};
