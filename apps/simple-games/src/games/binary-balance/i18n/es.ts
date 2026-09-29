/**
 * es catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same.
 */
import type { BinaryBalanceMessages } from './en';

export const es: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Elige un tablero',
  binaryBalanceDifficulty_easy: 'Fácil',
  binaryBalanceDifficulty_medium: 'Medio',
  binaryBalanceDifficulty_hard: 'Difícil',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  binaryBalanceConfirmSwitchBody:
    'Tu partida {current} se reemplazará por un tablero {next} nuevo.',
  binaryBalanceBoardLabel: 'Tablero de Binary Balance, {size} por {size}',
  binaryBalanceCellEmpty: 'Vacía, fila {row}, columna {col}',
  binaryBalanceCellCircle: 'Círculo, fila {row}, columna {col}',
  binaryBalanceCellSquare: 'Cuadrado, fila {row}, columna {col}',
  binaryBalanceCellFixedCircle: 'Círculo inicial, fila {row}, columna {col}',
  binaryBalanceCellFixedSquare: 'Cuadrado inicial, fila {row}, columna {col}',
  binaryBalanceLinkSameRight: 'igual que la casilla de la derecha',
  binaryBalanceLinkDiffRight: 'distinta de la casilla de la derecha',
  binaryBalanceLinkSameBelow: 'igual que la casilla de abajo',
  binaryBalanceLinkDiffBelow: 'distinta de la casilla de abajo',
  binaryBalanceRuleBroken: 'incumple una regla',
  binaryBalanceMarkCircle: 'un círculo',
  binaryBalanceMarkSquare: 'un cuadrado',
  binaryBalanceHintViolation: 'Las casillas resaltadas incumplen una regla.',
  binaryBalanceHintWrong: 'La marca con contorno no puede ser correcta.',
  binaryBalanceHintPairGap:
    'La pareja sombreada formaría tres seguidas, así que la casilla con contorno es {mark}.',
  binaryBalanceHintLineCount:
    'La línea resaltada ya tiene su mitad de la marca sombreada, así que la casilla con contorno es {mark}.',
  binaryBalanceHintLinkSame:
    'Un = une la casilla con contorno con la sombreada, así que también es {mark}.',
  binaryBalanceHintLinkDiff:
    'Una × une la casilla con contorno con la sombreada, así que lleva la otra marca: {mark}.',
  binaryBalanceHintLineCompletion:
    'Todas las formas de completar la línea resaltada ponen {mark} en la casilla con contorno.',
  binaryBalanceHintHypothesis:
    'Si la casilla con contorno fuera {other}, las jugadas siguientes incumplirían una regla, así que es {mark}.',
  binaryBalanceHintNone: 'Ahora mismo no hay un movimiento seguro.',
  binaryBalanceSolvedTitle: '¡Resuelto!',
  binaryBalanceSolvedBody: 'Todas las líneas están equilibradas y todos los enlaces se cumplen.',
  binaryBalanceHintsUsed: 'Pistas usadas',
  binaryBalanceNewBestTime: 'Tu mejor tiempo.',
  binaryBalanceNewBoard: 'Tablero nuevo',
  binaryBalanceDailySection: 'Diario',
  binaryBalanceDailiesSolved: 'Días resueltos',
  binaryBalanceDailyBacklogHint: 'Los días anteriores siguen abiertos.',
  binaryBalanceStep1Title: 'Nunca tres seguidas',
  binaryBalanceStep1Body:
    'Toca para alternar entre vacía, círculo y cuadrado. La misma marca nunca va tres veces seguidas.',
  binaryBalanceStep2Title: 'Mitad y mitad',
  binaryBalanceStep2Body: 'Cada fila y cada columna lleva tantos círculos como cuadrados.',
  binaryBalanceStep3Title: 'Sigue los enlaces',
  binaryBalanceStep3Body:
    'Las casillas unidas por = son iguales; las unidas por × son distintas. ¿Atascado? Pide una pista.',
};
