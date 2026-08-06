import type { BlockPuzzleMessages } from './en';

export const ja: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: '盤面、8×8',
  blockCellFilled: '{row} 行 {col} 列：埋まっている',
  blockCellEmpty: '{row} 行 {col} 列：空き',
  blockTrayLabel: 'ピース',
  blockPieceLabel: 'ピース {n}、{cells} マス',
  blockPieceUsed: 'ピース {n}、配置済み',
  blockPieceSelected: 'ピース {n} を選択中',
  blockBestScore: 'ベストスコア',
  blockLines: '消したライン',
  blockOverTitle: '置く場所がない',
  blockOverBody: 'どのピースも盤面に入りません。',
  blockNewBestScore: '自己ベスト更新！',
  blockStep1Title: 'ピースを運ぶ',
  blockStep1Body: '3 つのピースのどれかを盤面へ。回転はしません。',
  blockStep2Title: '行か列を埋める',
  blockStep2Body: '埋まる行・列は運んでいる間に光ります。同時に消すほど点が伸びます。',
  blockStep3Title: '置けなくなるまで',
  blockStep3Body: 'Undo は何度でも無料。置き間違いに代償はありません。',
};
