/**
 * Traditional Chinese catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const zhHant: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: '選擇盤面',
  sudoku6x6Difficulty_easy: '簡單',
  sudoku6x6Difficulty_medium: '中等',
  sudoku6x6Difficulty_hard: '困難',
  sudoku6x6ConfirmSwitchTitle: '替換進行中的盤面？',
  sudoku6x6ConfirmSwitchBody: '你的{current}對局將被新的{next}盤面取代。',
  sudoku6x6GridLabel: '數獨 6×6 盤面',
  sudoku6x6PadLabel: '數字鍵盤',
  sudoku6x6PadKey: '{value}，還剩 {n}',
  sudoku6x6PadNoteKey: '筆記 {value}',
  sudoku6x6CellEmpty: '空白，第 {row} 列第 {col} 欄',
  sudoku6x6CellGiven: '{value}，題目數字，第 {row} 列第 {col} 欄',
  sudoku6x6CellEntry: '{value}，第 {row} 列第 {col} 欄',
  sudoku6x6Erase: '清除',
  sudoku6x6Notes: '筆記',
  sudoku6x6HintOnlyDigit: '這一格只能填一個數字。',
  sudoku6x6HintOnlyCell: '在這裡，{value} 只能填這一格。',
  sudoku6x6HintLockedLine: '在這一宮裡，{value} 只能填在標示的那一線上。',
  sudoku6x6HintLockedBox: '在這一線上，{value} 只能填在標示的那一宮裡。',
  sudoku6x6HintRuledOut: '這幾格可以排除同一區域中其他格的候選數。',
  sudoku6x6HintNone: '目前還推不出下一步。',
  sudoku6x6SolvedTitle: '完成！',
  sudoku6x6SolvedBody: '每一列、每一欄、每一宮都有 1-6。',
  sudoku6x6Mistakes: '錯誤',
  sudoku6x6HintsUsed: '已用提示',
  sudoku6x6NewBestTime: '你的最快紀錄。',
  sudoku6x6NewBoard: '新盤面',
  sudoku6x6DailySection: '每日',
  sudoku6x6DailiesSolved: '完成的天數',
  sudoku6x6DailyBacklogHint: '先前的每一天都可以補做。',
  sudoku6x6HighlightMistakes: '標出錯誤',
  sudoku6x6HighlightMistakesNote: '填入錯誤數字時立即標出。重複的數字一律會標出。',
  sudoku6x6Step1Title: '1-6 各一次',
  sudoku6x6Step1Body: '每一列、每一欄、每個 2×3 宮裡，1 到 6 各出現一次。',
  sudoku6x6Step2Title: '填寫與筆記',
  sudoku6x6Step2Body: '選一格並點數字。開啟「筆記」可把候選數寫進格子裡。',
  sudoku6x6Step3Title: '卡住了？看提示',
  sudoku6x6Step3Body: '提示會指出下一個能確定的格子，以及為什麼。',
};
