/**
 * Korean catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `등수` for Place (never 순위 or 랭킹), `접촉` for Bumps (never
 * 사고), the shell's `레벨` for Level.
 */
import type { OvertakeMessages } from './en';

export const ko: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: '조작',
  overtakeControlsDrag: '드래그',
  overtakeControlsButtons: '버튼',

  // The game screen
  overtakeStart: '시작',
  overtakePause: '일시정지',
  overtakeTouchToStart: '터치해서 출발',
  overtakePaused: '일시정지됨',
  overtakePlaceNow: '4대 중 {place}등',
  overtakeBoardLabel: 'Road Weave, 레벨 {n}: {state}',
  overtakeState_ready: '출발 대기',
  overtakeState_running: '주행 중',
  overtakeState_paused: '일시정지됨',
  overtakeState_finished: '골인',
  overtakePad: '운전 버튼',
  overtakeSteerLeft: '왼쪽으로',
  overtakeSteerRight: '오른쪽으로',
  overtakeSlowDown: '속도 줄이기',

  // The finish
  overtakeLiveResult: '4대 중 {place}등. 접촉 {bumps}회.',
  overtakeResultCleared: '레벨 {n} 클리어',
  overtakeResultPlaced: '레벨 {n} — {place}',
  overtakePlace: '등수',
  overtakeBumps: '접촉',

  // Quick Rules (§10)
  overtakeStep1Title: '차선 바꾸기',
  overtakeStep1Body:
    '차를 좌우로 움직여 차선을 바꿉니다. 가속은 자동이라 속도가 저절로 올라갑니다.',
  overtakeStep2Title: '속도 줄이기',
  overtakeStep2BodyDrag:
    '차가 붐비는 곳에서는 손가락을 아래로 당겨 속도를 줄이세요. 부딪히면 멈추니 줄이는 편이 더 빠릅니다.',
  overtakeStep2BodyHold:
    '차가 붐비는 곳에서는 ▼를 길게 눌러 속도를 줄이세요. 부딪히면 멈추니 줄이는 편이 더 빠릅니다.',
  overtakeStep3Title: '먼저 골인',
  overtakeStep3Body: '각자의 페이스로 달리는 차 3대보다 먼저 골인하면 다음 레벨이 열립니다.',
};
