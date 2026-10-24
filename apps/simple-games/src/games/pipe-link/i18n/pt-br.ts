/**
 * Brazilian Portuguese catalog for Pipe Link. Provenance (docs/PIPE_LINK_RULES.md §11):
 * machine-written by AI from the English source and **not read by any native
 * speaker** — not a reviewed translation. The title (`pipeLinkName`) is a
 * proper noun and stays as-is; placeholder names match the English source.
 */
import type { PipeLinkMessages } from './en';

export const ptBR: PipeLinkMessages = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'Escolha um tabuleiro',
  pipeLinkDifficulty_easy: 'Fácil',
  pipeLinkDifficulty_medium: 'Médio',
  pipeLinkDifficulty_hard: 'Difícil',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  pipeLinkConfirmSwitchBody:
    'Seu tabuleiro {current} será substituído por um novo tabuleiro {next}.',
  pipeLinkBoardLabel: 'Tabuleiro de Pipe Link, {width} por {height}',
  pipeLinkTile: 'Linha {row}, coluna {col}: {pipes}, {light}',
  pipeLinkTileSource: 'Linha {row}, coluna {col}, a fonte: {pipes}, {light}',
  pipeLinkTileHinted: '{tile}. Dica: gire para {pipes}',
  pipeLinkLit: 'com água',
  pipeLinkUnlit: 'sem água',
  pipeLinkPipes_end_0: 'ponta, aberta para cima',
  pipeLinkPipes_end_1: 'ponta, aberta para a direita',
  pipeLinkPipes_end_2: 'ponta, aberta para baixo',
  pipeLinkPipes_end_3: 'ponta, aberta para a esquerda',
  pipeLinkPipes_straight_0: 'reta, cima e baixo',
  pipeLinkPipes_straight_1: 'reta, esquerda e direita',
  pipeLinkPipes_elbow_0: 'curva, cima e direita',
  pipeLinkPipes_elbow_1: 'curva, direita e baixo',
  pipeLinkPipes_elbow_2: 'curva, baixo e esquerda',
  pipeLinkPipes_elbow_3: 'curva, esquerda e cima',
  pipeLinkPipes_tee_0: 'T, cima, direita e baixo',
  pipeLinkPipes_tee_1: 'T, direita, baixo e esquerda',
  pipeLinkPipes_tee_2: 'T, baixo, esquerda e cima',
  pipeLinkPipes_tee_3: 'T, esquerda, cima e direita',
  pipeLinkAnnounce: 'Linha {row}, coluna {col}: {pipes}. {lit} de {total} peças com água.',
  pipeLinkHintNote:
    'Gire a peça no anel pontilhado até os canos dela coincidirem com os canos claros.',
  pipeLinkHintWhere: 'Marcada: linha {row}, coluna {col}. Gire para {pipes}.',
  pipeLinkSolvedTitle: 'Água em todas as peças',
  pipeLinkSolvedBody: 'A água chega às {tiles} peças.',
  pipeLinkBoardSize: 'Tabuleiro',
  pipeLinkHintsUsed: 'Dicas usadas',
  pipeLinkNewBestTime: 'Seu tempo mais rápido.',
  pipeLinkNewBoard: 'Novo tabuleiro',
  pipeLinkSolvedCount: 'Tabuleiros resolvidos',
  pipeLinkDailySection: 'Diário',
  pipeLinkDailiesCleared: 'Dias concluídos',
  pipeLinkAllModes: 'Todos os modos',
  pipeLinkStep1Title: 'Toque para girar',
  pipeLinkStep1Body: 'Toque numa peça para girá-la um quarto de volta no sentido horário.',
  pipeLinkStep2Title: 'A água corre',
  pipeLinkStep2Body: 'Os canos ligados à fonte se enchem de água; os outros ficam vazios.',
  pipeLinkStep3Title: 'Encha todos os canos',
  pipeLinkStep3Body: 'Quando todos os canos estiverem cheios, o tabuleiro está completo.',
};
