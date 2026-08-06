import type { Game2048Messages } from './en';

export const zhHant: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048 盤面，4×4',
  mergeCell: '第 {row} 列第 {col} 欄：{value}',
  mergeCellEmpty: '第 {row} 列第 {col} 欄：空',
  mergeBestScore: '最高分',
  mergeBestTile: '最大方塊',
  mergeReachedCount: '達成 2048 的次數',
  mergeReachedTitle: '你達成了 2048！',
  mergeReachedBody: '繼續玩吧，盤面還沒結束。',
  mergeKeepGoing: '繼續',
  mergeOverTitle: '沒有可走的步了',
  mergeOverBody: '盤面已滿，也沒有可以合併的方塊。',
  mergeNewBestScore: '你的最高分。',
  mergeStep1Title: '滑動來推動',
  mergeStep1Body: '所有方塊同時朝那個方向滑動，相同的兩個數字會合成一個。',
  mergeStep2Title: '出現一個新方塊',
  mergeStep2Body: '每次讓盤面發生變化的移動之後，都會新增一個方塊。',
  mergeStep3Title: '走不動了？可以復原',
  mergeStep3Body: '復原免費且不限次數，也不會重新抽取剛出現的方塊。',
};
