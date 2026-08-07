import type { SchulteMessages } from './en';

export const zhHant: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: '數字盤面',
  schulteCell: '{value}，第 {row} 列第 {col} 欄',
  schulteCellDone: '{value}，第 {row} 列第 {col} 欄，已點過',
  schulteFind: '找',

  schulteDoneTitle: '全部找到',
  schulteDoneBody: '你依序點完了所有數字。',
  schulteMisses: '點錯次數',
  schulteNewBestTime: '你的最快紀錄。',
  schulteConfirmRestartBody: '這一局會從第一個數字重新開始。',

  schulteDailyBacklogHint: '過去的每一天都能隨時挑戰。',
  schulteSizeLabel: '{n}×{n}',
  schulteLevelsDone: '完成的關卡',
  schulteDailiesDone: '完成的每日',
  schulteTotalMisses: '點錯總次數',

  schulteStep1Title: '先點 1，再點 2，再點 3',
  schulteStep1Body: '數字散落在盤面上，照由小到大的順序點。',
  schulteStep2Title: '要找的數字顯示在盤面上方',
  schulteStep2Body: '點錯了也沒有懲罰，盤面只是靜靜等著。',
  schulteStep3Title: '把整個盤面點完',
  schulteStep3Body: '你的用時會被記錄，沒有時間限制。',
};
