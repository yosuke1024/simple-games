import type { Game2048Messages } from './en';

export const ptBR: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: 'Tabuleiro de 2048, 4 por 4',
  mergeCell: 'Linha {row}, coluna {col}: {value}',
  mergeCellEmpty: 'Linha {row}, coluna {col}: vazia',
  mergeBestScore: 'Melhor pontuação',
  mergeBestTile: 'Maior peça',
  mergeReachedCount: 'Vezes que você chegou a 2048',
  mergeReachedTitle: 'Você chegou a 2048!',
  mergeReachedBody: 'Continue jogando: o tabuleiro ainda tem espaço.',
  mergeKeepGoing: 'Continuar',
  mergeOverTitle: 'Sem jogadas',
  mergeOverBody: 'Todas as casas estão cheias e nada mais pode se juntar.',
  mergeNewBestScore: 'Sua melhor pontuação até agora.',
  mergeStep1Title: 'Deslize para mover',
  mergeStep1Body: 'Todas as peças deslizam juntas, e dois números iguais viram um só.',
  mergeStep2Title: 'Surge uma peça nova',
  mergeStep2Body: 'Uma peça é adicionada a cada jogada que muda o tabuleiro.',
  mergeStep3Title: 'Travou? Volte atrás',
  mergeStep3Body:
    'Desfazer é grátis e ilimitado, e nunca sorteia de novo a peça que acabou de sair.',
};
