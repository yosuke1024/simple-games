/**
 * French catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `échanger` / `échange` for a swap, `ligne` for a line of three, `manche` for a round,
 * `gemme` for a gem, `cascade` for the cascade, `record` for a best (Snake), `Score` for the
 * score (shell `score`), informal `tu`. The stuck ending is a fact about the board, never
 * `perdu` or `partie terminée`.
 */
import type { GemSwapMessages } from './en';

export const fr: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Gemmes',
  gemSwapKinds_5: '5 · Facile',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} gemmes',
  gemSwapResumeNote: 'Score {score} · {kinds}',
  gemSwapBestNote: 'Record {score}',
  gemSwapBestFor: 'Record, {kinds}',
  gemSwapSwapsLeft: 'Encore {count} échanges',
  gemSwapBoardLabel: 'Plateau de gemmes, {size} × {size}',
  gemSwapCell: 'Ligne {row}, colonne {col}, {gem}',
  gemSwapCellSelected: 'Ligne {row}, colonne {col}, {gem}, sélectionnée',
  gemSwapGem_hexagon: 'hexagone',
  gemSwapGem_octagon: 'octogone',
  gemSwapGem_pear: 'goutte',
  gemSwapGem_marquise: 'navette',
  gemSwapGem_shield: 'écusson',
  gemSwapGem_heart: 'cœur',
  gemSwapNewBoard: 'Nouveau plateau',
  gemSwapLiveMove: '{count} retirées · encore {left} échanges',
  gemSwapLiveInvalid: 'Ces deux-là ne peuvent pas être échangées',
  gemSwapLiveUndo: 'Échange annulé · encore {left} échanges',
  gemSwapResultTitle: 'Manche terminée',
  gemSwapEnd_swaps: 'Les 30 échanges sont faits.',
  gemSwapEnd_stuck: 'Plus aucun échange n’aligne trois gemmes.',
  gemSwapEnd_cap: 'La cascade a atteint sa limite de 64 étapes.',
  gemSwapNotCounted: 'Une manche arrêtée à la limite ne compte pas pour le record.',
  gemSwapNewBest: 'Nouveau record ({kinds})',
  gemSwapBestWith: 'Record ({kinds}) : {score}',
  gemSwapStep1Title: 'Échanger',
  gemSwapStep1Body: 'Échange deux gemmes voisines pour aligner trois formes identiques ou plus.',
  gemSwapStep2Title: 'Retirer',
  gemSwapStep2Body:
    'Une ligne disparaît, de nouvelles gemmes tombent d’en haut, et toute ligne qu’elles forment disparaît aussi.',
  gemSwapStep3Title: 'Score',
  gemSwapStep3Body: 'Une manche compte 30 échanges, et chaque gemme retirée vaut un point.',
  gemSwapFigureSwap:
    'Deux gemmes voisines sur le point d’être échangées pour aligner trois hexagones',
  gemSwapFigureClear: 'Une ligne a disparu et les gemmes du dessus tombent à sa place',
  gemSwapFigureRound: 'Un score de 42 et une barre où il reste 18 des 30 échanges',
};
