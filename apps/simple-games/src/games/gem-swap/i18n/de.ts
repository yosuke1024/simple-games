/**
 * German catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `tauschen` / `Tausch` for a swap, `Reihe` for a line of three, `Runde` for a round,
 * `Edelstein` for a gem, `Kettenreaktion` for the cascade, `Rekord` for a best (Snake, Number
 * Match), `Punkte` for the score (shell `score`), the informal `du`. The stuck ending is said
 * as a fact about the board, never as `verloren` or `Spiel vorbei`.
 */
import type { GemSwapMessages } from './en';

export const de: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Edelsteine',
  gemSwapKinds_5: '5 · Leicht',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} Sorten',
  gemSwapResumeNote: 'Punkte {score} · {kinds}',
  gemSwapBestNote: 'Rekord {score}',
  gemSwapBestFor: 'Rekord, {kinds}',
  gemSwapSwapsLeft: 'Noch {count} Tausche',
  gemSwapBoardLabel: 'Edelsteinfeld, {size} × {size}',
  gemSwapCell: 'Zeile {row}, Spalte {col}, {gem}',
  gemSwapCellSelected: 'Zeile {row}, Spalte {col}, {gem}, ausgewählt',
  gemSwapGem_hexagon: 'Sechseck',
  gemSwapGem_octagon: 'Achteck',
  gemSwapGem_pear: 'Tropfen',
  gemSwapGem_marquise: 'Navette',
  gemSwapGem_shield: 'Schild',
  gemSwapGem_heart: 'Herz',
  gemSwapNewBoard: 'Neues Feld',
  gemSwapLiveMove: '{count} entfernt · noch {left} Tausche',
  gemSwapLiveInvalid: 'Diese beiden lassen sich nicht tauschen',
  gemSwapLiveUndo: 'Tausch zurückgenommen · noch {left} Tausche',
  gemSwapResultTitle: 'Runde beendet',
  gemSwapEnd_swaps: 'Alle 30 Tausche sind gemacht.',
  gemSwapEnd_stuck: 'Kein Tausch bringt mehr drei in eine Reihe.',
  gemSwapEnd_cap: 'Die Kettenreaktion hat ihre Grenze von 64 Stufen erreicht.',
  gemSwapNotCounted: 'Eine an der Grenze gestoppte Runde zählt nicht für den Rekord.',
  gemSwapNewBest: 'Neuer Rekord ({kinds})',
  gemSwapBestWith: 'Rekord ({kinds}): {score}',
  gemSwapStep1Title: 'Tauschen',
  gemSwapStep1Body:
    'Tausche zwei benachbarte Edelsteine, damit drei oder mehr gleiche Formen in einer Reihe liegen.',
  gemSwapStep2Title: 'Entfernen',
  gemSwapStep2Body:
    'Eine Reihe verschwindet, neue Edelsteine fallen von oben nach, und jede neue Reihe verschwindet ebenfalls.',
  gemSwapStep3Title: 'Punkte',
  gemSwapStep3Body: 'Eine Runde hat 30 Tausche, und jeder entfernte Edelstein bringt einen Punkt.',
  gemSwapFigureSwap:
    'Zwei benachbarte Edelsteine kurz vor dem Tausch, nach dem drei Sechsecke in einer Reihe liegen',
  gemSwapFigureClear:
    'Eine Reihe ist verschwunden, und die Edelsteine darüber fallen an ihren Platz',
  gemSwapFigureRound: '42 Punkte und ein Balken, auf dem noch 18 von 30 Tauschen übrig sind',
};
