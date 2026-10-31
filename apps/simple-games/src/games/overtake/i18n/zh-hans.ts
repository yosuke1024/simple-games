/**
 * Simplified Chinese catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `名次` for Place (never 排名 or 排行榜), `剐蹭` for Bumps (never
 * 事故 or 撞车), the shell's `第 {n} 关` for Level.
 */
import type { OvertakeMessages } from './en';

export const zhHans: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: '操作',
  overtakeControlsDrag: '拖动',
  overtakeControlsButtons: '按钮',

  // The game screen
  overtakeStart: '开始',
  overtakePause: '暂停',
  overtakeTouchToStart: '触摸出发',
  overtakePaused: '已暂停',
  overtakePlaceNow: '4 辆中第 {place} 名',
  overtakeBoardLabel: 'Road Weave，第 {n} 关：{state}',
  overtakeState_ready: '等待出发',
  overtakeState_running: '行驶中',
  overtakeState_paused: '已暂停',
  overtakeState_finished: '已到终点',
  overtakePad: '驾驶按钮',
  overtakeSteerLeft: '向左',
  overtakeSteerRight: '向右',
  overtakeSlowDown: '松油门',

  // The finish
  overtakeLiveResult: '4 辆中第 {place} 名。剐蹭 {bumps} 次。',
  overtakeResultCleared: '第 {n} 关完成',
  overtakeResultPlaced: '第 {n} 关 — {place}',
  overtakePlace: '名次',
  overtakeBumps: '剐蹭',

  // Quick Rules (§10)
  overtakeStep1Title: '变道',
  overtakeStep1Body: '左右移动车辆来变道——油门是自动的，速度会自己升高。',
  overtakeStep2Title: '松油门',
  overtakeStep2BodyDrag: '车多的地方，手指向下拉来松油门——剐蹭会让你停下，所以松油门反而更快。',
  overtakeStep2BodyHold: '车多的地方，长按 ▼ 来松油门——剐蹭会让你停下，所以松油门反而更快。',
  overtakeStep3Title: '先到终点',
  overtakeStep3Body: '比按各自节奏行驶的 3 辆车先过终点线，下一关就会开启。',
};
