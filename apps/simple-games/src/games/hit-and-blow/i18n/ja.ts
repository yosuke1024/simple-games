/**
 * Japanese catalog. ヒット / ブロー are the established Japanese names for the
 * two counts (docs/HIT_AND_BLOW_RULES.md §4); the title (`hitAndBlowName`)
 * is a proper noun and stays as-is in every locale.
 */
import type { HitAndBlowMessages } from './en';

export const ja: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: '難易度を選ぶ',
  hitAndBlowDifficulty_easy: 'かんたん',
  hitAndBlowDifficulty_normal: 'ふつう',
  hitAndBlowDifficulty_hard: 'むずかしい',
  hitAndBlowCodeNote: '{pool} 種から {slots} つ',
  hitAndBlowBestNote: 'ベスト {count}',
  hitAndBlowConfirmSwitchTitle: '中断中のゲームを置き換えますか？',
  hitAndBlowConfirmSwitchBody:
    '中断中の「{current}」は、新しい「{next}」のゲームに置き換わります。',

  hitAndBlowSymbol_circle: '丸',
  hitAndBlowSymbol_triangle: '三角',
  hitAndBlowSymbol_square: '四角',
  hitAndBlowSymbol_diamond: 'ひし形',
  hitAndBlowSymbol_star: '星',
  hitAndBlowSymbol_cross: '十字',
  hitAndBlowSymbol_hexagon: '六角形',
  hitAndBlowSymbol_heart: 'ハート',

  hitAndBlowGuessCounter: '{n} 回目',
  hitAndBlowHistoryLabel: 'これまでの推測',
  hitAndBlowHistoryEmpty: '推測はここに並びます。',
  hitAndBlowRowLabel: '{n} 回目: {symbols}。ヒット {hits}、ブロー {blows}。',
  hitAndBlowDraftLabel: '推測する並び',
  hitAndBlowSlotEmpty: '{n} マス目: 空き',
  hitAndBlowSlotFilled: '{n} マス目: {symbol}',
  hitAndBlowPaletteLabel: '記号',
  hitAndBlowCheck: 'チェック',
  hitAndBlowHit: 'ヒット',
  hitAndBlowBlow: 'ブロー',

  hitAndBlowWinTitle: '正解',
  hitAndBlowWinBody: '隠れた並びを当てました。',
  hitAndBlowGuessesLabel: '推測回数',
  hitAndBlowNewBest: '自己ベストの回数',
  hitAndBlowSolved: '正解した回数',
  hitAndBlowFewestGuesses: '最少の推測回数',
  hitAndBlowAverageGuesses: '平均の推測回数',

  hitAndBlowStep1Title: '隠れた並びを当てる',
  hitAndBlowStep1Body: 'ちがう記号の並びが隠れています。どの記号が、どの順番かを当てます。',
  hitAndBlowStep2Title: '記号を並べて推測',
  hitAndBlowStep2Body: '記号をタップして並びを埋め、チェックを押します。',
  hitAndBlowStep3Title: 'ピンを読む',
  hitAndBlowStep3Body:
    '● ヒット: 記号も位置も合っている。○ ブロー: 記号は合っているが位置がちがう。何回でも推測できます。',
};
