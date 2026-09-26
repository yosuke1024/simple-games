import type { DominoesMessages } from './en';

export const es: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins} victorias · {losses} derrotas',

  dominoesTileLabel: 'Ficha {a}–{b}',
  dominoesLineLabel:
    'Línea de juego: {count} fichas, extremo izquierdo {left}, extremo derecho {right}',
  dominoesHandLabel: 'Tus fichas',
  dominoesPlayLeft: 'Jugar en el extremo izquierdo ({value})',
  dominoesPlayRight: 'Jugar en el extremo derecho ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Mazo',
  dominoesCpuTiles: 'La CPU tiene {count} fichas',
  dominoesBoneyardTiles: 'Mazo: {count} fichas',
  dominoesDraw: 'Robar',
  dominoesPass: 'Pasar',

  dominoesYourTurn: 'Tu turno',
  dominoesCpuTurn: 'La CPU está pensando…',
  dominoesCpuDrew: 'La CPU robó una ficha',
  dominoesCpuPassed: 'La CPU pasó. Tu turno',
  dominoesMustDraw: 'Ninguna ficha encaja. Roba del mazo',
  dominoesNoTileFits: 'Ninguna ficha encaja y el mazo está vacío. Pasa',
  dominoesChooseEnd: 'Elige un extremo para esta ficha',
  dominoesOpenedYou: 'Abriste con {tile}',
  dominoesOpenedCpu: 'La CPU abrió con {tile}. Tu turno',

  dominoesWinTitle: '¡Has ganado!',
  dominoesWinBodyOut: 'Jugaste tu última ficha.',
  dominoesWinBodyBlocked: 'Nadie pudo jugar, y tenías menos puntos.',
  dominoesLoseTitle: 'Gana la CPU',
  dominoesLoseBodyOut: 'La CPU jugó su última ficha.',
  dominoesLoseBodyBlocked: 'Nadie pudo jugar, y la CPU tenía menos puntos.',
  dominoesDrawTitle: 'Empate',
  dominoesDrawBody: 'Nadie pudo jugar, y los puntos quedaron iguales.',
  dominoesScoreYou: 'Anotas {points} puntos',
  dominoesScoreCpu: 'La CPU anota {points} puntos',
  dominoesPipsLeft: 'Puntos restantes: tú {you}, CPU {cpu}',

  dominoesWins: 'Victorias',
  dominoesLosses: 'Derrotas',
  dominoesDraws: 'Empates',

  dominoesStep1Title: 'Encaja un extremo',
  dominoesStep1Body:
    'Juega una ficha cuyo número coincida con alguno de los extremos abiertos de la línea.',
  dominoesStep2Title: '¿Atascado? Roba',
  dominoesStep2Body:
    'Si ninguna ficha encaja, roba del mazo hasta que encaje una. Pasa solo cuando esté vacío.',
  dominoesStep3Title: 'Sé el primero en salir',
  dominoesStep3Body:
    'Juega tu última ficha para ganar. Los puntos que le quedan al otro jugador son tu puntuación.',
};
