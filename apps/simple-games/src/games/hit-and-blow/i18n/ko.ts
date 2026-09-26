import type { HitAndBlowMessages } from './en';

export const ko: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: '난이도 선택',
  hitAndBlowDifficulty_easy: '쉬움',
  hitAndBlowDifficulty_normal: '보통',
  hitAndBlowDifficulty_hard: '어려움',
  hitAndBlowCodeNote: '{pool}개 중 {slots}개',
  hitAndBlowBestNote: '최고 {count}',
  hitAndBlowConfirmSwitchTitle: '진행 중인 게임을 바꿀까요?',
  hitAndBlowConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 게임으로 교체됩니다.',

  hitAndBlowSymbol_circle: '원',
  hitAndBlowSymbol_triangle: '삼각형',
  hitAndBlowSymbol_square: '정사각형',
  hitAndBlowSymbol_diamond: '다이아몬드',
  hitAndBlowSymbol_star: '별',
  hitAndBlowSymbol_cross: '십자',
  hitAndBlowSymbol_hexagon: '육각형',
  hitAndBlowSymbol_heart: '하트',

  hitAndBlowGuessCounter: '{n}번째 추측',
  hitAndBlowHistoryLabel: '지금까지의 추측',
  hitAndBlowHistoryEmpty: '추측이 여기에 쌓입니다.',
  hitAndBlowRowLabel: '{n}번째 추측: {symbols}. 스트라이크 {hits}, 볼 {blows}.',
  hitAndBlowDraftLabel: '내 추측',
  hitAndBlowSlotEmpty: '{n}번 칸: 비어 있음',
  hitAndBlowSlotFilled: '{n}번 칸: {symbol}',
  hitAndBlowPaletteLabel: '기호',
  hitAndBlowCheck: '확인',
  hitAndBlowHit: '스트라이크',
  hitAndBlowBlow: '볼',

  hitAndBlowWinTitle: '코드 해독',
  hitAndBlowWinBody: '숨겨진 줄을 찾았습니다.',
  hitAndBlowGuessesLabel: '추측 횟수',
  hitAndBlowNewBest: '지금까지 중 가장 적은 추측입니다.',
  hitAndBlowSolved: '해결',
  hitAndBlowFewestGuesses: '최소 추측 횟수',
  hitAndBlowAverageGuesses: '평균 추측 횟수',

  hitAndBlowStep1Title: '숨겨진 줄 찾기',
  hitAndBlowStep1Body:
    '서로 다른 기호로 된 줄이 숨겨져 있습니다. 어떤 기호가 어떤 순서로 있는지 알아내세요.',
  hitAndBlowStep2Title: '추측 채우기',
  hitAndBlowStep2Body: '기호를 탭해 줄을 채운 다음 확인을 누르세요.',
  hitAndBlowStep3Title: '표시 읽기',
  hitAndBlowStep3Body:
    '● 스트라이크: 기호와 위치가 모두 맞음. ○ 볼: 기호는 맞지만 위치가 다름. 몇 번이든 원하는 만큼 추측할 수 있습니다.',
};
