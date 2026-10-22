/**
 * Brazilian Portuguese catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `trocar` / `troca` for a swap, `linha` for a line of three, `rodada` for a round,
 * `gema` for a gem, `cascata` for the cascade, `recorde` for a best (Snake), `Pontos` for the
 * score (shell `score`), `você`. The stuck ending is a fact about the board, never `derrota` or
 * `fim de jogo`.
 */
import type { GemSwapMessages } from './en';

export const ptBR: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Gemas',
  gemSwapKinds_5: '5 · Fácil',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} gemas',
  gemSwapResumeNote: 'Pontos {score} · {kinds}',
  gemSwapBestNote: 'Recorde {score}',
  gemSwapBestFor: 'Recorde, {kinds}',
  gemSwapSwapsLeft: 'Faltam {count} trocas',
  gemSwapBoardLabel: 'Tabuleiro de gemas, {size} × {size}',
  gemSwapCell: 'Linha {row}, coluna {col}, {gem}',
  gemSwapCellSelected: 'Linha {row}, coluna {col}, {gem}, selecionada',
  gemSwapGem_hexagon: 'hexágono',
  gemSwapGem_octagon: 'octógono',
  gemSwapGem_pear: 'gota',
  gemSwapGem_marquise: 'marquise',
  gemSwapGem_shield: 'escudo',
  gemSwapGem_heart: 'coração',
  gemSwapNewBoard: 'Novo tabuleiro',
  gemSwapLiveMove: '{count} removidas · faltam {left} trocas',
  gemSwapLiveInvalid: 'Estas duas não podem ser trocadas',
  gemSwapLiveUndo: 'Troca desfeita · faltam {left} trocas',
  gemSwapResultTitle: 'Rodada encerrada',
  gemSwapEnd_swaps: 'As 30 trocas foram feitas.',
  gemSwapEnd_stuck: 'Não resta nenhuma troca que alinhe três.',
  gemSwapEnd_cap: 'A cascata chegou ao limite de 64 etapas.',
  gemSwapNotCounted: 'Uma rodada interrompida no limite não conta para o recorde.',
  gemSwapNewBest: 'Novo recorde ({kinds})',
  gemSwapBestWith: 'Recorde ({kinds}): {score}',
  gemSwapStep1Title: 'Trocar',
  gemSwapStep1Body: 'Troque duas gemas vizinhas para alinhar três ou mais da mesma forma.',
  gemSwapStep2Title: 'Remover',
  gemSwapStep2Body:
    'Uma linha some, novas gemas caem de cima, e qualquer linha que elas formem some também.',
  gemSwapStep3Title: 'Pontos',
  gemSwapStep3Body: 'Uma rodada tem 30 trocas, e cada gema removida vale um ponto.',
  gemSwapFigureSwap: 'Duas gemas vizinhas prestes a serem trocadas para alinhar três hexágonos',
  gemSwapFigureClear: 'Uma linha sumiu e as gemas de cima caem no lugar dela',
  gemSwapFigureRound: '42 pontos e uma barra com 18 das 30 trocas restantes',
};
