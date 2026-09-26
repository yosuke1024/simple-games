import type { CrownGridMessages } from './en';

export const ptBR: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Escolha um tabuleiro',
  crownGridDifficulty_easy: 'Fácil',
  crownGridDifficulty_medium: 'Médio',
  crownGridDifficulty_hard: 'Difícil',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  crownGridConfirmSwitchBody:
    'Seu jogo de {current} será substituído por um novo tabuleiro de {next}.',
  crownGridBoardLabel: 'Tabuleiro de Crown Grid, {size} por {size}',
  crownGridCellEmpty: 'Vazio, linha {row}, coluna {col}, região {region}',
  crownGridCellCross: 'Riscado, linha {row}, coluna {col}, região {region}',
  crownGridCellCrown: 'Coroa, linha {row}, coluna {col}, região {region}',
  crownGridRuleBroken: 'quebra uma regra',
  crownGridHintViolation: 'As coroas destacadas quebram uma regra.',
  crownGridHintWrong: 'A coroa marcada não pode estar certa.',
  crownGridHintPlace: 'O quadrado marcado precisa de uma coroa — a área destacada mostra por quê.',
  crownGridHintEliminate:
    'Nenhuma coroa pode ficar nos quadrados marcados — a área destacada mostra por quê.',
  crownGridHintNone: 'Nenhuma jogada certa agora.',
  crownGridSolvedTitle: 'Resolvido!',
  crownGridSolvedBody: 'Cada linha, cada coluna e cada região tem uma coroa.',
  crownGridHintsUsed: 'Dicas usadas',
  crownGridNewBestTime: 'Seu tempo mais rápido.',
  crownGridNewBoard: 'Novo tabuleiro',
  crownGridDailySection: 'Diário',
  crownGridDailiesSolved: 'Dias resolvidos',
  crownGridDailyBacklogHint: 'Os dias anteriores continuam abertos.',
  crownGridStep1Title: 'Uma coroa em cada',
  crownGridStep1Body: 'Cada linha, cada coluna e cada cor tem exatamente uma coroa.',
  crownGridStep2Title: 'Coroas nunca se tocam',
  crownGridStep2Body: 'Duas coroas nunca ficam lado a lado, nem na diagonal.',
  crownGridStep3Title: 'Toque e arraste',
  crownGridStep3Body:
    'Toque em um quadrado para alternar ×, coroa, vazio; arraste para marcar vários ×. Travou? Peça uma dica.',
};
