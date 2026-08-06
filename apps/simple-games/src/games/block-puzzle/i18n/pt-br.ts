import type { BlockPuzzleMessages } from './en';

export const ptBR: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: 'Tabuleiro de blocos, 8 por 8',
  blockCellFilled: 'Linha {row}, coluna {col}: ocupada',
  blockCellEmpty: 'Linha {row}, coluna {col}: vazia',
  blockTrayLabel: 'Peças',
  blockPieceLabel: 'Peça {n}, {cells} quadrados',
  blockPieceUsed: 'Peça {n}, já colocada',
  blockPieceSelected: 'Peça {n} selecionada',
  blockBestScore: 'Melhor pontuação',
  blockLines: 'Linhas eliminadas',
  blockOverTitle: 'Sem espaço',
  blockOverBody: 'Nenhuma peça cabe no tabuleiro.',
  blockNewBestScore: 'Sua melhor pontuação até agora.',
  blockStep1Title: 'Arraste uma peça',
  blockStep1Body: 'Leve qualquer uma das três peças até o tabuleiro. Elas nunca giram.',
  blockStep2Title: 'Complete uma linha ou coluna',
  blockStep2Body: 'A linha cheia some, e eliminar várias de uma vez vale mais.',
  blockStep3Title: 'Jogue até nada mais caber',
  blockStep3Body: 'Desfazer é grátis e ilimitado, então errar não custa nada.',
};
