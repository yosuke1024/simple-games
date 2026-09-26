/**
 * Traditional Chinese catalog of Number Path (docs/I18N_POLICY.md: provenance `machine` — written
 * with AI assistance and not yet read by a native speaker). The title is a proper
 * noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const zhHant: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: '選擇棋盤',
  numberPathDifficulty_easy: '簡單',
  numberPathDifficulty_medium: '中等',
  numberPathDifficulty_hard: '困難',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path 棋盤，{width}×{height}',
  numberPathCellPlain: '第 {row} 列第 {col} 欄',
  numberPathCellNumber: '數字 {n}，第 {row} 列第 {col} 欄',
  numberPathOnPath: '在路徑上，第 {step} 步',
  numberPathOffPath: '不在路徑上',
  numberPathHintNext: '標記的格子就是下一步。',
  numberPathHintBack: '路徑已偏離。請退回到標記的格子。',
  numberPathHintNone: '目前沒有提示。',
  numberPathSolvedTitle: '完成！',
  numberPathSolvedBody: '一筆畫過每一格，依序前進。',
  numberPathHintsUsed: '使用的提示',
  numberPathNewBestTime: '你的最快紀錄。',
  numberPathNewBoard: '新棋盤',
  numberPathSolvedCount: '完成的棋盤',
  numberPathDailySection: '每日',
  numberPathDailiesSolved: '完成的天數',
  numberPathDailyBacklogHint: '之前的每一天都可以挑戰。',
  numberPathStep1Title: '依序經過數字',
  numberPathStep1Body: '從 1 出發畫一條線，依序經過各個數字。',
  numberPathStep2Title: '走遍每一格',
  numberPathStep2Body: '這條線恰好經過每格一次，並在最後一個數字結束。',
  numberPathStep3Title: '牆不能穿過',
  numberPathStep3Body: '粗邊是牆，無法穿過；要後退，可沿線反向拖曳或點一下線上的格子。',
};
