import type { CrownGridMessages } from './en';

export const es: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Elige un tablero',
  crownGridDifficulty_easy: 'Fácil',
  crownGridDifficulty_medium: 'Medio',
  crownGridDifficulty_hard: 'Difícil',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  crownGridConfirmSwitchBody:
    'Tu partida de {current} se reemplazará por un tablero nuevo de {next}.',
  crownGridBoardLabel: 'Tablero de Crown Grid, {size} por {size}',
  crownGridCellEmpty: 'Vacía, fila {row}, columna {col}, zona {region}',
  crownGridCellCross: 'Tachada, fila {row}, columna {col}, zona {region}',
  crownGridCellCrown: 'Corona, fila {row}, columna {col}, zona {region}',
  crownGridRuleBroken: 'incumple una regla',
  crownGridHintViolation: 'Las coronas resaltadas incumplen una regla.',
  crownGridHintWrong: 'La corona marcada no puede ser correcta.',
  crownGridHintPlace: 'La casilla marcada debe llevar corona: la zona resaltada muestra por qué.',
  crownGridHintEliminate:
    'Ninguna corona puede ir en las casillas marcadas: la zona resaltada muestra por qué.',
  crownGridHintNone: 'Ahora mismo no hay un movimiento seguro.',
  crownGridSolvedTitle: '¡Resuelto!',
  crownGridSolvedBody: 'Cada fila, cada columna y cada zona tiene una corona.',
  crownGridHintsUsed: 'Pistas usadas',
  crownGridNewBestTime: 'Tu tiempo más rápido.',
  crownGridNewBoard: 'Tablero nuevo',
  crownGridDailySection: 'Diario',
  crownGridDailiesSolved: 'Días resueltos',
  crownGridDailyBacklogHint: 'Los días anteriores siguen abiertos.',
  crownGridStep1Title: 'Una corona en cada una',
  crownGridStep1Body: 'Cada fila, cada columna y cada color tiene exactamente una corona.',
  crownGridStep2Title: 'Las coronas no se tocan',
  crownGridStep2Body: 'Dos coronas nunca van juntas, ni siquiera en diagonal.',
  crownGridStep3Title: 'Toca y arrastra',
  crownGridStep3Body:
    'Toca una casilla para alternar ×, corona, vacía; arrastra para marcar varias ×. ¿Atascado? Pide una pista.',
};
