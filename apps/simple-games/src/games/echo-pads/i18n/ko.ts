/**
 * Echo Pads — the 한국어 catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * `machine` — written by an AI from the English source on 2026-10-22; nobody
 * has read it, native speaker or author. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): 패드 (pad), 순서 (sequence), 길이 (length), 재생 / 다시 듣기 / 정지, 속도: 느리게 / 보통 / 빠르게.
 */
import type { EchoPadsMessages } from './en';

export const ko: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',
  echoPadsTier_4: '패드 4개',
  echoPadsTier_6: '패드 6개',
  echoPadsLength: '길이 {n}',
  echoPadsLevelDetail: '{tier} · 길이 {length}',
  echoPadsPace: '속도',
  echoPadsPace_calm: '느리게',
  echoPadsPace_normal: '보통',
  echoPadsPace_quick: '빠르게',
  echoPadsPlay: '재생',
  echoPadsListenAgain: '다시 듣기',
  echoPadsStop: '정지',
  echoPadsRound: '길이 {k} / {target}',
  echoPadsStatusIdle: '재생을 누르면 패드 {k}개를 들을 수 있습니다.',
  echoPadsStatusPlaying: '패드 {k}개 재생 중…',
  echoPadsStatusYourTurn: '차례입니다: 패드 {k}개를 같은 순서로 탭하세요.',
  echoPadsStatusAgain: '패드 {k}개를 첫 번째부터 다시 탭하세요.',
  echoPadsStatusReview: '이번 라운드의 패드 {k}개를 다시 재생 중…',
  echoPadsMark_circle: '원',
  echoPadsMark_triangle: '삼각형',
  echoPadsMark_square: '사각형',
  echoPadsMark_star: '별',
  echoPadsMark_diamond: '마름모',
  echoPadsMark_cross: '십자',
  echoPadsPos_topLeft: '왼쪽 위',
  echoPadsPos_topMiddle: '가운데 위',
  echoPadsPos_topRight: '오른쪽 위',
  echoPadsPos_bottomLeft: '왼쪽 아래',
  echoPadsPos_bottomMiddle: '가운데 아래',
  echoPadsPos_bottomRight: '오른쪽 아래',
  echoPadsPadLabel: '{mark}, {position}',
  echoPadsPadsLabel: '패드',
  echoPadsExpectedLabel: '{pad} (다음 차례였던 패드)',
  echoPadsMissTitle: '길이 {k}에서 도전이 끝났습니다',
  echoPadsMissBody: '{k}개 중 {index}번째는 {pad}였습니다.',
  echoPadsResultTitle: '{n}개를 모두 따라 했습니다',
  echoPadsLongest: '따라 한 최장 길이',
  echoPadsLongestNone: '없음',
  echoPadsReplays: '다시 듣기 횟수',
  echoPadsPacesHeard: '속도',
  echoPadsNewSequence: '새 순서',
  echoPadsLevelCell: '{level}, {detail}',
  echoPadsLevelCellCleared: '{level}, {detail}, 클리어',
  echoPadsReplaceTitle: '진행 중인 도전을 바꿀까요?',
  echoPadsReplaceBody: '{current}의 도전이 {next}의 새 도전으로 바뀝니다.',
  echoPadsStatStarted: '시작한 도전',
  echoPadsStatCleared: '클리어',
  echoPadsStatMissed: '실수로 끝난 도전',
  echoPadsStatLevels: '클리어한 레벨',
  echoPadsStatDays: '완료한 날',
  echoPadsStep1Title: '듣기',
  echoPadsStep1Body:
    '▶를 누르면 패드가 하나씩 빛나며 소리가 납니다 — 순서를 기억하세요(첫 탭 전까지는 원하는 만큼 다시 들을 수 있습니다).',
  echoPadsStep2Title: '따라 하기',
  echoPadsStep2Body: '그다음 같은 순서로 패드를 탭하세요.',
  echoPadsStep3Title: '늘어나기',
  echoPadsStep3Body: '따라 할 때마다 순서가 하나씩 길어집니다 — 시간 제한은 없습니다.',
};
