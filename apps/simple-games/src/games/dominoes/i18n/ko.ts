import type { DominoesMessages } from './en';

export const ko: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins}승 · {losses}패',

  dominoesTileLabel: '패 {a}–{b}',
  dominoesLineLabel: '경기 줄: {count}장, 왼쪽 끝 {left}, 오른쪽 끝 {right}',
  dominoesHandLabel: '내 패',
  dominoesPlayLeft: '왼쪽 끝에 놓기 ({value})',
  dominoesPlayRight: '오른쪽 끝에 놓기 ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: '더미',
  dominoesCpuTiles: 'CPU가 {count}장을 들고 있습니다',
  dominoesBoneyardTiles: '더미: {count}장',
  dominoesDraw: '뽑기',
  dominoesPass: '넘기기',

  dominoesYourTurn: '내 차례입니다',
  dominoesCpuTurn: 'CPU가 생각 중입니다…',
  dominoesCpuDrew: 'CPU가 패를 한 장 뽑았습니다',
  dominoesCpuPassed: 'CPU가 순서를 넘겼습니다. 내 차례입니다',
  dominoesMustDraw: '놓을 수 있는 패가 없습니다. 더미에서 뽑으세요',
  dominoesNoTileFits: '놓을 수 있는 패가 없고 더미도 비었습니다. 넘기세요',
  dominoesChooseEnd: '이 패를 놓을 끝을 고르세요',
  dominoesOpenedYou: '{tile}로 시작했습니다',
  dominoesOpenedCpu: 'CPU가 {tile}로 시작했습니다. 내 차례입니다',

  dominoesWinTitle: '승리!',
  dominoesWinBodyOut: '마지막 패를 내려놓았습니다.',
  dominoesWinBodyBlocked: '아무도 놓을 수 없었고, 내 눈의 합이 더 적었습니다.',
  dominoesLoseTitle: 'CPU 승리',
  dominoesLoseBodyOut: 'CPU가 마지막 패를 내려놓았습니다.',
  dominoesLoseBodyBlocked: '아무도 놓을 수 없었고, CPU의 눈의 합이 더 적었습니다.',
  dominoesDrawTitle: '무승부',
  dominoesDrawBody: '아무도 놓을 수 없었고, 눈의 합이 같았습니다.',
  dominoesScoreYou: '{points}점 획득',
  dominoesScoreCpu: 'CPU가 {points}점 획득',
  dominoesPipsLeft: '남은 눈: 나 {you}, CPU {cpu}',

  dominoesWins: '승리',
  dominoesLosses: '패배',
  dominoesDraws: '무승부',

  dominoesStep1Title: '끝을 맞추세요',
  dominoesStep1Body: '줄의 양쪽 끝 중 하나와 숫자가 같은 패를 놓으세요.',
  dominoesStep2Title: '막혔다면 뽑기',
  dominoesStep2Body:
    '놓을 수 있는 패가 없으면 놓을 수 있을 때까지 더미에서 뽑으세요. 더미가 비었을 때만 넘기세요.',
  dominoesStep3Title: '먼저 다 내려놓기',
  dominoesStep3Body: '마지막 패를 놓으면 승리합니다. 상대에게 남은 눈의 합이 내 점수입니다.',
};
