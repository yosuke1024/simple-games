/**
 * Spanish catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `intercambiar` / `intercambio` for a swap, `línea` for a line of three, `ronda` for a
 * round, `gema` for a gem, `cascada` for the cascade, `récord` for a best (Snake), `Puntos` for
 * the score (shell `score`), informal `tú`. The stuck ending is a fact about the board, never
 * `derrota` or `fin de la partida`.
 */
import type { GemSwapMessages } from './en';

export const es: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Gemas',
  gemSwapKinds_5: '5 · Fácil',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} gemas',
  gemSwapResumeNote: 'Puntos {score} · {kinds}',
  gemSwapBestNote: 'Récord {score}',
  gemSwapBestFor: 'Récord, {kinds}',
  gemSwapSwapsLeft: 'Quedan {count} intercambios',
  gemSwapBoardLabel: 'Tablero de gemas, {size} × {size}',
  gemSwapCell: 'Fila {row}, columna {col}, {gem}',
  gemSwapCellSelected: 'Fila {row}, columna {col}, {gem}, seleccionada',
  gemSwapGem_hexagon: 'hexágono',
  gemSwapGem_octagon: 'octógono',
  gemSwapGem_pear: 'gota',
  gemSwapGem_marquise: 'marquesa',
  gemSwapGem_shield: 'escudo',
  gemSwapGem_heart: 'corazón',
  gemSwapNewBoard: 'Tablero nuevo',
  gemSwapLiveMove: '{count} eliminadas · quedan {left} intercambios',
  gemSwapLiveInvalid: 'Estas dos no se pueden intercambiar',
  gemSwapLiveUndo: 'Intercambio deshecho · quedan {left} intercambios',
  gemSwapResultTitle: 'Ronda terminada',
  gemSwapEnd_swaps: 'Se hicieron los 30 intercambios.',
  gemSwapEnd_stuck: 'No queda ningún intercambio que alinee tres.',
  gemSwapEnd_cap: 'La cascada llegó a su límite de 64 etapas.',
  gemSwapNotCounted: 'Una ronda detenida en el límite no cuenta para el récord.',
  gemSwapNewBest: 'Nuevo récord ({kinds})',
  gemSwapBestWith: 'Récord ({kinds}): {score}',
  gemSwapStep1Title: 'Intercambiar',
  gemSwapStep1Body: 'Intercambia dos gemas vecinas para alinear tres o más de la misma forma.',
  gemSwapStep2Title: 'Eliminar',
  gemSwapStep2Body:
    'Una línea se elimina, caen gemas nuevas desde arriba y cualquier línea que formen se elimina también.',
  gemSwapStep3Title: 'Puntos',
  gemSwapStep3Body: 'Una ronda son 30 intercambios, y cada gema eliminada vale un punto.',
  gemSwapFigureSwap:
    'Dos gemas vecinas a punto de intercambiarse para que se alineen tres hexágonos',
  gemSwapFigureClear: 'Una línea se ha eliminado y las gemas de arriba caen a su lugar',
  gemSwapFigureRound: '42 puntos y una barra con 18 de sus 30 intercambios restantes',
};
