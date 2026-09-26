import type { DominoesMessages } from './en';

export const ptBR: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins} vitórias · {losses} derrotas',

  dominoesTileLabel: 'Pedra {a}–{b}',
  dominoesLineLabel: 'Linha de jogo: {count} pedras, ponta esquerda {left}, ponta direita {right}',
  dominoesHandLabel: 'Suas pedras',
  dominoesPlayLeft: 'Jogar na ponta esquerda ({value})',
  dominoesPlayRight: 'Jogar na ponta direita ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Monte',
  dominoesCpuTiles: 'A CPU tem {count} pedras',
  dominoesBoneyardTiles: 'Monte: {count} pedras',
  dominoesDraw: 'Comprar',
  dominoesPass: 'Passar',

  dominoesYourTurn: 'Sua vez',
  dominoesCpuTurn: 'A CPU está pensando…',
  dominoesCpuDrew: 'A CPU comprou uma pedra',
  dominoesCpuPassed: 'A CPU passou a vez. Sua vez',
  dominoesMustDraw: 'Nenhuma pedra encaixa. Compre do monte',
  dominoesNoTileFits: 'Nenhuma pedra encaixa e o monte está vazio. Passe',
  dominoesChooseEnd: 'Escolha uma ponta para esta pedra',
  dominoesOpenedYou: 'Você abriu com {tile}',
  dominoesOpenedCpu: 'A CPU abriu com {tile}. Sua vez',

  dominoesWinTitle: 'Você venceu!',
  dominoesWinBodyOut: 'Você jogou sua última pedra.',
  dominoesWinBodyBlocked: 'Ninguém conseguiu jogar, e você tinha menos pontos.',
  dominoesLoseTitle: 'A CPU venceu',
  dominoesLoseBodyOut: 'A CPU jogou a última pedra dela.',
  dominoesLoseBodyBlocked: 'Ninguém conseguiu jogar, e a CPU tinha menos pontos.',
  dominoesDrawTitle: 'Empate',
  dominoesDrawBody: 'Ninguém conseguiu jogar, e os pontos ficaram iguais.',
  dominoesScoreYou: 'Você marca {points} pontos',
  dominoesScoreCpu: 'A CPU marca {points} pontos',
  dominoesPipsLeft: 'Pontos restantes: você {you}, CPU {cpu}',

  dominoesWins: 'Vitórias',
  dominoesLosses: 'Derrotas',
  dominoesDraws: 'Empates',

  dominoesStep1Title: 'Encaixe numa ponta',
  dominoesStep1Body: 'Jogue uma pedra cujo número combine com uma das pontas abertas da linha.',
  dominoesStep2Title: 'Travou? Compre',
  dominoesStep2Body:
    'Se nenhuma pedra encaixar, compre do monte até encaixar uma. Só passe quando ele estiver vazio.',
  dominoesStep3Title: 'Seja o primeiro a terminar',
  dominoesStep3Body:
    'Jogue sua última pedra para vencer. Os pontos que sobrarem na mão do outro são sua pontuação.',
};
