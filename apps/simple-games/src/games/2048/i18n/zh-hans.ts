import type { Game2048Messages } from './en';

export const zhHans: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048 盘面，4×4',
  mergeCell: '第 {row} 行第 {col} 列：{value}',
  mergeCellEmpty: '第 {row} 行第 {col} 列：空',
  mergeBestScore: '最高分',
  mergeBestTile: '最大方块',
  mergeReachedCount: '达成 2048 的次数',
  mergeReachedTitle: '你达成了 2048！',
  mergeReachedBody: '继续玩吧，盘面还没结束。',
  mergeKeepGoing: '继续',
  mergeOverTitle: '没有可走的步了',
  mergeOverBody: '盘面已满，也没有可以合并的方块。',
  mergeNewBestScore: '你的最高分。',
  mergeStep1Title: '滑动来推动',
  mergeStep1Body: '所有方块同时朝那个方向滑动，相同的两个数字会合成一个。',
  mergeStep2Title: '出现一个新方块',
  mergeStep2Body: '每次让盘面发生变化的移动之后，都会新增一个方块。',
  mergeStep3Title: '走不动了？可以撤销',
  mergeStep3Body: '撤销免费且不限次数，也不会重新抽取刚出现的方块。',
};
