/**
 * Brazilian Portuguese catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const ptBR: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Escolha um tabuleiro',
  boxRegionsDifficulty_easy: 'Fácil',
  boxRegionsDifficulty_medium: 'Médio',
  boxRegionsDifficulty_hard: 'Difícil',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  boxRegionsConfirmSwitchBody:
    'Sua partida {current} será substituída por um novo tabuleiro {next}.',
  boxRegionsBoardLabel: 'Tabuleiro de Box Regions, {width} por {height}',
  boxRegionsCellAssigned: 'Linha {row}, coluna {col}, caixa {region}',
  boxRegionsCellEmpty: 'Linha {row}, coluna {col}, sem caixa',
  boxRegionsClueCount: '{count} de {size} células',
  boxRegionsRuleBroken: 'quebra uma regra',
  boxRegionsKind_square: 'Quadrada',
  boxRegionsKind_tall: 'Alta',
  boxRegionsKind_wide: 'Larga',
  boxRegionsKind_free: 'Qualquer caixa',
  boxRegionsHintWrong: 'A caixa destacada não corresponde à resposta.',
  boxRegionsHintForced: 'A célula marcada só pode pertencer à caixa da pista destacada.',
  boxRegionsHintSole: 'Esta caixa só pode ser desenhada de um jeito.',
  boxRegionsHintCommon:
    'De qualquer jeito que a caixa desta pista seja desenhada, ela cobre as células marcadas.',
  boxRegionsHintNone: 'Nenhuma jogada certa encontrada agora.',
  boxRegionsSolvedTitle: 'Resolvido!',
  boxRegionsSolvedBody: 'Toda célula está na sua caixa.',
  boxRegionsHintsUsed: 'Dicas usadas',
  boxRegionsNewBestTime: 'Seu mais rápido até agora.',
  boxRegionsNewBoard: 'Novo tabuleiro',
  boxRegionsSolvedCount: 'Quebra-cabeças resolvidos',
  boxRegionsDailySection: 'Diário',
  boxRegionsDailiesCleared: 'Dias concluídos',
  boxRegionsStep1Title: 'Divida em caixas',
  boxRegionsStep1Body: 'Divida o tabuleiro em retângulos, cada um com exatamente uma pista.',
  boxRegionsStep2Title: 'Leia as pistas',
  boxRegionsStep2Body:
    'O número é quantas células a caixa tem; o símbolo indica se é quadrada, alta, larga ou qualquer.',
  boxRegionsStep3Title: 'Desenhe de canto a canto',
  boxRegionsStep3Body:
    'Arraste de um canto ao outro para desenhar uma caixa. Toque em uma caixa para removê-la. Travou? Tente uma dica.',
};
