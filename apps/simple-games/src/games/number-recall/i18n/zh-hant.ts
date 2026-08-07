import type { RecallMessages } from './en';

export const zhHant: RecallMessages = {
  recallName: 'Number Recall',

  recallBoardLabel: '方塊盤面',
  recallTileUp: '{value}，第 {row} 列第 {col} 欄',
  recallTileDown: '背面朝上，第 {row} 列第 {col} 欄',
  recallMemorise: '想看多久都可以，準備好就點 1。',
  recallNext: '下一個',

  recallDoneTitle: '全部記住了',
  recallDoneBody: '你依序找齊了所有方塊。',
  recallMissTitle: '不是這一個',
  recallMissBody: '該點的方塊已用圓圈標出。換一種新排列再來。',
  recallTiles: '方塊數',
  recallNewBestTime: '你的最快紀錄。',
  recallNewLayout: '新排列',

  recallDailyBacklogHint: '過去的每一天都能隨時挑戰。',
  recallSizeLabel: '{n}×{n}',
  recallLevelsDone: '完成的關卡',
  recallDailiesDone: '完成的每日',
  recallFirstTry: '一次過關',

  recallStep1Title: '想看多久都可以',
  recallStep1Body: '數字一直顯示著，沒有任何倒數計時。',
  recallStep2Title: '點 1，其餘的翻到背面',
  recallStep2Body: '接著憑記憶點 2、3，一直點下去。',
  recallStep3Title: '點錯一個就結束這一局',
  recallStep3Body: '先看到答案，再用同一關的新排列重來。',
};
