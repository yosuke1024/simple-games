/** AI-authored translation draft; no human review claimed. See docs/NIM_RULES.md. */
import type { NimMessages } from './en';
export const ko: NimMessages = {
  nimName: 'Nim',
  nimMode_easy: '쉬움',
  nimMode_normal: '보통',
  nimMode_hard: '어려움',
  nimRow: '{row}행: 돌 {count}개',
  nimTake: '{count}개 가져가기',
  nimYourTurn: '내 차례',
  nimCpuTurn: 'CPU 차례',
  nimPaused: '일시 정지 중입니다. 준비되면 계속하세요.',
  nimLastMove: '직전 수: {row}행에서 {count}개.',
  nimGoal: '마지막 돌을 가져가면 승리합니다.',
  nimChooseRow: '한 행을 고르세요.',
  nimChooseCount: '가져갈 개수를 고르세요.',
  nimWon: '승리!',
  nimLost: 'CPU 승리',
  nimOpponent: '상대',
  nimWins: '승리',
  nimLosses: '패배',
  nimStep1Title: '한 행 선택',
  nimStep1Body: '돌이 있는 행 하나를 고르세요. 항상 먼저 시작합니다.',
  nimStep2Title: '한 개 이상 가져가기',
  nimStep2Body: '해당 행에서 가져갈 돌의 개수를 고른 뒤 확정하세요.',
  nimStep3Title: '마지막 돌 가져가기',
  nimStep3Body:
    'CPU와 번갈아 가져가며 마지막 돌을 가져간 쪽이 이깁니다. 되돌리면 CPU의 응수까지 취소됩니다.',
};
