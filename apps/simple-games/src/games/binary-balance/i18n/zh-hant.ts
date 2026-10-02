/**
 * zh-hant catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same. The two marks are a sun
 * and a moon (the ordinary words for the celestial bodies).
 */
import type { BinaryBalanceMessages } from './en';

export const zhHant: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: '選擇盤面',
  binaryBalanceDifficulty_easy: '簡單',
  binaryBalanceDifficulty_medium: '中等',
  binaryBalanceDifficulty_hard: '困難',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: '要換掉進行中的盤面嗎？',
  binaryBalanceConfirmSwitchBody: '進行中的「{current}」會被新的「{next}」盤面取代。',
  binaryBalanceBoardLabel: 'Binary Balance 盤面，{size}×{size}',
  binaryBalanceCellEmpty: '空白，第 {row} 列第 {col} 欄',
  binaryBalanceCellSun: '太陽，第 {row} 列第 {col} 欄',
  binaryBalanceCellMoon: '月亮，第 {row} 列第 {col} 欄',
  binaryBalanceCellFixedSun: '題目太陽，第 {row} 列第 {col} 欄',
  binaryBalanceCellFixedMoon: '題目月亮，第 {row} 列第 {col} 欄',
  binaryBalanceLinkSameRight: '與右邊的方格相同',
  binaryBalanceLinkDiffRight: '與右邊的方格不同',
  binaryBalanceLinkSameBelow: '與下面的方格相同',
  binaryBalanceLinkDiffBelow: '與下面的方格不同',
  binaryBalanceRuleBroken: '違反規則',
  binaryBalanceMarkSun: '太陽',
  binaryBalanceMarkMoon: '月亮',
  binaryBalanceHintViolation: '標示的方格違反了規則。',
  binaryBalanceHintWrong: '有外框的標記不可能是對的。',
  binaryBalanceHintPairGap: '上色的一對會連成三個，所以有外框的方格是{mark}。',
  binaryBalanceHintLineCount:
    '標示的整列或整欄裡，上色的標記已經佔滿一半，所以有外框的方格是{mark}。',
  binaryBalanceHintLinkSame: '= 把有外框的方格和上色的方格連在一起，所以它也是{mark}。',
  binaryBalanceHintLinkDiff: '× 把有外框的方格和上色的方格連在一起，所以它是另一種標記：{mark}。',
  binaryBalanceHintLineCompletion: '補齊標示的整列或整欄，無論怎麼填，有外框的方格都是{mark}。',
  binaryBalanceHintHypothesis:
    '如果有外框的方格是{other}，後面的步驟就會違反規則，所以它是{mark}。',
  binaryBalanceHintNone: '目前還推不出下一步。',
  binaryBalanceSolvedTitle: '完成！',
  binaryBalanceSolvedBody: '每一列每一欄都均衡，每個連線也都成立。',
  binaryBalanceHintsUsed: '使用的提示',
  binaryBalanceNewBestTime: '個人最快紀錄。',
  binaryBalanceNewBoard: '新盤面',
  binaryBalanceDailySection: '每日挑戰',
  binaryBalanceDailiesSolved: '過關天數',
  binaryBalanceStep1Title: '不得連續三格',
  binaryBalanceStep1Body: '輕點方格即可在空白、太陽、月亮之間切換。同一種標記不得連續三格。',
  binaryBalanceStep2Title: '各佔一半',
  binaryBalanceStep2Body: '每一列、每一欄的太陽與月亮個數相同。',
  binaryBalanceStep3Title: '沿著連線走',
  binaryBalanceStep3Body: '用 = 相連的方格相同，用 × 相連的方格不同。卡住了？可以要個提示。',
};
