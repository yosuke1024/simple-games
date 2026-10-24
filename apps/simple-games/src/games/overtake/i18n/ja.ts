/**
 * Japanese catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): written by
 * AI (Claude) from the English source on 2026-10-21 and **not yet read by
 * the author** — nor by anyone else. It is not to be treated as reviewed
 * (the shell's `ja` is `author`; this game's is not).
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): 「着順」for Place (never 順位・ランキング), 「接触」for Bumps (never
 * 事故・クラッシュ), and the other three are 「ペースの違う 3 台」, never a rival,
 * an enemy or 対戦. The shell writes Level as 「レベル」.
 */
import type { OvertakeMessages } from './en';

export const ja: OvertakeMessages = {
  overtakeName: 'Overtake',

  // Home
  overtakeControls: '操作',
  overtakeControlsDrag: 'ドラッグ',
  overtakeControlsButtons: 'ボタン',

  // The game screen
  overtakeStart: 'スタート',
  overtakePause: '一時停止',
  overtakeTouchToStart: 'タッチで出発',
  overtakePaused: '一時停止中',
  overtakePlaceNow: '4 台中 {place} 位',
  overtakeBoardLabel: 'Overtake のコース、レベル {n}：{state}',
  overtakeState_ready: 'スタート待ち',
  overtakeState_running: '走行中',
  overtakeState_paused: '一時停止中',
  overtakeState_finished: 'ゴール',
  overtakePad: '運転ボタン',
  overtakeSteerLeft: '左へ',
  overtakeSteerRight: '右へ',
  overtakeSlowDown: 'ゆるめる',

  // The finish
  overtakeLiveResult: '4 台中 {place} 位。接触 {bumps} 回。',
  overtakeResultCleared: 'レベル {n} クリア',
  overtakeResultPlaced: 'レベル {n} — {place}',
  overtakePlace: '着順',
  overtakeBumps: '接触',

  // Quick Rules (§10)
  overtakeStep1Title: '車線を変える',
  overtakeStep1Body:
    '車を左右に動かして車線を変えます。アクセルは自動で、速度はひとりでに上がります。',
  overtakeStep2Title: 'ゆるめる',
  overtakeStep2BodyDrag:
    '混んだところは指を下へ引いてゆるめます。ぶつかると止まるので、ゆるめるほうが速く進めます。',
  overtakeStep2BodyHold:
    '混んだところは ▼ を長押ししてゆるめます。ぶつかると止まるので、ゆるめるほうが速く進めます。',
  overtakeStep3Title: '先にゴール',
  overtakeStep3Body: 'ペースの違う 3 台より先にゴールすれば、次のレベルが開きます。',
};
