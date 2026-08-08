import type { HeartsMessages } from './en';

export const ptBR: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Escolha seus adversários',
  heartsDifficulty_easy: 'Fácil',
  heartsDifficulty_normal: 'Normal',
  heartsDifficulty_hard: 'Difícil',
  heartsRecordNote: '{wins} vitórias · {losses} derrotas · {draws} empates',
  heartsConfirmSwitchTitle: 'Substituir a partida em andamento?',
  heartsConfirmSwitchBody: 'Sua partida {current} será substituída por uma nova partida {next}.',

  heartsTableLabel: 'Mesa de Hearts',
  heartsHandLabel: 'Sua mão',
  heartsTrickLabel: 'A vaza',
  heartsTrayLabel: 'Cartas que você vai passar',
  heartsYou: 'Você',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Você: {hand} pontos nesta mão, {total} na partida',
  heartsSeatLabel: 'CPU {n}: {cards} cartas, {hand} pontos nesta mão, {total} na partida',
  heartsTookLastTrick: 'Levou a última vaza',
  heartsCardLabel: '{rank} de {suit}',
  heartsSuit_spades: 'espadas',
  heartsSuit_hearts: 'copas',
  heartsSuit_diamonds: 'ouros',
  heartsSuit_clubs: 'paus',
  heartsCardBlocked: '{card}, não pode ser jogada agora',
  heartsCardChosen: '{card}, escolhida para passar',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Escolha três cartas para passar',
  heartsPassLeft: 'Passando para a esquerda',
  heartsPassAcross: 'Passando para quem está à frente',
  heartsPassRight: 'Passando para a direita',
  heartsPassConfirm: 'Passar estas três',
  heartsPassWaiting: 'Esperando os outros jogadores…',

  heartsPlayPrompt: 'Toque em uma carta e toque de novo para jogá-la',
  heartsCpuTurn: 'A CPU {n} está jogando…',
  heartsTrickYou: 'Você levou a vaza',
  heartsTrickCpu: 'A CPU {n} levou a vaza',

  heartsHandTitle: 'Contagem da mão',
  heartsMoonTitle: 'Caçou a lua',
  heartsMoonYou:
    'Você levou os vinte e seis pontos, então os outros três jogadores ficam com 26 cada um.',
  heartsMoonCpu: 'A CPU {n} levou os vinte e seis pontos, então todos os outros ficam com 26.',
  heartsThisHand: 'Esta mão',
  heartsMatchTotal: 'Partida',
  heartsNextHand: 'Próxima mão',

  heartsWinTitle: 'Você venceu!',
  heartsWinBody: 'Menos pontos que todos quando alguém passou de cem.',
  heartsLoseTitle: 'A CPU venceu',
  heartsLoseBody: 'Outro jogador terminou com menos pontos. A próxima partida é grátis.',
  heartsDrawTitle: 'Empate',
  heartsDrawBody: 'Você terminou empatado com outro jogador na menor pontuação.',
  heartsFinalScores: 'Pontuação final',

  heartsWins: 'Vitórias',
  heartsLosses: 'Derrotas',
  heartsDraws: 'Empates',

  heartsStep1Title: 'Passe três cartas',
  heartsStep1Body:
    'Antes de quase toda mão você escolhe três cartas e as passa adiante: para a esquerda, depois para a direita, depois para quem está à frente, e depois uma mão em que ninguém passa.',
  heartsStep2Title: 'Siga o naipe',
  heartsStep2Body:
    'Quem sai define o naipe e você tem de segui-lo enquanto tiver; a carta mais alta desse naipe leva a vaza.',
  heartsStep3Title: 'Vence quem fizer menos pontos',
  heartsStep3Body:
    'Cada copas que você recolhe custa um ponto e a Q de espadas custa treze, então quando alguém passa de cem vence quem tiver menos pontos.',
};
