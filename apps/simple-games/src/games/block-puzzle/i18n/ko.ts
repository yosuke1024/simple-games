import type { BlockPuzzleMessages } from './en';

export const ko: BlockPuzzleMessages = {
  blockName: 'Block Puzzle',
  blockBoardLabel: '블록 보드, 8 곱하기 8',
  blockCellFilled: '{row}행 {col}열: 채워짐',
  blockCellEmpty: '{row}행 {col}열: 비어 있음',
  blockTrayLabel: '조각',
  blockPieceLabel: '조각 {n}, {cells}칸',
  blockPieceUsed: '조각 {n}, 이미 놓음',
  blockPieceSelected: '조각 {n} 선택됨',
  blockBestScore: '최고 점수',
  blockLines: '지운 줄',
  blockOverTitle: '놓을 자리가 없음',
  blockOverBody: '어떤 조각도 보드에 들어가지 않습니다.',
  blockNewBestScore: '지금까지의 최고 점수!',
  blockStep1Title: '조각을 끌어다 놓기',
  blockStep1Body: '세 조각 중 하나를 보드로 옮기세요. 조각은 회전하지 않습니다.',
  blockStep2Title: '가로줄이나 세로줄 채우기',
  blockStep2Body: '가득 찬 줄은 사라지고, 한 번에 여러 줄을 지울수록 점수가 높습니다.',
  blockStep3Title: '놓을 곳이 없을 때까지',
  blockStep3Body: '되돌리기는 무료이고 무제한이라 잘못 놓아도 손해가 없습니다.',
};
