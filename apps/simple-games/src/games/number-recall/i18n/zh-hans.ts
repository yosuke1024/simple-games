import type { RecallMessages } from './en';

export const zhHans: RecallMessages = {
  recallName: 'Number Recall',

  recallBoardLabel: '方块盘面',
  recallTileUp: '{value}，第 {row} 行第 {col} 列',
  recallTileDown: '背面朝上，第 {row} 行第 {col} 列',
  recallMemorise: '想看多久都可以，准备好就点 1。',
  recallNext: '下一个',

  recallDoneTitle: '全部记住了',
  recallDoneBody: '你按顺序找齐了所有方块。',
  recallMissTitle: '不是这一个',
  recallMissBody: '该点的方块已用圆圈标出。换一种新排列再来。',
  recallTiles: '方块数',
  recallNewBestTime: '你的最快纪录。',
  recallNewLayout: '新排列',

  recallDailyBacklogHint: '过去的每一天都可以随时挑战。',
  recallSizeLabel: '{n}×{n}',
  recallLevelsDone: '完成的关卡',
  recallDailiesDone: '完成的每日',
  recallFirstTry: '一次通过',

  recallStep1Title: '想看多久都可以',
  recallStep1Body: '数字一直显示着，没有任何倒计时。',
  recallStep2Title: '点 1，其余的翻到背面',
  recallStep2Body: '接着凭记忆点 2、3，一直点下去。',
  recallStep3Title: '点错一个就结束这一局',
  recallStep3Body: '先看到答案，再用同一关的新排列重来。',
};
