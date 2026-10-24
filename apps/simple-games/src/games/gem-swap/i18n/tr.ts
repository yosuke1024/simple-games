/**
 * Turkish catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `yer değiştirmek` / `değişim` for a swap, `sıra` for a line of three, `tur` for a
 * round, `mücevher` for a gem, `zincirleme` for the cascade, `rekor` for a best (Snake), `Puan`
 * for the score (shell `score`). The stuck ending is a fact about the board, never `kaybettin`
 * or `oyun bitti`.
 */
import type { GemSwapMessages } from './en';

export const tr: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'Mücevher',
  gemSwapKinds_5: '5 · Kolay',
  gemSwapKinds_6: '6 · Normal',
  gemSwapKindsCount: '{count} çeşit',
  gemSwapResumeNote: 'Puan {score} · {kinds}',
  gemSwapBestNote: 'Rekor {score}',
  gemSwapBestFor: 'Rekor, {kinds}',
  gemSwapSwapsLeft: '{count} değişim kaldı',
  gemSwapBoardLabel: 'Mücevher tahtası, {size} × {size}',
  gemSwapCell: 'Satır {row}, sütun {col}, {gem}',
  gemSwapCellSelected: 'Satır {row}, sütun {col}, {gem}, seçili',
  gemSwapGem_hexagon: 'altıgen',
  gemSwapGem_octagon: 'sekizgen',
  gemSwapGem_pear: 'damla',
  gemSwapGem_marquise: 'markiz',
  gemSwapGem_shield: 'kalkan',
  gemSwapGem_heart: 'kalp',
  gemSwapNewBoard: 'Yeni tahta',
  gemSwapLiveMove: '{count} silindi · {left} değişim kaldı',
  gemSwapLiveInvalid: 'Bu ikisinin yeri değiştirilemez',
  gemSwapLiveUndo: 'Değişim geri alındı · {left} değişim kaldı',
  gemSwapResultTitle: 'Tur bitti',
  gemSwapEnd_swaps: '30 değişimin hepsi yapıldı.',
  gemSwapEnd_stuck: 'Üçü sıraya dizen bir değişim kalmadı.',
  gemSwapEnd_cap: 'Zincirleme silinme 64 aşamalık sınırına ulaştı.',
  gemSwapNotCounted: 'Sınırda duran bir tur rekora sayılmaz.',
  gemSwapNewBest: 'Yeni rekor ({kinds})',
  gemSwapBestWith: 'Rekor ({kinds}): {score}',
  gemSwapStep1Title: 'Değiştir',
  gemSwapStep1Body:
    'Aynı şekilden üç ya da daha fazlasını sıraya dizmek için yan yana iki mücevherin yerini değiştir.',
  gemSwapStep2Title: 'Silinme',
  gemSwapStep2Body:
    'Sıra silinir, yukarıdan yeni mücevherler düşer ve onların oluşturduğu her sıra da silinir.',
  gemSwapStep3Title: 'Puan',
  gemSwapStep3Body: 'Bir tur 30 değişimdir ve silinen her mücevher bir puandır.',
  gemSwapFigureSwap: 'Yeri değişince üç altıgeni sıraya dizecek yan yana iki mücevher',
  gemSwapFigureClear: 'Bir sıra silindi ve üstteki mücevherler onun yerine düşüyor',
  gemSwapFigureRound: '42 puan ve 30 değişimden 18’i kalan bir çubuk',
};
