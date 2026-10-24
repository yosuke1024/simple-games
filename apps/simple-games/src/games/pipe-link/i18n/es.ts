/**
 * Spanish catalog for Pipe Link. Provenance (docs/PIPE_LINK_RULES.md §11):
 * machine-written by AI from the English source and **not read by any native
 * speaker** — not a reviewed translation. The title (`pipeLinkName`) is a
 * proper noun and stays as-is; placeholder names match the English source.
 */
import type { PipeLinkMessages } from './en';

export const es: PipeLinkMessages = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'Elige un tablero',
  pipeLinkDifficulty_easy: 'Fácil',
  pipeLinkDifficulty_medium: 'Medio',
  pipeLinkDifficulty_hard: 'Difícil',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: '¿Reemplazar el tablero en curso?',
  pipeLinkConfirmSwitchBody: 'Tu tablero {current} se reemplazará por un tablero {next} nuevo.',
  pipeLinkBoardLabel: 'Tablero de Pipe Link, {width} por {height}',
  pipeLinkTile: 'Fila {row}, columna {col}: {pipes}, {light}',
  pipeLinkTileSource: 'Fila {row}, columna {col}, la fuente: {pipes}, {light}',
  pipeLinkTileHinted: '{tile}. Pista: gírala a {pipes}',
  pipeLinkLit: 'con agua',
  pipeLinkUnlit: 'sin agua',
  pipeLinkPipes_end_0: 'extremo, abierto arriba',
  pipeLinkPipes_end_1: 'extremo, abierto a la derecha',
  pipeLinkPipes_end_2: 'extremo, abierto abajo',
  pipeLinkPipes_end_3: 'extremo, abierto a la izquierda',
  pipeLinkPipes_straight_0: 'recta, arriba y abajo',
  pipeLinkPipes_straight_1: 'recta, izquierda y derecha',
  pipeLinkPipes_elbow_0: 'codo, arriba y derecha',
  pipeLinkPipes_elbow_1: 'codo, derecha y abajo',
  pipeLinkPipes_elbow_2: 'codo, abajo e izquierda',
  pipeLinkPipes_elbow_3: 'codo, izquierda y arriba',
  pipeLinkPipes_tee_0: 'T, arriba, derecha y abajo',
  pipeLinkPipes_tee_1: 'T, derecha, abajo e izquierda',
  pipeLinkPipes_tee_2: 'T, abajo, izquierda y arriba',
  pipeLinkPipes_tee_3: 'T, izquierda, arriba y derecha',
  pipeLinkAnnounce: 'Fila {row}, columna {col}: {pipes}. {lit} de {total} piezas con agua.',
  pipeLinkHintNote:
    'Gira la pieza del anillo punteado hasta que sus tubos coincidan con los tenues.',
  pipeLinkHintWhere: 'Marcada: fila {row}, columna {col}. Gírala a {pipes}.',
  pipeLinkSolvedTitle: 'Agua en todas las piezas',
  pipeLinkSolvedBody: 'El agua llega a las {tiles} piezas.',
  pipeLinkBoardSize: 'Tablero',
  pipeLinkHintsUsed: 'Pistas usadas',
  pipeLinkNewBestTime: 'Tu tiempo más rápido.',
  pipeLinkNewBoard: 'Tablero nuevo',
  pipeLinkSolvedCount: 'Tableros resueltos',
  pipeLinkDailySection: 'Diario',
  pipeLinkDailiesCleared: 'Días completados',
  pipeLinkAllModes: 'Todos los modos',
  pipeLinkStep1Title: 'Toca para girar',
  pipeLinkStep1Body:
    'Toca una pieza para girarla un cuarto de vuelta en el sentido de las agujas del reloj.',
  pipeLinkStep2Title: 'El agua fluye',
  pipeLinkStep2Body: 'Los tubos unidos a la fuente se llenan de agua; los demás quedan huecos.',
  pipeLinkStep3Title: 'Llena todos los tubos',
  pipeLinkStep3Body: 'Cuando todos los tubos están llenos, el tablero está completo.',
};
