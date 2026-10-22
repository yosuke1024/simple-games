/**
 * Japanese catalog for Bounce Up.
 *
 * Provenance (docs/BOUNCE_UP_RULES.md §8, docs/I18N_POLICY.md「来歴」): written by
 * AI (Claude) from the English source on 2026-10-22 and **not yet read by
 * anyone** — neither the author nor a native speaker. It is not to be
 * treated as reviewed (the shell's `ja` is `author`; this game's is not).
 *
 * The title (`bounceUpName`) is a proper noun and stays as it is in every
 * locale. Terms follow §8's glossary: platform, score, best, total.
 */
import type { BounceUpMessages } from './en';

export const ja: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: '登りはじめる',
  bounceUpBestNote: 'ベスト {score}',
  bounceUpWidth: '足場',
  bounceUpWidth_normal: 'ふつう',
  bounceUpWidth_wide: '広い',
  bounceUpBest: 'ベストスコア',
  bounceUpTotal: '合計スコア',
  bounceUpBoardLabel: 'Bounce Up の盤面、{state}',
  bounceUpState_ready: '最初の操作を待っています',
  bounceUpState_running: '登っています',
  bounceUpState_paused: '一時停止中',
  bounceUpState_over: 'ラン終了',
  bounceUpTouchToStart: '盤面で指をすべらせるか ← → で始まります',
  bounceUpPaused: '一時停止中',
  bounceUpPause: '一時停止',
  bounceUpStart: 'スタート',
  bounceUpClimbAgain: 'もう一度登る',
  bounceUpPad: '移動ボタン',
  bounceUpMoveLeft: '左へ動く',
  bounceUpMoveRight: '右へ動く',
  bounceUpResultTitle: '{score} まで登った',
  bounceUpLiveResult: 'ランが終わりました。スコア {score}。',
  bounceUpStep1Title: 'すべらせて動く',
  bounceUpStep1Body:
    '盤面で指を左右にすべらせるか ← → を押して動き、足場に乗るたびに自動で跳ねます。',
  bounceUpStep2Title: '左右の端はつながっている',
  bounceUpStep2Body:
    '片方の端から出ると反対の端から入ってくるので、それも使って上の足場へ登ります。',
  bounceUpStep3Title: '高さがスコア',
  bounceUpStep3Body: '足場を逃して下まで落ちたらランは終わり、登った高さがスコアになります。',
};
