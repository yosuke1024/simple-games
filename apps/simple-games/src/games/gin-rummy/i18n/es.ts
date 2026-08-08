import type { GinRummyMessages } from './en';

export const es: GinRummyMessages = {
  ginName: 'Gin Rummy',

  ginChooseOpponent: 'Elige a tu rival',
  ginDifficulty_easy: 'Fácil',
  ginDifficulty_normal: 'Normal',
  ginDifficulty_hard: 'Difícil',
  ginRecordNote: '{wins} victorias · {losses} derrotas',
  ginConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  ginConfirmSwitchBody: 'Tu partida {current} se reemplazará por una nueva partida {next}.',

  ginTableLabel: 'Mesa de Gin Rummy',
  ginHandLabel: 'Tu mano',
  ginOpponentLabel: 'La CPU tiene {n} cartas',
  ginStockLabel: 'Mazo, {n} cartas',
  ginDiscardLabel: 'Descarte, {card} arriba',
  ginDiscardEmpty: 'Descarte vacío',
  ginCardLabel: '{rank} de {suit}',
  ginSuit_spades: 'picas',
  ginSuit_hearts: 'corazones',
  ginSuit_diamonds: 'diamantes',
  ginSuit_clubs: 'tréboles',
  ginCardInMeld: '{card}, combinación {n}',
  ginCardDeadwood: '{card}, suelta',
  ginDeadwood: 'Sueltas',
  ginYou: 'Tú',
  ginCpu: 'CPU',

  ginUpcardPrompt: 'Toma la carta descubierta o pasa',
  ginDrawPrompt: 'Roba del mazo o del descarte',
  ginDiscardPrompt: 'Toca una carta y tócala otra vez para descartarla',
  ginKnockPrompt: 'Toca la carta con la que hacer knock y tócala otra vez',
  ginCpuTurn: 'La CPU está pensando…',
  ginCpuPassed: 'La CPU pasó la carta descubierta',
  ginCpuDrewStock: 'La CPU robó del mazo',
  ginCpuTookDiscard: 'La CPU tomó {card}',
  ginCpuDiscarded: 'La CPU descartó {card}',
  ginTake: 'Tomar',
  ginPass: 'Pasar',
  ginKnock: 'Knock',

  ginHandGinTitle: 'Gin',
  ginHandKnockTitle: 'Knock',
  ginHandUndercutTitle: 'Undercut',
  ginHandDeadTitle: 'Mano anulada',
  ginHandDeadBody:
    'Quedan dos cartas en el mazo. Nadie puntúa y reparte de nuevo el mismo jugador.',
  ginHandYouTook: 'Te llevas {points}',
  ginHandCpuTook: 'La CPU se lleva {points}',
  ginYourMelds: 'Tus combinaciones',
  ginCpuMelds: 'Combinaciones de la CPU',
  ginLaidOff: 'Cartas añadidas',
  ginNextHand: 'Siguiente mano',

  ginWinTitle: '¡Has ganado!',
  ginWinBody: 'Cien puntos antes que la CPU.',
  ginLoseTitle: 'Gana la CPU',
  ginLoseBody: 'La CPU pasó de cien primero. La próxima partida es gratis.',

  ginWins: 'Victorias',
  ginLosses: 'Derrotas',

  ginStep1Title: 'Roba una, tira otra',
  ginStep1Body: 'Roba del mazo tapado o de lo alto del descarte y luego tira otra carta.',
  ginStep2Title: 'Tríos y escaleras',
  ginStep2Body:
    'Tres del mismo valor o tres seguidas del mismo palo; el resto son cartas sueltas y se cuentan solas.',
  ginStep3Title: 'Knock con diez o menos',
  ginStep3Body:
    'Cuando tus cartas sueltas suman diez o menos, aparece el botón Knock y termina la mano.',
};
