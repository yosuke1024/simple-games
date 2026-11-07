import type { DurakMessages } from './en';
export const es: DurakMessages = {
  durakPlayed: 'Partidas iniciadas',
  durakFinished: 'Partidas terminadas',
  durakWins: 'Victorias',
  durakYou: 'Tú',
  durakCpu: 'CPU {n}',
  durakCards: '{n} cartas',
  durakField: 'Mesa de cartas',
  durakHand: 'Tu mano',
  durakYourTurn: 'Tu turno',
  durakTurn: 'Turno de {name}…',
  durakJoker: 'Comodín',
  durakCard: '{rank} {suit}',
  durakDraws: 'Empates',
  durakWon: '¡Ganaste!',
  durakLost: 'Partida terminada',
  durakDraw: 'Empate',
  durakName: 'Durak',
  durakIntro: 'Detén el ataque y cambia las tornas.',
  durakRules: '2 asientos · 36 cartas · 6 por persona · El triunfo gana a otros palos.',
  durakStep1Title: 'Ataca con una carta',
  durakStep1Body:
    'El atacante empieza con una carta y luego puede añadir valores que ya estén en la mesa.',
  durakStep2Title: 'Defiende o recoge',
  durakStep2Body:
    'Supera cada ataque con una carta mayor del mismo palo o un triunfo, o recoge la mesa.',
  durakStep3Title: 'Quédate sin cartas',
  durakStep3Body:
    'Repón hasta seis tras cada ataque; cuando se agote el mazo, evita ser la última persona con cartas.',
  durakTrump: 'Triunfo: {suit}',
  durakStockCount: 'Mazo: {n}',
  durakAttackHint:
    'Ataca con una carta resaltada; tras la defensa, añade un valor coincidente o termina.',
  durakDefendHint: 'Supera el ataque sin cubrir o recoge todas las cartas.',
  durakTaking:
    'Se ha elegido recoger; el atacante puede añadir valores coincidentes antes de terminar.',
  durakConfirmTake: 'Confirmar recogida',
  durakDone: 'Terminar ataque',
  durakTake: 'Recoger',
} as const;
