/**
 * Simplified Chinese catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const zhHans: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: '选择棋盘',
  numberPathDifficulty_easy: '简单',
  numberPathDifficulty_medium: '中等',
  numberPathDifficulty_hard: '困难',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path 棋盘，{width}×{height}',
  numberPathCellPlain: '第 {row} 行第 {col} 列',
  numberPathCellNumber: '数字 {n}，第 {row} 行第 {col} 列',
  numberPathOnPath: '在路径上，第 {step} 步',
  numberPathOffPath: '不在路径上',
  numberPathHintNext: '标记的格子就是下一步。',
  numberPathHintBack: '路径已偏离。请退回到标记的格子。',
  numberPathHintNone: '暂时没有提示。',
  numberPathHintMarked: '提示',
  numberPathSolvedTitle: '完成！',
  numberPathSolvedBody: '一笔画过每一格，按顺序。',
  numberPathHintsUsed: '使用的提示',
  numberPathNewBestTime: '你的最快纪录。',
  numberPathNewBoard: '新棋盘',
  numberPathSolvedCount: '完成的棋盘',
  numberPathDailySection: '每日',
  numberPathDailiesSolved: '完成的天数',
  numberPathStep1Title: '按顺序经过数字',
  numberPathStep1Body: '从 1 出发画一条线，按顺序经过各个数字。',
  numberPathStep2Title: '走遍每一格',
  numberPathStep2Body: '这条线恰好经过每格一次，并在最后一个数字结束。',
  numberPathStep3Title: '墙不能穿过',
  numberPathStep3Body: '粗边是墙，无法穿过；要后退，可沿线反向拖动或点按线上的格子。',
};
