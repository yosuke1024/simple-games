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
  crownGridHintSingle_row:
    'A linha destacada tem apenas um quadrado livre para sua coroa: o contornado.',
  crownGridHintSingle_col:
    'A coluna destacada tem apenas um quadrado livre para sua coroa: o contornado.',
  crownGridHintSingle_region:
    'A região destacada tem apenas um quadrado livre para sua coroa: o contornado.',
  crownGridHintConfine_regionRow:
    'A região destacada só pode ter sua coroa nos quadrados coloridos, todos em uma mesma linha — então os outros quadrados dessa linha (contornados) ficam descartados.',
  crownGridHintConfine_regionCol:
    'A região destacada só pode ter sua coroa nos quadrados coloridos, todos em uma mesma coluna — então os outros quadrados dessa coluna (contornados) ficam descartados.',
  crownGridHintConfine_rowRegion:
    'A linha destacada só pode ter sua coroa nos quadrados coloridos, todos em uma mesma região — então os outros quadrados dessa região (contornados) ficam descartados.',
  crownGridHintConfine_colRegion:
    'A coluna destacada só pode ter sua coroa nos quadrados coloridos, todos em uma mesma região — então os outros quadrados dessa região (contornados) ficam descartados.',
  crownGridHintAttack_row:
    'Uma coroa no quadrado contornado descartaria todos os quadrados coloridos, deixando a linha destacada sem nenhum lugar para sua coroa.',
  crownGridHintAttack_col:
    'Uma coroa no quadrado contornado descartaria todos os quadrados coloridos, deixando a coluna destacada sem nenhum lugar para sua coroa.',
  crownGridHintAttack_region:
    'Uma coroa no quadrado contornado descartaria todos os quadrados coloridos, deixando a região destacada sem nenhum lugar para sua coroa.',
  crownGridHintPair_regionsRows:
    'As duas regiões destacadas só podem ter suas coroas nos quadrados coloridos, que cabem em exatamente duas linhas — então os outros quadrados dessas linhas (contornados) ficam descartados.',
  crownGridHintPair_regionsCols:
    'As duas regiões destacadas só podem ter suas coroas nos quadrados coloridos, que cabem em exatamente duas colunas — então os outros quadrados dessas colunas (contornados) ficam descartados.',
  crownGridHintPair_rowsRegions:
    'As duas linhas destacadas só podem ter suas coroas nos quadrados coloridos, que cabem em exatamente duas regiões — então os outros quadrados dessas regiões (contornados) ficam descartados.',
  crownGridHintPair_colsRegions:
    'As duas colunas destacadas só podem ter suas coroas nos quadrados coloridos, que cabem em exatamente duas regiões — então os outros quadrados dessas regiões (contornados) ficam descartados.',
  crownGridHintHypothesis_row:
    'Tente uma coroa no quadrado contornado: os lances que isso obriga não deixam nenhum lugar para a coroa da linha destacada, então não pode ser esse.',
  crownGridHintHypothesis_col:
    'Tente uma coroa no quadrado contornado: os lances que isso obriga não deixam nenhum lugar para a coroa da coluna destacada, então não pode ser esse.',
  crownGridHintHypothesis_region:
    'Tente uma coroa no quadrado contornado: os lances que isso obriga não deixam nenhum lugar para a coroa da região destacada, então não pode ser esse.',
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
