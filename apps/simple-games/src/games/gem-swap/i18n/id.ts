/**
 * Indonesian catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `tukar` / `tukaran` for a swap, `deret` for a line of three, `ronde` for a round,
 * `permata` for a gem, `beruntun` for the cascade, `rekor` / `terbaik` for a best (Snake),
 * `Skor` for the score (shell `score`). The stuck ending is a fact about the board, never
 * `kalah` or `permainan selesai`.
 */
import type { GemSwapMessages } from './en';

export const id: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Permata',
  gemSwapKinds_5: '5 · Mudah',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} jenis',
  gemSwapResumeNote: 'Skor {score} · {kinds}',
  gemSwapBestNote: 'Terbaik {score}',
  gemSwapBestFor: 'Terbaik, {kinds}',
  gemSwapSwapsLeft: 'Sisa {count} tukaran',
  gemSwapBoardLabel: 'Papan permata, {size} × {size}',
  gemSwapCell: 'Baris {row}, kolom {col}, {gem}',
  gemSwapCellSelected: 'Baris {row}, kolom {col}, {gem}, dipilih',
  gemSwapGem_hexagon: 'segi enam',
  gemSwapGem_octagon: 'segi delapan',
  gemSwapGem_pear: 'tetes',
  gemSwapGem_marquise: 'perahu',
  gemSwapGem_shield: 'perisai',
  gemSwapGem_heart: 'hati',
  gemSwapNewBoard: 'Papan baru',
  gemSwapLiveMove: '{count} hilang · sisa {left} tukaran',
  gemSwapLiveInvalid: 'Keduanya tidak bisa ditukar',
  gemSwapLiveUndo: 'Tukaran dibatalkan · sisa {left} tukaran',
  gemSwapResultTitle: 'Ronde selesai',
  gemSwapEnd_swaps: 'Ke-30 tukaran sudah dibuat.',
  gemSwapEnd_stuck: 'Tidak ada lagi tukaran yang membuat tiga sederet.',
  gemSwapEnd_cap: 'Hilang beruntun mencapai batas 64 tahap.',
  gemSwapNotCounted: 'Ronde yang berhenti di batas tidak dihitung untuk rekor.',
  gemSwapNewBest: 'Rekor baru ({kinds})',
  gemSwapBestWith: 'Terbaik ({kinds}): {score}',
  gemSwapStep1Title: 'Tukar',
  gemSwapStep1Body:
    'Tukar dua permata yang bersebelahan agar tiga atau lebih bentuk yang sama sederet.',
  gemSwapStep2Title: 'Hilang',
  gemSwapStep2Body:
    'Deret menghilang, permata baru jatuh dari atas, dan deret yang mereka bentuk juga menghilang.',
  gemSwapStep3Title: 'Skor',
  gemSwapStep3Body:
    'Satu ronde berisi 30 tukaran, dan setiap permata yang hilang bernilai satu poin.',
  gemSwapFigureSwap: 'Dua permata bersebelahan yang akan ditukar sehingga tiga segi enam sederet',
  gemSwapFigureClear: 'Satu deret telah hilang dan permata di atasnya jatuh ke tempatnya',
  gemSwapFigureRound: 'Skor 42 dan bilah dengan sisa 18 dari 30 tukaran',
};
