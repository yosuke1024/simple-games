/**
 * Japanese catalog for Binary Balance. The title (`binaryBalanceName`) is a
 * proper noun and stays as-is in every locale.
 */
import type { BinaryBalanceMessages } from './en';

export const ja: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: '盤面を選ぶ',
  binaryBalanceDifficulty_easy: 'かんたん',
  binaryBalanceDifficulty_medium: 'ふつう',
  binaryBalanceDifficulty_hard: 'むずかしい',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: '中断中の盤面を置き換えますか？',
  binaryBalanceConfirmSwitchBody:
    '中断中の「{current}」は、新しい「{next}」の盤面に置き換わります。',
  binaryBalanceBoardLabel: 'Binary Balance の盤面、{size}×{size}',
  binaryBalanceCellEmpty: '空、{row}行 {col}列',
  binaryBalanceCellSun: '太陽、{row}行 {col}列',
  binaryBalanceCellMoon: '月、{row}行 {col}列',
  binaryBalanceCellFixedSun: '固定の太陽、{row}行 {col}列',
  binaryBalanceCellFixedMoon: '固定の月、{row}行 {col}列',
  binaryBalanceLinkSameRight: '右のマスと同じ',
  binaryBalanceLinkDiffRight: '右のマスと違う',
  binaryBalanceLinkSameBelow: '下のマスと同じ',
  binaryBalanceLinkDiffBelow: '下のマスと違う',
  binaryBalanceRuleBroken: 'ルール違反',
  binaryBalanceMarkSun: '太陽',
  binaryBalanceMarkMoon: '月',
  binaryBalanceHintViolation: '強調されたマスがルールを破っています。',
  binaryBalanceHintWrong: '枠のついた記号は正解になりえません。',
  binaryBalanceHintPairGap:
    '色のついた 2 マスと同じ記号を置くと 3 つ続いてしまいます。枠のついたマスは{mark}です。',
  binaryBalanceHintLineCount:
    '強調された行・列には、色のついた記号がもう半分そろっています。枠のついたマスは{mark}です。',
  binaryBalanceHintLinkSame:
    '枠のついたマスは色のついたマスと = で結ばれているので、同じ{mark}です。',
  binaryBalanceHintLinkDiff:
    '枠のついたマスは色のついたマスと × で結ばれているので、違う記号の{mark}です。',
  binaryBalanceHintLineCompletion:
    '強調された行・列をどう埋めても、枠のついたマスは{mark}になります。',
  binaryBalanceHintHypothesis:
    '枠のついたマスを{other}にすると、その先でルールが破れます。だから{mark}です。',
  binaryBalanceHintNone: '今わかる手が見つかりません。',
  binaryBalanceSolvedTitle: '完成！',
  binaryBalanceSolvedBody: 'すべての行と列がそろい、すべてのリンクが守られました。',
  binaryBalanceHintsUsed: '使ったヒント',
  binaryBalanceNewBestTime: '自己最速です。',
  binaryBalanceNewBoard: '新しい盤面',
  binaryBalanceDailySection: 'デイリー',
  binaryBalanceDailiesSolved: '達成日数',
  binaryBalanceStep1Title: '3 つ続けない',
  binaryBalanceStep1Body:
    'タップで 空、太陽、月 と切り替わります。同じ記号は縦にも横にも 3 つ続けられません。',
  binaryBalanceStep2Title: '半分ずつ',
  binaryBalanceStep2Body: 'どの行・どの列も、太陽と月が同じ数になります。',
  binaryBalanceStep3Title: 'リンクに従う',
  binaryBalanceStep3Body:
    '= で結ばれた 2 マスは同じ記号、× で結ばれた 2 マスは違う記号です。詰まったらヒントを。',
};
