import type { HeartsMessages } from './en';

export const ko: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: '상대 선택',
  heartsDifficulty_easy: '쉬움',
  heartsDifficulty_normal: '보통',
  heartsDifficulty_hard: '어려움',
  heartsRecordNote: '{wins}승 · {losses}패 · {draws}무',
  heartsConfirmSwitchTitle: '진행 중인 매치를 바꿀까요?',
  heartsConfirmSwitchBody: '진행 중인 {current} 매치가 새 {next} 매치로 바뀝니다.',

  heartsTableLabel: 'Hearts 테이블',
  heartsHandLabel: '내 패',
  heartsTrickLabel: '이번 트릭',
  heartsTrayLabel: '넘길 카드',
  heartsYou: '나',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: '나: 이번 판 {hand}점, 매치 누계 {total}점',
  heartsSeatLabel: 'CPU {n}: 카드 {cards}장, 이번 판 {hand}점, 매치 누계 {total}점',
  heartsTookLastTrick: '직전 트릭을 가져갔습니다',
  heartsCardLabel: '{suit} {rank}',
  heartsSuit_spades: '스페이드',
  heartsSuit_hearts: '하트',
  heartsSuit_diamonds: '다이아몬드',
  heartsSuit_clubs: '클럽',
  heartsCardBlocked: '{card}, 지금은 낼 수 없습니다',
  heartsCardChosen: '{card}, 넘기려고 고른 카드',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: '넘길 카드 세 장을 고르세요',
  heartsPassLeft: '왼쪽으로 넘기기',
  heartsPassAcross: '맞은편으로 넘기기',
  heartsPassRight: '오른쪽으로 넘기기',
  heartsPassConfirm: '이 세 장 넘기기',
  heartsPassWaiting: '다른 자리를 기다리는 중…',

  heartsPlayPrompt: '카드를 탭하고, 다시 탭하면 냅니다',
  heartsCpuTurn: 'CPU {n} 차례입니다…',
  heartsTrickYou: '내가 트릭을 가져갔습니다',
  heartsTrickCpu: 'CPU {n}이(가) 트릭을 가져갔습니다',

  heartsHandTitle: '판 정산',
  heartsMoonTitle: '26점 독식',
  heartsMoonYou: '내가 26점을 모두 가져갔으므로 나머지 세 자리가 26점씩 받습니다.',
  heartsMoonCpu: 'CPU {n}이(가) 26점을 모두 가져갔으므로 나머지 모두가 26점씩 받습니다.',
  heartsThisHand: '이번 판',
  heartsMatchTotal: '매치 누계',
  heartsNextHand: '다음 판',

  heartsWinTitle: '승리!',
  heartsWinBody: '누군가 100점을 넘긴 시점에 점수가 가장 적었습니다.',
  heartsLoseTitle: 'CPU 승리',
  heartsLoseBody: '다른 자리가 더 적은 점수로 끝냈습니다. 다음 매치는 무료입니다.',
  heartsDrawTitle: '무승부',
  heartsDrawBody: '가장 적은 점수에서 다른 자리와 동점으로 끝났습니다.',
  heartsFinalScores: '최종 점수',

  heartsWins: '승리',
  heartsLosses: '패배',
  heartsDraws: '무승부',

  heartsStep1Title: '세 장 넘기기',
  heartsStep1Body:
    '대부분의 판은 카드 세 장을 골라 넘기며 시작합니다 — 왼쪽, 오른쪽, 맞은편, 그리고 아무도 넘기지 않는 판 순서입니다.',
  heartsStep2Title: '무늬 따라내기',
  heartsStep2Body:
    '먼저 나온 카드가 무늬를 정하고, 그 무늬가 있는 한 따라내야 하며, 그 무늬에서 가장 큰 카드가 트릭을 가져갑니다.',
  heartsStep3Title: '점수가 적을수록 승리',
  heartsStep3Body:
    '가져온 하트는 한 장에 1점, 스페이드 Q는 13점이므로, 누군가 100점을 넘기면 점수가 가장 적은 쪽이 이깁니다.',
};
