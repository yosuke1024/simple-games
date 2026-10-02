/**
 * Sudoku 6×6 の日本語。タイトル(`sudoku6x6Name`)は固有名詞としてそのまま。
 * Hint は技法名を出さず、平易な一文にする(docs/SUDOKU_6X6_RULES.md §5)。
 */
import type { Sudoku6x6Messages } from './en';

export const ja: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: '盤面を選ぶ',
  sudoku6x6Difficulty_easy: 'やさしい',
  sudoku6x6Difficulty_medium: 'ふつう',
  sudoku6x6Difficulty_hard: 'むずかしい',
  sudoku6x6ConfirmSwitchTitle: '途中の盤面を置き換えますか?',
  sudoku6x6ConfirmSwitchBody: '途中の「{current}」は、新しい「{next}」の盤面に置き換わります。',
  sudoku6x6GridLabel: 'Sudoku 6×6 の盤面',
  sudoku6x6PadLabel: '数字パッド',
  sudoku6x6PadKey: '{value}、残り {n}',
  sudoku6x6PadNoteKey: 'メモ {value}',
  sudoku6x6CellEmpty: '空、{row} 行 {col} 列',
  sudoku6x6CellGiven: '{value}、初期数字、{row} 行 {col} 列',
  sudoku6x6CellEntry: '{value}、{row} 行 {col} 列',
  sudoku6x6Erase: '消す',
  sudoku6x6Notes: 'メモ',
  sudoku6x6HintOnlyDigit: 'このマスに入る数字は 1 つだけです。',
  sudoku6x6HintOnlyCell: 'ここで {value} が入るのはこのマスだけです。',
  sudoku6x6HintLockedLine: 'このボックスでは、{value} は強調した行または列にしか入りません。',
  sudoku6x6HintLockedBox: 'この行または列では、{value} は強調したボックスの中にしか入りません。',
  sudoku6x6HintRuledOut: 'これらのマスがあるので、同じ並びのほかのマスの候補を減らせます。',
  sudoku6x6HintNone: '今わかる手が見つかりません。',
  sudoku6x6SolvedTitle: 'クリア!',
  sudoku6x6SolvedBody: 'どの行・列・ボックスにも 1〜6 がそろいました。',
  sudoku6x6Mistakes: 'ミス',
  sudoku6x6HintsUsed: 'ヒント',
  sudoku6x6NewBestTime: '自己ベスト更新。',
  sudoku6x6NewBoard: '新しい盤面',
  sudoku6x6DailySection: 'デイリー',
  sudoku6x6DailiesSolved: 'クリアした日',
  sudoku6x6HighlightMistakes: 'ミスを表示',
  sudoku6x6HighlightMistakesNote:
    '間違った数字を入れたとき、すぐに印をつけます。重複した数字はいつでも表示されます。',
  sudoku6x6Step1Title: '1〜6 を 1 つずつ',
  sudoku6x6Step1Body: '各行・各列・各 2×3 ボックスに、1〜6 を 1 つずつ入れます。',
  sudoku6x6Step2Title: '入れる・メモする',
  sudoku6x6Step2Body: 'マスを選んで数字を入れます。メモをオンにすると候補を書けます。',
  sudoku6x6Step3Title: '詰まったらヒント',
  sudoku6x6Step3Body: 'ヒントは、次に確定するマスとその理由を示します。',
};
