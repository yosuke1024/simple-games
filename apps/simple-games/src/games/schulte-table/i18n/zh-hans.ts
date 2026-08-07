import type { SchulteMessages } from './en';

export const zhHans: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: '数字盘面',
  schulteCell: '{value}，第 {row} 行第 {col} 列',
  schulteCellDone: '{value}，第 {row} 行第 {col} 列，已点过',
  schulteFind: '找',

  schulteDoneTitle: '全部找到',
  schulteDoneBody: '你按顺序点完了所有数字。',
  schulteMisses: '点错次数',
  schulteNewBestTime: '你的最快纪录。',
  schulteConfirmRestartBody: '这一局将从第一个数字重新开始。',

  schulteDailyBacklogHint: '过去的每一天都可以随时挑战。',
  schulteSizeLabel: '{n}×{n}',
  schulteLevelsDone: '完成的关卡',
  schulteDailiesDone: '完成的每日',
  schulteTotalMisses: '点错总次数',

  schulteStep1Title: '先点 1，再点 2，再点 3',
  schulteStep1Body: '数字散落在盘面上，按从小到大的顺序点。',
  schulteStep2Title: '要找的数字显示在盘面上方',
  schulteStep2Body: '点错了也没有惩罚，盘面只是静静等着。',
  schulteStep3Title: '把整个盘面点完',
  schulteStep3Body: '你的用时会被记录，没有时间限制。',
};
