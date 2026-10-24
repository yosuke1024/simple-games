/**
 * Traditional Chinese catalog for Loop Puzzle — written with AI assistance
 * from the English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md
 * §14). No native speaker has read it; it is not to be treated as reviewed.
 * The title (`loopPuzzleName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source. Terms follow the shell
 * (`hint` = 提示) and Box Regions (board = 棋盤; row = 列, column = 欄, the
 * Taiwan convention); an edge is 邊, a drawn edge 線, the loop 迴路.
 */
import type { LoopPuzzleMessages } from './en';

export const zhHant: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: '選擇棋盤',
  loopPuzzleDifficulty_easy: '簡單',
  loopPuzzleDifficulty_medium: '中等',
  loopPuzzleDifficulty_hard: '困難',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: '取代進行中的棋盤？',
  loopPuzzleConfirmSwitchBody: '你正在進行的{current}遊戲將被新的{next}棋盤取代。',
  loopPuzzleBoardLabel: 'Loop Puzzle 棋盤，{width} 乘 {height}',
  loopPuzzleEdgeHEmpty: '橫邊，第 {row} 列，第 {col} 欄，空白',
  loopPuzzleEdgeHLine: '橫邊，第 {row} 列，第 {col} 欄，已畫線',
  loopPuzzleEdgeHCross: '橫邊，第 {row} 列，第 {col} 欄，已標 ×',
  loopPuzzleEdgeVEmpty: '豎邊，第 {row} 列，第 {col} 欄，空白',
  loopPuzzleEdgeVLine: '豎邊，第 {row} 列，第 {col} 欄，已畫線',
  loopPuzzleEdgeVCross: '豎邊，第 {row} 列，第 {col} 欄，已標 ×',
  loopPuzzleClueOpen: '數字 {n}，第 {row} 列第 {col} 欄',
  loopPuzzleClueMet: '數字 {n}，第 {row} 列第 {col} 欄，已滿足',
  loopPuzzleClueTooMany: '數字 {n}，第 {row} 列第 {col} 欄，線太多',
  loopPuzzleClueTooFew: '數字 {n}，第 {row} 列第 {col} 欄，已無法滿足',
  loopPuzzleNoteHint: '提示所標記',
  loopPuzzleNoteConflict: '違反規則',
  loopPuzzleConflictBranch: '有一個點連著超過兩條線。',
  loopPuzzleConflictDeadEnd: '有一條線停在了無路可走的點上。',
  loopPuzzleConflictLoop: '封閉迴路之外還有別的線。',
  loopPuzzleConflictTooMany: '有數字周圍的線多於該數字。',
  loopPuzzleConflictTooFew: '有數字已經湊不夠線了。',
  loopPuzzleConflictClosed: '迴路已封閉，但有數字不符。',
  loopPuzzleHintWrongLine: '標記的線不屬於迴路。',
  loopPuzzleHintWrongCross: '迴路會經過標記的 ×。',
  loopPuzzleHintCellLine: '根據圈起的數字，標記的邊必須畫線。',
  loopPuzzleHintCellCross: '根據圈起的數字，標記的邊不能畫線。',
  loopPuzzleHintDotLine: '在圈起的點上，迴路必須經過標記的邊。',
  loopPuzzleHintDotCross: '在圈起的點上，標記的邊不能畫線。',
  loopPuzzleHintLoopCross: '在標記的邊畫線會讓迴路過早封閉。',
  loopPuzzleHintClosedCross: '迴路已封閉，所以標記的邊不屬於迴路。',
  loopPuzzleHintTrialLine: '標記的邊不畫線會導致矛盾。',
  loopPuzzleHintTrialCross: '在標記的邊畫線會導致矛盾。',
  loopPuzzleHintRevealLine: '標記的邊是迴路的一部分。',
  loopPuzzleHintRevealCross: '標記的邊不是迴路的一部分。',
  loopPuzzleHintNone: '目前沒有提示。',
  loopPuzzleSolvedTitle: '完成！',
  loopPuzzleSolvedBody: '一條封閉迴路，所有數字都已滿足。',
  loopPuzzleHintsUsed: '已使用提示',
  loopPuzzleNewBestTime: '你的最快紀錄。',
  loopPuzzleNewBoard: '新棋盤',
  loopPuzzleSolvedCount: '已解謎題',
  loopPuzzleDailySection: '每日',
  loopPuzzleDailiesCleared: '已完成天數',
  loopPuzzleAllBoards: '所有棋盤',
  loopPuzzleStep1Title: '一條封閉迴路',
  loopPuzzleStep1Body: '把點連成一條不分岔、不交叉的迴路。',
  loopPuzzleStep2Title: '讀懂數字',
  loopPuzzleStep2Body: '數字表示該格四條邊中屬於迴路的條數。',
  loopPuzzleStep3Title: '輕觸邊',
  loopPuzzleStep3Body: '每輕觸一次邊，它會依序變為線、×（不在迴路上）、空白。',
};
