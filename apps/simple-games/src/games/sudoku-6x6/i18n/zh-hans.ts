/**
 * Simplified Chinese catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const zhHans: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: '选择盘面',
  sudoku6x6Difficulty_easy: '简单',
  sudoku6x6Difficulty_medium: '中等',
  sudoku6x6Difficulty_hard: '困难',
  sudoku6x6ConfirmSwitchTitle: '替换进行中的盘面？',
  sudoku6x6ConfirmSwitchBody: '你的{current}对局将被新的{next}盘面替换。',
  sudoku6x6GridLabel: '数独 6×6 盘面',
  sudoku6x6PadLabel: '数字键盘',
  sudoku6x6PadKey: '{value}，还剩 {n}',
  sudoku6x6PadNoteKey: '笔记 {value}',
  sudoku6x6CellEmpty: '空，第 {row} 行第 {col} 列',
  sudoku6x6CellGiven: '{value}，题目数字，第 {row} 行第 {col} 列',
  sudoku6x6CellEntry: '{value}，第 {row} 行第 {col} 列',
  sudoku6x6Erase: '擦除',
  sudoku6x6Notes: '笔记',
  sudoku6x6HintOnlyDigit: '这一格只能填一个数字。',
  sudoku6x6HintOnlyCell: '在这里，{value} 只能填这一格。',
  sudoku6x6HintLockedLine: '在这一宫内，{value} 只能填在高亮的那条线上。',
  sudoku6x6HintLockedBox: '在这条线上，{value} 只能填在高亮的那一宫内。',
  sudoku6x6HintRuledOut: '这几格可以排除同一区域内其他格的候选数。',
  sudoku6x6HintNone: '现在还推不出下一步。',
  sudoku6x6SolvedTitle: '完成！',
  sudoku6x6SolvedBody: '每行、每列、每宫都填满了 1-6。',
  sudoku6x6Mistakes: '错误',
  sudoku6x6HintsUsed: '已用提示',
  sudoku6x6NewBestTime: '你的最快纪录。',
  sudoku6x6NewBoard: '新盘面',
  sudoku6x6DailySection: '每日',
  sudoku6x6DailiesSolved: '完成的天数',
  sudoku6x6DailyBacklogHint: '之前的每一天都可以补做。',
  sudoku6x6HighlightMistakes: '标出错误',
  sudoku6x6HighlightMistakesNote: '填入错误数字时立即标出。重复的数字始终会标出。',
  sudoku6x6Step1Title: '1-6 各一次',
  sudoku6x6Step1Body: '每行、每列、每个 2×3 宫内，1 到 6 各出现一次。',
  sudoku6x6Step2Title: '填写与笔记',
  sudoku6x6Step2Body: '选中一格并点数字。打开“笔记”可把候选数写进格子里。',
  sudoku6x6Step3Title: '卡住了？看提示',
  sudoku6x6Step3Body: '提示会指出下一个能确定的格子，以及为什么。',
};
