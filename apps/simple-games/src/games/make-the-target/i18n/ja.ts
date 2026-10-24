/**
 * Japanese catalog for Make the Target. Provenance (docs/MAKE_THE_TARGET_RULES.md
 * §13): written by AI from the English source on 2026-10-21 and **not read by
 * the author** — not to be treated as reviewed. The rest of the collection's
 * Japanese is the author's own; this game's is not, until the author has read
 * it. The title (`makeTheTargetName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source.
 *
 * Terms: problem = 問題, target = 目標 (never ゴール or スコア), solution = 解,
 * the result of one move = 答え. Operators are read たす / ひく / かける / わる,
 * left term first ("8 わる 2 は 4" divides 8). Shared words (戻す, デイリー, the
 * difficulty names, the statistics headings) follow the shell and Bridges.
 */
import type { MakeTheTargetMessages } from './en';

export const ja: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: '難易度を選ぶ',
  makeTheTargetDifficulty_easy: 'かんたん',
  makeTheTargetDifficulty_medium: 'ふつう',
  makeTheTargetDifficulty_hard: 'むずかしい',
  makeTheTargetTierNote_easy: '数字 4 つ',
  makeTheTargetTierNote_medium: '数字 4 つか 5 つ',
  makeTheTargetTierNote_hard: '数字 5 つ',
  makeTheTargetConfirmSwitchTitle: '問題を置き換えますか？',
  makeTheTargetConfirmSwitchBody:
    '進行中の「{current}」の問題は、新しい「{next}」の問題に置き換わります。',
  makeTheTargetNumbersLabel: '数字',
  makeTheTargetTargetSpoken: '目標 {target}',
  makeTheTargetTargetLabel: '目標',
  makeTheTargetOperatorsLabel: '計算の記号',
  makeTheTargetOp_add: 'たす',
  makeTheTargetOp_subtract: 'ひく',
  makeTheTargetOp_multiply: 'かける',
  makeTheTargetOp_divide: 'わる',
  makeTheTargetSpokenLine_add: '{left} たす {right} は {result}',
  makeTheTargetSpokenLine_subtract: '{left} ひく {right} は {result}',
  makeTheTargetSpokenLine_multiply: '{left} かける {right} は {result}',
  makeTheTargetSpokenLine_divide: '{left} わる {right} は {result}',
  makeTheTargetSpokenUndo: '戻した手: {line}',
  makeTheTargetStepsLabel: 'これまでの手',
  makeTheTargetMissed: '{target} ではなく {value} になりました。',
  makeTheTargetSpokenMissed: '{line}。{target} ではなく {value} になりました。',
  makeTheTargetShowSolution: '解を 1 つ見る',
  makeTheTargetRevealTitle: '解を 1 つ見ますか？',
  makeTheTargetRevealBody: 'この問題はここで終わり、クリアには数えません。',
  makeTheTargetRevealConfirm: '見る',
  makeTheTargetSolvedTitle: '目標の数を作りました。',
  makeTheTargetRevealedTitle: '{target} の作り方の 1 つ',
  makeTheTargetSolutionLabel: '解の 1 つ',
  makeTheTargetNewBoard: '新しい問題',
  makeTheTargetNewBestTime: '自己ベスト更新。',
  makeTheTargetSolvedCount: 'クリア数',
  makeTheTargetDailySection: 'デイリー',
  makeTheTargetDailiesCleared: '達成日数',
  makeTheTargetAllModes: 'すべてのモード',
  makeTheTargetStep1Title: '2 つをまとめる',
  makeTheTargetStep1Body:
    '数字、+ − × ÷ のどれか、別の数字の順にタップします(先にタップした数字が左)。',
  makeTheTargetStep2Title: '答えが新しい数字に',
  makeTheTargetStep2Body:
    '使った 2 つは消え、その答え(いつも 1 以上の整数)が新しい数字になります。',
  makeTheTargetStep3Title: '目標に合わせる',
  makeTheTargetStep3Body: '数字を全部使い、最後の 1 つが目標と同じになればクリアです。',
};
