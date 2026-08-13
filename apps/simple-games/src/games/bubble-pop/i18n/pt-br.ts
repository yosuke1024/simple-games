import type { BubblePopMessages } from './en';

export const ptBR: BubblePopMessages = {
  bubbleName: 'Bubble Pop',
  bubbleBoardLabel: 'Tabuleiro de Bubble Pop',
  bubbleShotsLabel: '{n} tiros até o teto descer',
  bubbleCurrentLabel: 'Bolha atual: {color}',
  bubbleNextLabel: 'Próxima bolha: {color}',
  bubbleSwapLabel: 'Trocar a bolha atual pela próxima',
  bubbleAimLabel: 'Mirando — vai cair na linha {row}, coluna {col}',
  bubbleClearedTitle: 'Tabuleiro limpo!',
  bubbleClearedBody: 'Todas as bolhas caíram.',
  bubbleFailedTitle: 'Desta vez não',
  bubbleFailedBody: 'Tentar de novo é grátis — mesmo tabuleiro, mesmas bolhas.',
  bubbleStep1Title: 'Arraste para mirar',
  bubbleStep1Body:
    'A linha-guia sempre mostra exatamente onde a bolha vai cair — grátis, sempre ativa.',
  bubbleStep2Title: '3 em fileira estouram',
  bubbleStep2Body:
    'Junte 3 ou mais bolhas da mesma cor e elas estouram. Bolhas que ficam flutuando sozinhas também caem.',
  bubbleStep3Title: 'O teto desce aos poucos',
  bubbleStep3Body:
    'A cada poucos tiros, o teto desce uma linha. Limpe as bolhas antes que uma alcance a linha pontilhada.',
  bubbleColor_blue: 'azul',
  bubbleColor_green: 'verde',
  bubbleColor_yellow: 'amarelo',
  bubbleColor_purple: 'roxo',
  bubbleColor_orange: 'laranja',
  bubbleColor_cyan: 'ciano',
};
