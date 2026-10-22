/**
 * Simplified Chinese catalog for Bounce Up.
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

export const zhHans: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: '开始攀登',
  bounceUpBestNote: '最佳 {score}',
  bounceUpWidth: '踏板',
  bounceUpWidth_normal: '标准',
  bounceUpWidth_wide: '加宽',
  bounceUpBest: '最佳分数',
  bounceUpTotal: '总分',
  bounceUpBoardLabel: 'Bounce Up 游戏画面，{state}',
  bounceUpState_ready: '等待第一次操作',
  bounceUpState_running: '正在攀登',
  bounceUpState_paused: '已暂停',
  bounceUpState_over: '本局结束',
  bounceUpTouchToStart: '在画面上滑动或按 ← → 开始',
  bounceUpPaused: '已暂停',
  bounceUpPause: '暂停',
  bounceUpStart: '开始',
  bounceUpClimbAgain: '再爬一次',
  bounceUpPad: '移动按钮',
  bounceUpMoveLeft: '向左移动',
  bounceUpMoveRight: '向右移动',
  bounceUpResultTitle: '到达 {score}',
  bounceUpLiveResult: '本局结束。分数 {score}。',
  bounceUpStep1Title: '滑动来移动',
  bounceUpStep1Body: '在画面上左右滑动手指或按 ← →，每次落到踏板上都会自动弹起。',
  bounceUpStep2Title: '左右两边相连',
  bounceUpStep2Body: '从一边出去就会从另一边进来，两边都可以用来登上上方的踏板。',
  bounceUpStep3Title: '高度就是分数',
  bounceUpStep3Body: '没踩到踏板而掉出画面底部时本局结束，到达的高度就是分数。',
};
