/**
 * Traditional Chinese catalog for Make the Target — written by AI from the
 * English source on 2026-10-21 (provenance `machine`,
 * docs/MAKE_THE_TARGET_RULES.md §13). No native speaker has read it; it is not
 * to be treated as reviewed. The title (`makeTheTargetName`) is a proper noun
 * and stays as-is in every locale; placeholder names match the English source.
 *
 * Terms: problem = 題目, target = 目標 (not 球門 or 分數), solution = 解法, the
 * result of one move = 結果. Division is read "除以" — "8 除以 2" divides 8,
 * while "8 除 2" would divide 2 — left term first. Undo is the shell's 復原.
 * Shared words follow the shell and Bridges (簡單 / 中等 / 困難, 每日, 完成天數).
 */
import type { MakeTheTargetMessages } from './en';

export const zhHant: MakeTheTargetMessages = {
  makeTheTargetName: 'Make the Target',
  makeTheTargetChooseTier: '選擇難度',
  makeTheTargetDifficulty_easy: '簡單',
  makeTheTargetDifficulty_medium: '中等',
  makeTheTargetDifficulty_hard: '困難',
  makeTheTargetTierNote_easy: '4 個數字',
  makeTheTargetTierNote_medium: '4 或 5 個數字',
  makeTheTargetTierNote_hard: '5 個數字',
  makeTheTargetConfirmSwitchTitle: '取代進行中的題目？',
  makeTheTargetConfirmSwitchBody: '你正在進行的{current}題目將被新的{next}題目取代。',
  makeTheTargetNumbersLabel: '數字',
  makeTheTargetTargetSpoken: '目標 {target}',
  makeTheTargetTargetLabel: '目標',
  makeTheTargetOperatorsLabel: '運算符號',
  makeTheTargetOp_add: '加',
  makeTheTargetOp_subtract: '減',
  makeTheTargetOp_multiply: '乘',
  makeTheTargetOp_divide: '除',
  makeTheTargetSpokenLine_add: '{left} 加 {right} 等於 {result}',
  makeTheTargetSpokenLine_subtract: '{left} 減 {right} 等於 {result}',
  makeTheTargetSpokenLine_multiply: '{left} 乘 {right} 等於 {result}',
  makeTheTargetSpokenLine_divide: '{left} 除以 {right} 等於 {result}',
  makeTheTargetSpokenUndo: '已復原：{line}',
  makeTheTargetStepsLabel: '已做的步驟',
  makeTheTargetMissed: '結果是 {value}，不是 {target}。',
  makeTheTargetSpokenMissed: '{line}。結果是 {value}，不是 {target}。',
  makeTheTargetShowSolution: '查看一種解法',
  makeTheTargetRevealTitle: '查看一種解法？',
  makeTheTargetRevealBody: '這道題到此結束，不算作已解出。',
  makeTheTargetRevealConfirm: '查看',
  makeTheTargetSolvedTitle: '已得到目標數。',
  makeTheTargetRevealedTitle: '得到 {target} 的一種方法',
  makeTheTargetSolutionLabel: '一種解法',
  makeTheTargetNewBoard: '新題目',
  makeTheTargetNewBestTime: '你的最快紀錄。',
  makeTheTargetSolvedCount: '已解題目',
  makeTheTargetDailySection: '每日',
  makeTheTargetDailiesCleared: '完成天數',
  makeTheTargetAllModes: '所有模式',
  makeTheTargetStep1Title: '合併兩個數',
  makeTheTargetStep1Body: '點一個數字，再點 + − × 或 ÷，然後點另一個數字——先點的數字在左邊。',
  makeTheTargetStep2Title: '新的數字',
  makeTheTargetStep2Body: '這兩個數用掉後，結果（一定是大於零的整數）會取代它們的位置。',
  makeTheTargetStep3Title: '湊出目標',
  makeTheTargetStep3Body: '用上所有數字。最後一個數等於目標時，這道題就解出了。',
};
