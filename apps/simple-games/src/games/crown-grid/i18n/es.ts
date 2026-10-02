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
  crownGridHintSingle_row:
    'La fila resaltada solo tiene una casilla libre para su corona: la recuadrada.',
  crownGridHintSingle_col:
    'La columna resaltada solo tiene una casilla libre para su corona: la recuadrada.',
  crownGridHintSingle_region:
    'La zona resaltada solo tiene una casilla libre para su corona: la recuadrada.',
  crownGridHintConfine_regionRow:
    'La zona resaltada solo puede tener su corona en las casillas coloreadas, todas en una misma fila — así que las demás casillas de esa fila (recuadradas) quedan descartadas.',
  crownGridHintConfine_regionCol:
    'La zona resaltada solo puede tener su corona en las casillas coloreadas, todas en una misma columna — así que las demás casillas de esa columna (recuadradas) quedan descartadas.',
  crownGridHintConfine_rowRegion:
    'La fila resaltada solo puede tener su corona en las casillas coloreadas, todas en una misma zona — así que las demás casillas de esa zona (recuadradas) quedan descartadas.',
  crownGridHintConfine_colRegion:
    'La columna resaltada solo puede tener su corona en las casillas coloreadas, todas en una misma zona — así que las demás casillas de esa zona (recuadradas) quedan descartadas.',
  crownGridHintAttack_row:
    'Una corona en la casilla recuadrada descartaría todas las casillas coloreadas, dejando a la fila resaltada sin ningún sitio para su corona.',
  crownGridHintAttack_col:
    'Una corona en la casilla recuadrada descartaría todas las casillas coloreadas, dejando a la columna resaltada sin ningún sitio para su corona.',
  crownGridHintAttack_region:
    'Una corona en la casilla recuadrada descartaría todas las casillas coloreadas, dejando a la zona resaltada sin ningún sitio para su corona.',
  crownGridHintPair_regionsRows:
    'Las dos zonas resaltadas solo pueden tener sus coronas en las casillas coloreadas, que caben en exactamente dos filas — así que las demás casillas de esas filas (recuadradas) quedan descartadas.',
  crownGridHintPair_regionsCols:
    'Las dos zonas resaltadas solo pueden tener sus coronas en las casillas coloreadas, que caben en exactamente dos columnas — así que las demás casillas de esas columnas (recuadradas) quedan descartadas.',
  crownGridHintPair_rowsRegions:
    'Las dos filas resaltadas solo pueden tener sus coronas en las casillas coloreadas, que caben en exactamente dos zonas — así que las demás casillas de esas zonas (recuadradas) quedan descartadas.',
  crownGridHintPair_colsRegions:
    'Las dos columnas resaltadas solo pueden tener sus coronas en las casillas coloreadas, que caben en exactamente dos zonas — así que las demás casillas de esas zonas (recuadradas) quedan descartadas.',
  crownGridHintHypothesis_row:
    'Prueba a poner una corona en la casilla recuadrada: las jugadas que eso obliga dejan a la fila resaltada sin ningún sitio para su corona, así que no puede ser esa.',
  crownGridHintHypothesis_col:
    'Prueba a poner una corona en la casilla recuadrada: las jugadas que eso obliga dejan a la columna resaltada sin ningún sitio para su corona, así que no puede ser esa.',
  crownGridHintHypothesis_region:
    'Prueba a poner una corona en la casilla recuadrada: las jugadas que eso obliga dejan a la zona resaltada sin ningún sitio para su corona, así que no puede ser esa.',
  crownGridHintNone: 'Ahora mismo no hay un movimiento seguro.',
  crownGridSolvedTitle: '¡Resuelto!',
  crownGridSolvedBody: 'Cada fila, cada columna y cada zona tiene una corona.',
  crownGridHintsUsed: 'Pistas usadas',
  crownGridNewBestTime: 'Tu tiempo más rápido.',
  crownGridNewBoard: 'Tablero nuevo',
  crownGridDailySection: 'Diario',
  crownGridDailiesSolved: 'Días resueltos',
  crownGridStep1Title: 'Una corona en cada una',
  crownGridStep1Body: 'Cada fila, cada columna y cada color tiene exactamente una corona.',
  crownGridStep2Title: 'Las coronas no se tocan',
  crownGridStep2Body: 'Dos coronas nunca van juntas, ni siquiera en diagonal.',
  crownGridStep3Title: 'Toca y arrastra',
  crownGridStep3Body:
    'Toca una casilla para alternar ×, corona, vacía; arrastra para marcar varias ×. ¿Atascado? Pide una pista.',
};
