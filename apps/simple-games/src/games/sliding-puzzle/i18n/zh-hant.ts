import type { SlidingPuzzleMessages } from './en';

export const zhHant: SlidingPuzzleMessages = {
  slideName: '數字推盤',
  slideBoardLabel: '數字推盤盤面',
  slideTileLabel: '{value}，第 {row} 列第 {col} 欄',
  slideBlankLabel: '空格，第 {row} 列第 {col} 欄',
  slideSizeLabel: '{n}×{n}',
  slideMoves: '步數',
  slideBestMoves: '最少步數',
  slideSolvedTitle: '完成！',
  slideSolvedBody: '所有數字都回到原位了。',
  slideNewBestMoves: '你的最少步數紀錄。',
  slideNewBestTime: '你的最快紀錄。',
  slideLevelsSolved: '完成的關卡',
  slideDailiesSolved: '完成的每日',
  slideDailyBacklogHint: '過去的每一天都能隨時挑戰。',
  slideStep1Title: '點空格旁邊的方塊',
  slideStep1Body: '點空格旁邊的方塊，它就會滑進去。',
  slideStep2Title: '整排一起移動',
  slideStep2Body: '在同一列或同一欄上，中間的方塊會一起滑動。',
  slideStep3Title: '從 1 依序排好',
  slideStep3Body: '照閱讀順序排好數字，空格留在右下角。',
};
