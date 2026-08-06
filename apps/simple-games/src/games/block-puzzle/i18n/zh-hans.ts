import type { BlockPuzzleMessages } from './en';

export const zhHans: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: '方块棋盘，8 乘 8',
  blockCellFilled: '第 {row} 行第 {col} 列：已填',
  blockCellEmpty: '第 {row} 行第 {col} 列：空',
  blockTrayLabel: '方块',
  blockPieceLabel: '第 {n} 块，{cells} 格',
  blockPieceUsed: '第 {n} 块，已放置',
  blockPieceSelected: '已选择第 {n} 块',
  blockBestScore: '最高分',
  blockLines: '消除行列数',
  blockOverTitle: '放不下了',
  blockOverBody: '没有一块能放进棋盘。',
  blockNewBestScore: '你的新纪录！',
  blockStep1Title: '把方块拖进棋盘',
  blockStep1Body: '把三块中的任意一块拖到棋盘上。方块不能旋转。',
  blockStep2Title: '填满一行或一列',
  blockStep2Body: '整行或整列填满即消除，握着方块时该行列就会亮起。',
  blockStep3Title: '玩到放不下为止',
  blockStep3Body: '撤销免费且不限次数，放错也没有代价。',
};
