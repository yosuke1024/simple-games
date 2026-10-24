/**
 * Simplified Chinese catalog for Make the Target — written by AI from the
 * English source on 2026-10-21 (provenance `machine`,
 * docs/MAKE_THE_TARGET_RULES.md §13). No native speaker has read it; it is not
 * to be treated as reviewed. The title (`makeTheTargetName`) is a proper noun
 * and stays as-is in every locale; placeholder names match the English source.
 *
 * Terms: problem = 题目, target = 目标 (not 球门 or 分数), solution = 解法, the
 * result of one move = 结果. Division is read "除以" — "8 除以 2" divides 8,
 * while "8 除 2" would divide 2 — left term first. Shared words follow the
 * shell and Bridges (简单 / 中等 / 困难, 每日, 完成天数).
 */
import type { MakeTheTargetMessages } from './en';

export const zhHans: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: '选择难度',
  makeTheTargetDifficulty_easy: '简单',
  makeTheTargetDifficulty_medium: '中等',
  makeTheTargetDifficulty_hard: '困难',
  makeTheTargetTierNote_easy: '4 个数字',
  makeTheTargetTierNote_medium: '4 或 5 个数字',
  makeTheTargetTierNote_hard: '5 个数字',
  makeTheTargetConfirmSwitchTitle: '替换进行中的题目？',
  makeTheTargetConfirmSwitchBody: '你正在进行的{current}题目将被新的{next}题目替换。',
  makeTheTargetNumbersLabel: '数字',
  makeTheTargetTargetSpoken: '目标 {target}',
  makeTheTargetTargetLabel: '目标',
  makeTheTargetOperatorsLabel: '运算符号',
  makeTheTargetOp_add: '加',
  makeTheTargetOp_subtract: '减',
  makeTheTargetOp_multiply: '乘',
  makeTheTargetOp_divide: '除',
  makeTheTargetSpokenLine_add: '{left} 加 {right} 等于 {result}',
  makeTheTargetSpokenLine_subtract: '{left} 减 {right} 等于 {result}',
  makeTheTargetSpokenLine_multiply: '{left} 乘 {right} 等于 {result}',
  makeTheTargetSpokenLine_divide: '{left} 除以 {right} 等于 {result}',
  makeTheTargetSpokenUndo: '已撤销：{line}',
  makeTheTargetStepsLabel: '已做的步骤',
  makeTheTargetMissed: '结果是 {value}，不是 {target}。',
  makeTheTargetSpokenMissed: '{line}。结果是 {value}，不是 {target}。',
  makeTheTargetShowSolution: '查看一种解法',
  makeTheTargetRevealTitle: '查看一种解法？',
  makeTheTargetRevealBody: '这道题到此结束，不计为已解出。',
  makeTheTargetRevealConfirm: '查看',
  makeTheTargetSolvedTitle: '已得到目标数。',
  makeTheTargetRevealedTitle: '得到 {target} 的一种方法',
  makeTheTargetSolutionLabel: '一种解法',
  makeTheTargetNewBoard: '新题目',
  makeTheTargetNewBestTime: '你的最快纪录。',
  makeTheTargetSolvedCount: '已解题目',
  makeTheTargetDailySection: '每日',
  makeTheTargetDailiesCleared: '完成天数',
  makeTheTargetAllModes: '所有模式',
  makeTheTargetStep1Title: '合并两个数',
  makeTheTargetStep1Body: '点一个数字，再点 + − × 或 ÷，然后点另一个数字——先点的数字在左边。',
  makeTheTargetStep2Title: '新的数字',
  makeTheTargetStep2Body: '这两个数用掉后，结果（总是大于零的整数）会取代它们的位置。',
  makeTheTargetStep3Title: '凑出目标',
  makeTheTargetStep3Body: '用上所有数字。最后一个数等于目标时，这道题就解出了。',
};
