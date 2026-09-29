/**
 * zh-hans catalog for Binary Balance: a machine translation of the English
 * source, not yet reviewed by a native speaker (docs/I18N_POLICY.md). The
 * title (`binaryBalanceName`) is a proper noun and stays as-is; wording follows
 * the Takuzu catalog where the meaning is the same.
 */
import type { BinaryBalanceMessages } from './en';

export const zhHans: BinaryBalanceMessages = {
  binaryBalanceName: 'Binary Balance',
  binaryBalanceChooseBoard: '选择盘面',
  binaryBalanceDifficulty_easy: '简单',
  binaryBalanceDifficulty_medium: '中等',
  binaryBalanceDifficulty_hard: '困难',
  binaryBalanceBoardNote: '{size}×{size}',
  binaryBalanceConfirmSwitchTitle: '替换进行中的盘面？',
  binaryBalanceConfirmSwitchBody: '进行中的“{current}”会被新的“{next}”盘面替换。',
  binaryBalanceBoardLabel: 'Binary Balance 盘面，{size}×{size}',
  binaryBalanceCellEmpty: '空，第 {row} 行第 {col} 列',
  binaryBalanceCellCircle: '圆形，第 {row} 行第 {col} 列',
  binaryBalanceCellSquare: '方形，第 {row} 行第 {col} 列',
  binaryBalanceCellFixedCircle: '题目圆形，第 {row} 行第 {col} 列',
  binaryBalanceCellFixedSquare: '题目方形，第 {row} 行第 {col} 列',
  binaryBalanceLinkSameRight: '与右边的格子相同',
  binaryBalanceLinkDiffRight: '与右边的格子不同',
  binaryBalanceLinkSameBelow: '与下面的格子相同',
  binaryBalanceLinkDiffBelow: '与下面的格子不同',
  binaryBalanceRuleBroken: '违反规则',
  binaryBalanceMarkCircle: '圆形',
  binaryBalanceMarkSquare: '方形',
  binaryBalanceHintViolation: '高亮的格子违反了规则。',
  binaryBalanceHintWrong: '带边框的标记不可能是对的。',
  binaryBalanceHintPairGap: '着色的一对会连成三个，所以带边框的格子是{mark}。',
  binaryBalanceHintLineCount: '高亮的行列里，着色的标记已经占满一半，所以带边框的格子是{mark}。',
  binaryBalanceHintLinkSame: '= 把带边框的格子和着色的格子连在一起，所以它也是{mark}。',
  binaryBalanceHintLinkDiff: '× 把带边框的格子和着色的格子连在一起，所以它是另一种标记：{mark}。',
  binaryBalanceHintLineCompletion: '补全高亮的行列，无论怎么填，带边框的格子都是{mark}。',
  binaryBalanceHintHypothesis:
    '如果带边框的格子是{other}，后面的步骤就会违反规则，所以它是{mark}。',
  binaryBalanceHintNone: '现在没有可确定的一步。',
  binaryBalanceSolvedTitle: '完成！',
  binaryBalanceSolvedBody: '每一行每一列都均衡，每个连线也都成立。',
  binaryBalanceHintsUsed: '使用的提示',
  binaryBalanceNewBestTime: '个人最快纪录。',
  binaryBalanceNewBoard: '新盘面',
  binaryBalanceDailySection: '每日挑战',
  binaryBalanceDailiesSolved: '通关天数',
  binaryBalanceDailyBacklogHint: '之前的日期随时可以挑战。',
  binaryBalanceStep1Title: '不能连着三个',
  binaryBalanceStep1Body: '点击格子在空、圆形、方形之间切换。同一种标记不能连续出现三次。',
  binaryBalanceStep2Title: '各占一半',
  binaryBalanceStep2Body: '每一行、每一列的圆形和方形数量相同。',
  binaryBalanceStep3Title: '沿着连线走',
  binaryBalanceStep3Body: '用 = 相连的格子相同，用 × 相连的格子不同。卡住了？可以要个提示。',
};
