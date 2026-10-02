/**
 * Brazilian Portuguese catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const ptBR: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Escolha um tabuleiro',
  shapeRegionsDifficulty_easy: 'Fácil',
  shapeRegionsDifficulty_medium: 'Médio',
  shapeRegionsDifficulty_hard: 'Difícil',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  shapeRegionsConfirmSwitchBody:
    'Seu jogo {current} será substituído por um novo tabuleiro {next}.',
  shapeRegionsBoardLabel: 'Tabuleiro de Shape Regions, {width} por {height}',
  shapeRegionsCellAssigned: 'Linha {row}, coluna {col}, forma {region}',
  shapeRegionsCellEmpty: 'Linha {row}, coluna {col}, sem atribuição',
  shapeRegionsClueCount: '{count} de {size} células',
  shapeRegionsRuleBroken: 'quebra uma regra',
  shapeRegionsShape_line: 'Linha',
  shapeRegionsShape_block: 'Retângulo',
  shapeRegionsShape_corner: 'Canto',
  shapeRegionsShape_tee: 'Forma de T',
  shapeRegionsShape_step: 'Degrau',
  shapeRegionsHintWrong: 'A forma destacada não corresponde à solução.',
  shapeRegionsHintForced: 'A célula marcada só pode pertencer à forma destacada.',
  shapeRegionsHintSole: 'A forma destacada só tem um jeito de ficar.',
  shapeRegionsHintCommon:
    'Seja como for que a forma destacada fique, ela inclui as células marcadas.',
  shapeRegionsHintNone: 'Nenhuma jogada certa encontrada por enquanto.',
  shapeRegionsSolvedTitle: 'Resolvido!',
  shapeRegionsSolvedBody: 'Cada célula pertence à sua forma.',
  shapeRegionsHintsUsed: 'Dicas usadas',
  shapeRegionsNewBestTime: 'Seu melhor tempo.',
  shapeRegionsNewBoard: 'Novo tabuleiro',
  shapeRegionsSolvedCount: 'Quebra-cabeças resolvidos',
  shapeRegionsDailySection: 'Diário',
  shapeRegionsDailiesCleared: 'Dias concluídos',
  shapeRegionsStep1Title: 'Número e símbolo',
  shapeRegionsStep1Body: 'O número diz quantas células a forma tem; o símbolo, o seu formato.',
  shapeRegionsStep2Title: 'Cresça a partir da pista',
  shapeRegionsStep2Body:
    'Arraste a partir de uma pista pelas células vizinhas para fazer a forma crescer.',
  shapeRegionsStep3Title: 'Preencha o tabuleiro',
  shapeRegionsStep3Body:
    'Ao terminar, cada célula pertence a uma forma. Toque em uma célula para removê-la.',
};
