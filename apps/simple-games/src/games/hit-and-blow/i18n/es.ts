import type { HitAndBlowMessages } from './en';

export const es: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: 'Elige una dificultad',
  hitAndBlowDifficulty_easy: 'Fácil',
  hitAndBlowDifficulty_normal: 'Normal',
  hitAndBlowDifficulty_hard: 'Difícil',
  hitAndBlowCodeNote: '{slots} de {pool} símbolos',
  hitAndBlowBestNote: 'Mejor {count}',
  hitAndBlowConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  hitAndBlowConfirmSwitchBody:
    'Tu partida de {current} se reemplazará por una partida nueva de {next}.',

  hitAndBlowSymbol_circle: 'Círculo',
  hitAndBlowSymbol_triangle: 'Triángulo',
  hitAndBlowSymbol_square: 'Cuadrado',
  hitAndBlowSymbol_diamond: 'Diamante',
  hitAndBlowSymbol_star: 'Estrella',
  hitAndBlowSymbol_cross: 'Cruz',
  hitAndBlowSymbol_hexagon: 'Hexágono',
  hitAndBlowSymbol_heart: 'Corazón',

  hitAndBlowGuessCounter: 'Intento {n}',
  hitAndBlowHistoryLabel: 'Intentos hasta ahora',
  hitAndBlowHistoryEmpty: 'Aquí aparecerán tus intentos.',
  hitAndBlowRowLabel: 'Intento {n}: {symbols}. Acierto {hits}, Presente {blows}.',
  hitAndBlowDraftLabel: 'Tu intento',
  hitAndBlowSlotEmpty: 'Casilla {n}: vacía',
  hitAndBlowSlotFilled: 'Casilla {n}: {symbol}',
  hitAndBlowPaletteLabel: 'Símbolos',
  hitAndBlowCheck: 'Comprobar',
  hitAndBlowHit: 'Acierto',
  hitAndBlowBlow: 'Presente',

  hitAndBlowWinTitle: 'Código descifrado',
  hitAndBlowWinBody: 'Has encontrado la fila oculta.',
  hitAndBlowGuessesLabel: 'Intentos',
  hitAndBlowNewBest: 'Tu menor cantidad de intentos.',
  hitAndBlowSolved: 'Resueltos',
  hitAndBlowFewestGuesses: 'Menos intentos',
  hitAndBlowAverageGuesses: 'Intentos promedio',

  hitAndBlowStep1Title: 'Encuentra la fila oculta',
  hitAndBlowStep1Body:
    'Hay una fila de símbolos distintos oculta. Descubre cuáles son y en qué orden.',
  hitAndBlowStep2Title: 'Arma tu intento',
  hitAndBlowStep2Body: 'Toca los símbolos para llenar la fila y luego pulsa Comprobar.',
  hitAndBlowStep3Title: 'Lee las marcas',
  hitAndBlowStep3Body:
    '● Acierto: símbolo y lugar correctos. ○ Presente: símbolo correcto, lugar incorrecto. Puedes intentarlo tantas veces como quieras.',
};
