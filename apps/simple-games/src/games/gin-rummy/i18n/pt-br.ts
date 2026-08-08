import type { GinRummyMessages } from './en';

export const ptBR: GinRummyMessages = {
  ginName: 'Gin Rummy',

  ginChooseOpponent: 'Escolha seu adversário',
  ginDifficulty_easy: 'Fácil',
  ginDifficulty_normal: 'Normal',
  ginDifficulty_hard: 'Difícil',
  ginRecordNote: '{wins} vitórias · {losses} derrotas',
  ginConfirmSwitchTitle: 'Substituir a partida em andamento?',
  ginConfirmSwitchBody: 'Sua partida {current} será substituída por uma nova partida {next}.',

  ginTableLabel: 'Mesa de Gin Rummy',
  ginHandLabel: 'Sua mão',
  ginOpponentLabel: 'A CPU tem {n} cartas',
  ginStockLabel: 'Monte, {n} cartas',
  ginDiscardLabel: 'Descarte, {card} no topo',
  ginDiscardEmpty: 'Descarte vazio',
  ginCardLabel: '{rank} de {suit}',
  ginSuit_spades: 'espadas',
  ginSuit_hearts: 'copas',
  ginSuit_diamonds: 'ouros',
  ginSuit_clubs: 'paus',
  ginCardInMeld: '{card}, combinação {n}',
  ginCardDeadwood: '{card}, carta solta',
  ginDeadwood: 'Soltas',
  ginYou: 'Você',
  ginCpu: 'CPU',

  ginUpcardPrompt: 'Pegue a carta virada ou passe',
  ginDrawPrompt: 'Compre do monte ou do descarte',
  ginDiscardPrompt: 'Toque em uma carta e toque de novo para descartar',
  ginKnockPrompt: 'Toque na carta usada para bater e toque de novo',
  ginCpuTurn: 'A CPU está pensando…',
  ginCpuPassed: 'A CPU passou a carta virada',
  ginCpuDrewStock: 'A CPU comprou do monte',
  ginCpuTookDiscard: 'A CPU pegou {card}',
  ginCpuDiscarded: 'A CPU descartou {card}',
  ginTake: 'Pegar',
  ginPass: 'Passar',
  ginKnock: 'Bater',

  ginHandGinTitle: 'Gin',
  ginHandKnockTitle: 'Batida',
  ginHandUndercutTitle: 'Undercut',
  ginHandDeadTitle: 'Mão anulada',
  ginHandDeadBody:
    'Restam duas cartas no monte. Ninguém pontua e o mesmo jogador dá as cartas de novo.',
  ginHandYouTook: 'Você fica com {points}',
  ginHandCpuTook: 'A CPU fica com {points}',
  ginYourMelds: 'Suas combinações',
  ginCpuMelds: 'Combinações da CPU',
  ginLaidOff: 'Cartas encaixadas',
  ginNextHand: 'Próxima mão',

  ginWinTitle: 'Você venceu!',
  ginWinBody: 'Cem pontos antes da CPU chegar lá.',
  ginLoseTitle: 'A CPU venceu',
  ginLoseBody: 'A CPU passou de cem primeiro. A próxima partida é grátis.',

  ginWins: 'Vitórias',
  ginLosses: 'Derrotas',

  ginStep1Title: 'Compre uma, descarte outra',
  ginStep1Body: 'Compre do monte fechado ou do topo do descarte e depois descarte outra carta.',
  ginStep2Title: 'Trincas e sequências',
  ginStep2Body:
    'Três do mesmo valor ou três seguidas do mesmo naipe; o resto fica solto e é somado para você.',
  ginStep3Title: 'Bata com dez ou menos',
  ginStep3Body:
    'Quando suas cartas soltas somam dez ou menos, o botão Bater aparece e encerra a mão.',
};
