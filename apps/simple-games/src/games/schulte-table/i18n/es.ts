import type { SchulteMessages } from './en';

export const es: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: 'Tablero de números',
  schulteCell: '{value}, fila {row}, columna {col}',
  schulteCellDone: '{value}, fila {row}, columna {col}, ya tocado',
  schulteFind: 'Busca',

  schulteDoneTitle: 'Todos encontrados',
  schulteDoneBody: 'Has tocado todos los números en orden.',
  schulteMisses: 'Toques erróneos',
  schulteNewBestTime: 'Tu tiempo más rápido.',
  schulteConfirmRestartBody: 'Esta partida vuelve a empezar desde el primer número.',

  schulteDailyBacklogHint: 'Los días anteriores siempre están disponibles.',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'Niveles completados',
  schulteDailiesDone: 'Retos completados',
  schulteTotalMisses: 'Total de toques erróneos',

  schulteStep1Title: 'Toca 1, luego 2, luego 3',
  schulteStep1Body: 'Los números están desordenados. Tócalos en orden.',
  schulteStep2Title: 'El número a buscar está sobre el tablero',
  schulteStep2Body: 'Un toque erróneo no cuesta nada. El tablero simplemente espera.',
  schulteStep3Title: 'Termina el tablero',
  schulteStep3Body: 'Se registra tu tiempo. No hay límite de tiempo.',
};
