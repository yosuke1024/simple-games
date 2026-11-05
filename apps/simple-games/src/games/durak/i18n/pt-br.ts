import type { DurakMessages } from './en';
export const ptBR: DurakMessages = {
  durakPlayed: 'Partidas iniciadas',
  durakFinished: 'Partidas terminadas',
  durakWins: 'Vitórias',
  durakYou: 'Você',
  durakCpu: 'CPU {n}',
  durakCards: '{n} cartas',
  durakField: 'Mesa de cartas',
  durakHand: 'Sua mão',
  durakYourTurn: 'Sua vez',
  durakTurn: 'Vez de {name}…',
  durakJoker: 'Coringa',
  durakCard: '{rank} {suit}',
  durakDraws: 'Empates',
  durakWon: 'Você venceu!',
  durakLost: 'Partida concluída',
  durakDraw: 'Empate',
  durakName: 'Durak',
  durakIntro: 'Defenda o ataque e vire o jogo.',
  durakRules: '2 lugares · 36 cartas · 6 por pessoa · Trunfo vence outros naipes.',
  durakStep1Title: 'Ataque com uma carta',
  durakStep1Body:
    'O atacante começa com uma carta e depois pode adicionar valores já presentes na mesa.',
  durakStep2Title: 'Defenda ou recolha',
  durakStep2Body:
    'Vença cada ataque com uma carta maior do mesmo naipe ou um trunfo, ou recolha as cartas da mesa.',
  durakStep3Title: 'Acabe com suas cartas',
  durakStep3Body:
    'Reponha até seis após cada ataque; quando o monte acabar, evite ser a última pessoa com cartas.',
  durakTrump: 'Trunfo: {suit}',
  durakStockCount: 'Monte: {n}',
  durakAttackHint:
    'Ataque com uma carta destacada; após a defesa, adicione um valor igual ou termine.',
  durakDefendHint: 'Vença o ataque ainda aberto ou recolha todas as cartas.',
  durakTaking:
    'Foi escolhido recolher; o atacante pode adicionar valores iguais antes de terminar.',
  durakConfirmTake: 'Confirmar recolhimento',
  durakDone: 'Encerrar ataque',
  durakTake: 'Recolher',
} as const;
