import type { TakuzuMessages } from './en';

export const ptBR: TakuzuMessages = {
  takuzuName: 'Takuzu',
  takuzuBoardLabel: 'Tabuleiro de Takuzu, {size} por {size}',
  takuzuCellEmpty: 'Vazio, linha {row}, coluna {col}',
  takuzuCellZero: '0, linha {row}, coluna {col}',
  takuzuCellOne: '1, linha {row}, coluna {col}',
  takuzuCellFixed: '{digit} inicial, linha {row}, coluna {col}',
  takuzuRuleBroken: 'quebra uma regra',
  takuzuSizeLabel: '{n}×{n}',
  takuzuHintFound: 'A linha destacada decide o quadrado marcado.',
  takuzuHintBroken: 'A linha destacada quebra uma regra.',
  takuzuHintNone: 'Nenhuma jogada certa agora.',
  takuzuSolvedTitle: 'Resolvido!',
  takuzuSolvedBody: 'Todas as linhas e colunas conferem.',
  takuzuHintsUsed: 'Dicas usadas',
  takuzuNewBestTime: 'Seu melhor tempo.',
  takuzuLevelsSolved: 'Níveis resolvidos',
  takuzuDailiesSolved: 'Diários resolvidos',
  takuzuDailyBacklogHint: 'Os dias anteriores continuam abertos.',
  takuzuStep1Title: 'Nunca três seguidos',
  takuzuStep1Body:
    'Toque em um quadrado para alternar 0, 1 e vazio. O mesmo dígito não pode aparecer três vezes seguidas.',
  takuzuStep2Title: 'Meio a meio',
  takuzuStep2Body: 'Cada linha e cada coluna tem tantos 0 quanto 1.',
  takuzuStep3Title: 'Nenhuma linha repetida',
  takuzuStep3Body: 'Não pode haver duas linhas iguais, nem duas colunas iguais.',
};
