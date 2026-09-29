/**
 * pt-br catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same.
 */
import type { BinaryBalanceMessages } from './en';

export const ptBR: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: 'Escolha um tabuleiro',
  binaryBalanceDifficulty_easy: 'Fácil',
  binaryBalanceDifficulty_medium: 'Médio',
  binaryBalanceDifficulty_hard: 'Difícil',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  binaryBalanceConfirmSwitchBody:
    'Seu jogo {current} será substituído por um novo tabuleiro {next}.',
  binaryBalanceBoardLabel: 'Tabuleiro de Binary Balance, {size} por {size}',
  binaryBalanceCellEmpty: 'Vazio, linha {row}, coluna {col}',
  binaryBalanceCellCircle: 'Círculo, linha {row}, coluna {col}',
  binaryBalanceCellSquare: 'Quadrado, linha {row}, coluna {col}',
  binaryBalanceCellFixedCircle: 'Círculo inicial, linha {row}, coluna {col}',
  binaryBalanceCellFixedSquare: 'Quadrado inicial, linha {row}, coluna {col}',
  binaryBalanceLinkSameRight: 'igual ao quadrado da direita',
  binaryBalanceLinkDiffRight: 'diferente do quadrado da direita',
  binaryBalanceLinkSameBelow: 'igual ao quadrado de baixo',
  binaryBalanceLinkDiffBelow: 'diferente do quadrado de baixo',
  binaryBalanceRuleBroken: 'quebra uma regra',
  binaryBalanceMarkCircle: 'um círculo',
  binaryBalanceMarkSquare: 'um quadrado',
  binaryBalanceHintViolation: 'Os quadrados destacados quebram uma regra.',
  binaryBalanceHintWrong: 'A marca com contorno não pode estar certa.',
  binaryBalanceHintPairGap:
    'O par colorido formaria três seguidos, então o quadrado com contorno é {mark}.',
  binaryBalanceHintLineCount:
    'A linha destacada já tem sua metade da marca colorida, então o quadrado com contorno é {mark}.',
  binaryBalanceHintLinkSame:
    'Um = liga o quadrado com contorno ao colorido, então ele também é {mark}.',
  binaryBalanceHintLinkDiff:
    'Um × liga o quadrado com contorno ao colorido, então ele recebe a outra marca: {mark}.',
  binaryBalanceHintLineCompletion:
    'Todas as formas de completar a linha destacada põem {mark} no quadrado com contorno.',
  binaryBalanceHintHypothesis:
    'Se o quadrado com contorno fosse {other}, as jogadas seguintes quebrariam uma regra, então ele é {mark}.',
  binaryBalanceHintNone: 'Nenhuma jogada certa agora.',
  binaryBalanceSolvedTitle: 'Resolvido!',
  binaryBalanceSolvedBody: 'Todas as linhas estão equilibradas e todas as ligações se cumprem.',
  binaryBalanceHintsUsed: 'Dicas usadas',
  binaryBalanceNewBestTime: 'Seu melhor tempo.',
  binaryBalanceNewBoard: 'Novo tabuleiro',
  binaryBalanceDailySection: 'Diário',
  binaryBalanceDailiesSolved: 'Dias resolvidos',
  binaryBalanceDailyBacklogHint: 'Os dias anteriores continuam abertos.',
  binaryBalanceStep1Title: 'Nunca três seguidos',
  binaryBalanceStep1Body:
    'Toque para alternar entre vazio, círculo e quadrado. A mesma marca nunca aparece três vezes seguidas.',
  binaryBalanceStep2Title: 'Meio a meio',
  binaryBalanceStep2Body: 'Cada linha e cada coluna tem tantos círculos quanto quadrados.',
  binaryBalanceStep3Title: 'Siga as ligações',
  binaryBalanceStep3Body:
    'Quadrados ligados por = são iguais; ligados por × são diferentes. Travou? Peça uma dica.',
};
