import type { SlidingPuzzleMessages } from './en';

export const zhHans: SlidingPuzzleMessages = {
  slideName: '数字华容道',
  slideBoardLabel: '数字华容道盘面',
  slideTileLabel: '{value}，第 {row} 行第 {col} 列',
  slideBlankLabel: '空格，第 {row} 行第 {col} 列',
  slideSizeLabel: '{n}×{n}',
  slideMoves: '步数',
  slideBestMoves: '最少步数',
  slideSolvedTitle: '完成！',
  slideSolvedBody: '所有数字都归位了。',
  slideNewBestMoves: '你的最少步数纪录。',
  slideNewBestTime: '你的最快纪录。',
  slideLevelsSolved: '完成的关卡',
  slideDailiesSolved: '完成的每日',
  slideDailyBacklogHint: '过去的每一天都可以随时挑战。',
  slideStep1Title: '点空格旁边的方块',
  slideStep1Body: '点空格旁边的方块，它就会滑进去。',
  slideStep2Title: '一整排一起动',
  slideStep2Body: '在同一行或同一列上，中间的方块会一起滑动。',
  slideStep3Title: '从 1 开始依次排好',
  slideStep3Body: '按阅读顺序排好数字，空格留在右下角。',
};
