import type { Game2048Messages } from './en';

export const ko: Game2048Messages = {
  mergeName: '2048',
  mergeBoardLabel: '2048 보드, 4×4',
  mergeCell: '{row}행 {col}열: {value}',
  mergeCellEmpty: '{row}행 {col}열: 빈칸',
  mergeBestScore: '최고 점수',
  mergeBestTile: '가장 큰 타일',
  mergeReachedCount: '2048에 도달한 횟수',
  mergeReachedTitle: '2048에 도달했습니다!',
  mergeReachedBody: '계속 이어가세요 — 보드는 아직 열려 있습니다.',
  mergeKeepGoing: '계속하기',
  mergeOverTitle: '움직일 수 없습니다',
  mergeOverBody: '모든 칸이 찼고 합칠 수 있는 것도 없습니다.',
  mergeNewBestScore: '자신의 최고 점수입니다.',
  mergeStep1Title: '밀어서 이동',
  mergeStep1Body: '모든 타일이 그 방향으로 한 번에 밀리고, 같은 숫자 둘은 하나가 됩니다.',
  mergeStep2Title: '새 타일이 나타납니다',
  mergeStep2Body: '보드가 바뀐 이동마다 타일이 하나 추가됩니다.',
  mergeStep3Title: '막혔나요? 되돌리기',
  mergeStep3Body: '되돌리기는 무료이며 무제한이고, 방금 나온 타일을 다시 뽑지 않습니다.',
};
