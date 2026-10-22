/**
 * Korean catalog for Bounce Up.
 *
 * Provenance (docs/BOUNCE_UP_RULES.md §8, docs/I18N_POLICY.md「来歴」): written by
 * AI (Claude) from the English source on 2026-10-22 and **not yet read by
 * anyone** — neither the author nor a native speaker. It is not to be
 * treated as reviewed.
 *
 * The title (`bounceUpName`) is a proper noun and stays as it is in every
 * locale. Terms follow §8's glossary: platform, score, best, total.
 */
import type { BounceUpMessages } from './en';

export const ko: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: '오르기 시작',
  bounceUpBestNote: '최고 {score}',
  bounceUpWidth: '발판',
  bounceUpWidth_normal: '보통',
  bounceUpWidth_wide: '넓게',
  bounceUpBest: '최고 점수',
  bounceUpTotal: '총점',
  bounceUpBoardLabel: 'Bounce Up 판, {state}',
  bounceUpState_ready: '첫 조작을 기다리는 중',
  bounceUpState_running: '오르는 중',
  bounceUpState_paused: '일시정지됨',
  bounceUpState_over: '판 종료',
  bounceUpTouchToStart: '판에서 밀거나 ← →를 눌러 시작',
  bounceUpPaused: '일시정지됨',
  bounceUpPause: '일시정지',
  bounceUpStart: '시작',
  bounceUpClimbAgain: '다시 오르기',
  bounceUpPad: '이동 버튼',
  bounceUpMoveLeft: '왼쪽으로 이동',
  bounceUpMoveRight: '오른쪽으로 이동',
  bounceUpResultTitle: '{score}까지 올랐습니다',
  bounceUpLiveResult: '판이 끝났습니다. 점수 {score}.',
  bounceUpStep1Title: '밀어서 움직이기',
  bounceUpStep1Body:
    '판 위에서 손가락을 좌우로 밀거나 ← →를 누르면 움직이고, 발판에 내려설 때마다 저절로 튀어 오릅니다.',
  bounceUpStep2Title: '양쪽 끝은 이어져 있어요',
  bounceUpStep2Body:
    '한쪽 끝으로 나가면 반대쪽 끝으로 들어오니, 양쪽을 다 써서 위의 발판으로 오르세요.',
  bounceUpStep3Title: '높이가 점수',
  bounceUpStep3Body: '발판을 놓치고 아래로 떨어지면 판이 끝나고, 오른 높이가 점수가 됩니다.',
};
