import type { HeartsMessages } from './en';

export const es: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Elige a tus rivales',
  heartsDifficulty_easy: 'Fácil',
  heartsDifficulty_normal: 'Normal',
  heartsDifficulty_hard: 'Difícil',
  heartsRecordNote: '{wins} victorias · {losses} derrotas · {draws} empates',
  heartsConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  heartsConfirmSwitchBody: 'Tu partida {current} se reemplazará por una nueva partida {next}.',

  heartsTableLabel: 'Mesa de Hearts',
  heartsHandLabel: 'Tu mano',
  heartsTrickLabel: 'La baza',
  heartsTrayLabel: 'Cartas que vas a pasar',
  heartsYou: 'Tú',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Tú: {hand} puntos en esta mano, {total} en la partida',
  heartsSeatLabel: 'CPU {n}: {cards} cartas, {hand} puntos en esta mano, {total} en la partida',
  heartsTookLastTrick: 'Se llevó la última baza',
  heartsCardLabel: '{rank} de {suit}',
  heartsSuit_spades: 'picas',
  heartsSuit_hearts: 'corazones',
  heartsSuit_diamonds: 'diamantes',
  heartsSuit_clubs: 'tréboles',
  heartsCardBlocked: '{card}, ahora no se puede jugar',
  heartsCardChosen: '{card}, elegida para pasar',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Elige tres cartas para pasar',
  heartsPassLeft: 'Pasando a la izquierda',
  heartsPassAcross: 'Pasando al de enfrente',
  heartsPassRight: 'Pasando a la derecha',
  heartsPassConfirm: 'Pasar estas tres',
  heartsPassWaiting: 'Esperando a los demás jugadores…',

  heartsPlayPrompt: 'Toca una carta y tócala otra vez para jugarla',
  heartsCpuTurn: 'Juega la CPU {n}…',
  heartsTrickYou: 'Te llevas la baza',
  heartsTrickCpu: 'La CPU {n} se lleva la baza',

  heartsHandTitle: 'Recuento de la mano',
  heartsMoonTitle: 'Cazó la luna',
  heartsMoonYou:
    'Te llevaste los veintiséis puntos, así que los otros tres jugadores suman 26 cada uno.',
  heartsMoonCpu: 'La CPU {n} se llevó los veintiséis puntos, así que todos los demás suman 26.',
  heartsThisHand: 'Esta mano',
  heartsMatchTotal: 'Partida',
  heartsNextHand: 'Siguiente mano',

  heartsWinTitle: '¡Has ganado!',
  heartsWinBody: 'Menos puntos que nadie cuando alguien pasó de cien.',
  heartsLoseTitle: 'Gana la CPU',
  heartsLoseBody: 'Otro jugador terminó con menos puntos. La próxima partida es gratis.',
  heartsDrawTitle: 'Empate',
  heartsDrawBody: 'Terminaste igualado con otro jugador en la puntuación más baja.',
  heartsFinalScores: 'Puntuación final',

  heartsWins: 'Victorias',
  heartsLosses: 'Derrotas',
  heartsDraws: 'Empates',

  heartsStep1Title: 'Pasa tres cartas',
  heartsStep1Body:
    'Antes de casi todas las manos eliges tres cartas y las pasas: a la izquierda, luego a la derecha, luego al de enfrente, y luego una mano en la que nadie pasa.',
  heartsStep2Title: 'Sigue el palo',
  heartsStep2Body:
    'Quien sale marca el palo y hay que seguirlo mientras se tenga; la carta más alta de ese palo se lleva la baza.',
  heartsStep3Title: 'Gana quien menos puntos tenga',
  heartsStep3Body:
    'Cada corazón que recoges cuesta un punto y la Q de picas cuesta trece, así que cuando alguien pasa de cien gana quien menos puntos tenga.',
};
