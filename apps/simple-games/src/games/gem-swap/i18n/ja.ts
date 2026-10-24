/**
 * Japanese. Provenance (docs/GEM_SWAP_RULES.md §11): written by AI from the
 * English source on 2026-10-22, and NOT yet read by the author or by any
 * native reader — unlike the collection's own `ja`, this game's is an unread
 * AI draft (docs/I18N_POLICY.md). The title (`gemSwapName`) is a proper noun
 * and stays as-is in every locale. Terms follow the glossary in ./en.ts:
 * 入れ替え (swap), 並び (line), ラウンド (round), 宝石 (gem); 手詰まりの
 * 終わり方は「負け」と読める語を使わず、盤の事実として書く。
 */
import type { GemSwapMessages } from './en';

export const ja: GemSwapMessages = {
  gemSwapName: 'Gem Swap',

  gemSwapKinds: '宝石の種類',
  gemSwapKinds_5: '5 · かんたん',
  gemSwapKinds_6: '6 · ふつう',
  gemSwapKindsCount: '{count} 種類',
  gemSwapResumeNote: 'スコア {score} · {kinds}',
  gemSwapBestNote: 'ベスト {score}',
  gemSwapBestFor: 'ベスト({kinds})',

  gemSwapSwapsLeft: '残り {count} 回',
  gemSwapBoardLabel: '宝石の盤、{size} × {size}',
  gemSwapCell: '{row} 行 {col} 列、{gem}',
  gemSwapCellSelected: '{row} 行 {col} 列、{gem}、選択中',
  gemSwapGem_hexagon: '六角',
  gemSwapGem_octagon: '八角',
  gemSwapGem_pear: 'しずく',
  gemSwapGem_marquise: '舟形',
  gemSwapGem_shield: '盾',
  gemSwapGem_heart: 'ハート',
  gemSwapNewBoard: '新しい盤面',

  gemSwapLiveMove: '{count} 個消えました・残り {left} 回',
  gemSwapLiveInvalid: '入れ替えられません',
  gemSwapLiveUndo: '入れ替えを戻しました・残り {left} 回',

  gemSwapResultTitle: 'ラウンド終了',
  gemSwapEnd_swaps: '30 回の入れ替えを終えました。',
  gemSwapEnd_stuck: '3 つ並べられる入れ替えがなくなりました。',
  gemSwapEnd_cap: '連鎖が上限の 64 段に届きました。',
  gemSwapNotCounted: '上限で止まったラウンドはベストに数えません。',
  gemSwapNewBest: '{kinds}の自己ベスト',
  gemSwapBestWith: '{kinds}のベスト：{score}',

  gemSwapStep1Title: '入れ替える',
  gemSwapStep1Body: '隣り合う 2 つの宝石を入れ替えて、同じ形を 3 つ以上並べます。',
  gemSwapStep2Title: '消える',
  gemSwapStep2Body: 'そろうと消えて上から補充され、落ちてまたそろえば続けて消えます。',
  gemSwapStep3Title: '得点',
  gemSwapStep3Body: '成立した入れ替え 30 回で 1 ラウンド、消した数が得点になります。',
  gemSwapFigureSwap: '隣り合う 2 つの宝石を入れ替えると、六角が 3 つ並ぶところ',
  gemSwapFigureClear: '並びが消え、上の宝石がそこへ落ちてくるところ',
  gemSwapFigureRound: 'スコア 42 と、30 回のうち 18 回が残っているバー',
};
