/**
 * Traditional Chinese catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `名次` for Place (never 排名 or 排行榜), `擦撞` for Bumps (never
 * 事故 or 車禍), the shell's `第 {n} 關` for Level.
 */
import type { OvertakeMessages } from './en';

export const zhHant: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: '操作',
  overtakeControlsDrag: '拖曳',
  overtakeControlsButtons: '按鈕',

  // The game screen
  overtakeStart: '開始',
  overtakePause: '暫停',
  overtakeTouchToStart: '觸碰出發',
  overtakePaused: '已暫停',
  overtakePlaceNow: '4 輛中第 {place} 名',
  overtakeBoardLabel: 'Road Weave，第 {n} 關：{state}',
  overtakeState_ready: '等待出發',
  overtakeState_running: '行駛中',
  overtakeState_paused: '已暫停',
  overtakeState_finished: '已到終點',
  overtakePad: '駕駛按鈕',
  overtakeSteerLeft: '向左',
  overtakeSteerRight: '向右',
  overtakeSlowDown: '鬆油門',

  // The finish
  overtakeLiveResult: '4 輛中第 {place} 名。擦撞 {bumps} 次。',
  overtakeResultCleared: '第 {n} 關完成',
  overtakeResultPlaced: '第 {n} 關 — {place}',
  overtakePlace: '名次',
  overtakeBumps: '擦撞',

  // Quick Rules (§10)
  overtakeStep1Title: '變換車道',
  overtakeStep1Body: '左右移動車子來變換車道——油門是自動的，速度會自己提高。',
  overtakeStep2Title: '鬆油門',
  overtakeStep2BodyDrag: '車多的地方，手指往下拉來鬆油門——擦撞會讓你停下，所以鬆油門反而更快。',
  overtakeStep2BodyHold: '車多的地方，長按 ▼ 來鬆油門——擦撞會讓你停下，所以鬆油門反而更快。',
  overtakeStep3Title: '先到終點',
  overtakeStep3Body: '比以各自步調行駛的 3 輛車更早越過終點線，下一關就會開啟。',
};
