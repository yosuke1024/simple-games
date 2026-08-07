import type { SchulteMessages } from './en';

export const ko: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: '숫자 판',
  schulteCell: '{value}, {row}행 {col}열',
  schulteCellDone: '{value}, {row}행 {col}열, 이미 탭함',
  schulteFind: '찾기',

  schulteDoneTitle: '모두 찾았습니다',
  schulteDoneBody: '숫자를 순서대로 모두 탭했습니다.',
  schulteMisses: '잘못된 탭',
  schulteNewBestTime: '지금까지 중 가장 빠릅니다.',
  schulteConfirmRestartBody: '이번 판을 첫 숫자부터 다시 시작합니다.',

  schulteDailyBacklogHint: '지난 날짜는 언제나 열려 있습니다.',
  schulteSizeLabel: '{n}×{n}',
  schulteLevelsDone: '완료한 레벨',
  schulteDailiesDone: '완료한 데일리',
  schulteTotalMisses: '잘못된 탭 합계',

  schulteStep1Title: '1, 2, 3 순서로 탭',
  schulteStep1Body: '숫자가 흩어져 있습니다. 순서대로 탭하세요.',
  schulteStep2Title: '찾을 숫자는 판 위에 있어요',
  schulteStep2Body: '잘못 눌러도 손해는 없습니다. 판은 그대로 기다립니다.',
  schulteStep3Title: '마지막 숫자까지',
  schulteStep3Body: '걸린 시간이 기록됩니다. 제한 시간은 없습니다.',
};
