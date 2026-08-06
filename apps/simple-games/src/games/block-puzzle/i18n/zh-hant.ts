import type { BlockPuzzleMessages } from './en';

export const zhHant: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: '方塊棋盤，8 乘 8',
  blockCellFilled: '第 {row} 列第 {col} 行：已填',
  blockCellEmpty: '第 {row} 列第 {col} 行：空的',
  blockTrayLabel: '方塊',
  blockPieceLabel: '第 {n} 塊，{cells} 格',
  blockPieceUsed: '第 {n} 塊，已放置',
  blockPieceSelected: '已選擇第 {n} 塊',
  blockBestScore: '最高分',
  blockLines: '消除行列數',
  blockOverTitle: '放不下了',
  blockOverBody: '沒有一塊能放進棋盤。',
  blockNewBestScore: '你的新紀錄！',
  blockStep1Title: '把方塊拖進棋盤',
  blockStep1Body: '把三塊中的任一塊拖到棋盤上。方塊不能旋轉。',
  blockStep2Title: '填滿一列或一行',
  blockStep2Body: '填滿的行列會消除，一次消得越多，分數越高。',
  blockStep3Title: '玩到放不下為止',
  blockStep3Body: '復原免費且不限次數，放錯也沒有代價。',
};
