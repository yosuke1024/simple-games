/**
 * Simplified Chinese catalog for Loop Puzzle — written with AI assistance
 * from the English source (provenance `machine`, docs/LOOP_PUZZLE_RULES.md
 * §14). No native speaker has read it; it is not to be treated as reviewed.
 * The title (`loopPuzzleName`) is a proper noun and stays as-is in every
 * locale; placeholder names match the English source. Terms follow the shell
 * (`hint` = 提示) and Box Regions (board = 棋盘); an edge is 边, a drawn edge
 * 线, the loop 回路.
 */
import type { LoopPuzzleMessages } from './en';

export const zhHans: LoopPuzzleMessages = {
  loopPuzzleName: 'Loop Puzzle',
  loopPuzzleChooseBoard: '选择棋盘',
  loopPuzzleDifficulty_easy: '简单',
  loopPuzzleDifficulty_medium: '中等',
  loopPuzzleDifficulty_hard: '困难',
  loopPuzzleBoardNote: '{width}×{height}',
  loopPuzzleConfirmSwitchTitle: '替换进行中的棋盘？',
  loopPuzzleConfirmSwitchBody: '你正在进行的{current}对局将被新的{next}棋盘替换。',
  loopPuzzleBoardLabel: 'Loop Puzzle 棋盘，{width} 乘 {height}',
  loopPuzzleEdgeHEmpty: '横边，第 {row} 行，第 {col} 列，空白',
  loopPuzzleEdgeHLine: '横边，第 {row} 行，第 {col} 列，已画线',
  loopPuzzleEdgeHCross: '横边，第 {row} 行，第 {col} 列，已标 ×',
  loopPuzzleEdgeVEmpty: '竖边，第 {row} 行，第 {col} 列，空白',
  loopPuzzleEdgeVLine: '竖边，第 {row} 行，第 {col} 列，已画线',
  loopPuzzleEdgeVCross: '竖边，第 {row} 行，第 {col} 列，已标 ×',
  loopPuzzleClueOpen: '数字 {n}，第 {row} 行第 {col} 列',
  loopPuzzleClueMet: '数字 {n}，第 {row} 行第 {col} 列，已满足',
  loopPuzzleClueTooMany: '数字 {n}，第 {row} 行第 {col} 列，线太多',
  loopPuzzleClueTooFew: '数字 {n}，第 {row} 行第 {col} 列，已无法满足',
  loopPuzzleNoteHint: '提示所标记',
  loopPuzzleNoteConflict: '违反规则',
  loopPuzzleConflictBranch: '有一个点连着超过两条线。',
  loopPuzzleConflictDeadEnd: '有一条线停在了无路可走的点上。',
  loopPuzzleConflictLoop: '闭合回路之外还有别的线。',
  loopPuzzleConflictTooMany: '有数字周围的线多于该数字。',
  loopPuzzleConflictTooFew: '有数字已经凑不够线了。',
  loopPuzzleConflictClosed: '回路已闭合，但有数字不符。',
  loopPuzzleHintWrongLine: '标记的线不属于回路。',
  loopPuzzleHintWrongCross: '回路会经过标记的 ×。',
  loopPuzzleHintCellLine: '根据圈出的数字，标记的边必须画线。',
  loopPuzzleHintCellCross: '根据圈出的数字，标记的边不能画线。',
  loopPuzzleHintDotLine: '在圈出的点上，回路必须经过标记的边。',
  loopPuzzleHintDotCross: '在圈出的点上，标记的边不能画线。',
  loopPuzzleHintLoopCross: '在标记的边画线会让回路过早闭合。',
  loopPuzzleHintClosedCross: '回路已闭合，所以标记的边不属于回路。',
  loopPuzzleHintTrialLine: '标记的边不画线会导致矛盾。',
  loopPuzzleHintTrialCross: '在标记的边画线会导致矛盾。',
  loopPuzzleHintRevealLine: '标记的边是回路的一部分。',
  loopPuzzleHintRevealCross: '标记的边不是回路的一部分。',
  loopPuzzleHintNone: '暂时没有提示。',
  loopPuzzleSolvedTitle: '完成！',
  loopPuzzleSolvedBody: '一条闭合回路，所有数字都已满足。',
  loopPuzzleHintsUsed: '已用提示',
  loopPuzzleNewBestTime: '你的最快纪录。',
  loopPuzzleNewBoard: '新棋盘',
  loopPuzzleSolvedCount: '已解谜题',
  loopPuzzleDailySection: '每日',
  loopPuzzleDailiesCleared: '已完成天数',
  loopPuzzleAllBoards: '所有棋盘',
  loopPuzzleStep1Title: '一条闭合回路',
  loopPuzzleStep1Body: '把点连成一条不分叉、不交叉的回路。',
  loopPuzzleStep2Title: '读懂数字',
  loopPuzzleStep2Body: '数字表示该格四条边中属于回路的条数。',
  loopPuzzleStep3Title: '轻触边',
  loopPuzzleStep3Body: '每轻触一次边，它会依次变为线、×（不在回路上）、空白。',
};
