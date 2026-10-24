/**
 * Traditional Chinese catalog for Bounce Up.
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

export const zhHant: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: '開始攀登',
  bounceUpBestNote: '最佳 {score}',
  bounceUpWidth: '踏板',
  bounceUpWidth_normal: '標準',
  bounceUpWidth_wide: '加寬',
  bounceUpBest: '最佳分數',
  bounceUpTotal: '總分',
  bounceUpBoardLabel: 'Bounce Up 遊戲畫面，{state}',
  bounceUpState_ready: '等待第一次操作',
  bounceUpState_running: '正在攀登',
  bounceUpState_paused: '已暫停',
  bounceUpState_over: '本局結束',
  bounceUpTouchToStart: '在畫面上滑動或按 ← → 開始',
  bounceUpPaused: '已暫停',
  bounceUpPause: '暫停',
  bounceUpStart: '開始',
  bounceUpClimbAgain: '再爬一次',
  bounceUpPad: '移動按鈕',
  bounceUpMoveLeft: '向左移動',
  bounceUpMoveRight: '向右移動',
  bounceUpResultTitle: '到達 {score}',
  bounceUpLiveResult: '本局結束。分數 {score}。',
  bounceUpStep1Title: '滑動來移動',
  bounceUpStep1Body: '在畫面上左右滑動手指或按 ← →，每次落到踏板上都會自動彈起。',
  bounceUpStep2Title: '左右兩邊相連',
  bounceUpStep2Body: '從一邊出去就會從另一邊進來，兩邊都可以用來登上上方的踏板。',
  bounceUpStep3Title: '高度就是分數',
  bounceUpStep3Body: '沒踩到踏板而掉出畫面底部時本局結束，到達的高度就是分數。',
};
