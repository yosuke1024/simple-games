/**
 * Peg Solitaire — 日本語カタログ。
 *
 * 来歴(docs/PEG_SOLITAIRE_RULES.md §15): AI が下書きしたもので、作者はまだ
 * 読んでいない。人が確認済みとは扱わない。
 *
 * タイトル(`pegSolitaireName`)は固有名詞なので訳さない。盤の名前は、
 * 日本語の画面で「English」が言語の切り替えに見えないよう「イギリス式」と
 * 「三角」にした(盤の上には文字を置かないので、名前はボタン・見出し・
 * 読み上げにだけ出る)。
 */
import type { PegSolitaireMessages } from './en';

export const ja: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'イギリス式',
  pegSolitaireBoard_triangle: '三角',
  pegSolitaireBoardLabel_english: 'イギリス式の盤、33 穴',
  pegSolitaireBoardLabel_triangle: '三角の盤、15 穴',
  pegSolitaireHoleCount: '{count} 穴',

  pegSolitaireChooseBoard: '盤を選ぶ',
  pegSolitaireBestNote: '最少 {count} 個',
  pegSolitaireConfirmSwitchTitle: '進行中のゲームを置き換えますか?',
  pegSolitaireConfirmSwitchBody:
    '「{current}」のゲームは、新しい「{next}」のゲームに置き換わります。',

  pegSolitaireHoleGrid: '{row} 行 {col} 列: {content}',
  pegSolitaireHoleRow: '{row} 段目の {place} 番目: {content}',
  pegSolitaireContentPeg: 'コマ',
  pegSolitaireContentPegRing: 'コマ(輪の穴)',
  pegSolitaireContentEmpty: '空き',
  pegSolitaireContentEmptyRing: '空き(輪の穴)',
  pegSolitaireContentLanding: '空き、ここへ跳べる',
  pegSolitaireContentLandingRing: '空き(輪の穴)、ここへ跳べる',

  pegSolitairePegsLeft: '残り {count} 個',
  pegSolitaireNoJump: 'このコマはいま跳べません。',

  pegSolitairePerfectTitle: '完全クリア!',
  pegSolitairePerfectBody: '最後の 1 個が輪の穴に残りました。',
  pegSolitaireSingleTitle: '残り 1 個',
  pegSolitaireSingleBody: '最後の 1 個は輪の穴の外にあります。',
  pegSolitaireStuckTitle: '跳べるコマがありません',
  pegSolitaireStuckBody: 'どのコマも、もう跳べません。',
  pegSolitairePegsLeftLabel: '残り',
  pegSolitaireFewestLabel: 'この盤の最少',
  pegSolitaireNewFewest: 'この盤でいちばん少なく残せました。',
  pegSolitaireBoardFact: '盤',
  pegSolitaireNewBoard: '新しい盤面',

  pegSolitaireStatFewest: '最少残り数',
  pegSolitaireStatPerfect: '完全クリア',

  pegSolitaireStep1Title: '跳んで取り除く',
  pegSolitaireStep1Body: 'コマで隣のコマを跳び越えて空き穴へ — 跳び越えたコマは取り除かれる。',
  pegSolitaireStep2Title: '跳ぶのはまっすぐだけ',
  pegSolitaireStep2Body: 'イギリス式は縦と横、三角は 3 本の線に沿って跳ぶ。',
  pegSolitaireStep3Title: '最後の 1 個を残す',
  pegSolitaireStep3Body: '跳べるコマが無くなったら終わり — 最後の 1 個を輪の穴に残せば完全クリア。',
};
