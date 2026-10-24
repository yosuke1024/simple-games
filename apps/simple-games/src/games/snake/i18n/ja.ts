/**
 * Japanese catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): written by
 * AI (Claude) from the English source on 2026-10-17 and **not yet read by the
 * author**. It is not to be treated as reviewed. The title (`snakeName`) is
 * a proper noun and stays as it is in every locale.
 */
import type { SnakeMessages } from './en';

export const ja: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: '速さ',
  snakeSpeed_slow: 'ゆっくり',
  snakeSpeed_normal: 'ふつう',
  snakeSpeed_fast: 'はやい',
  snakeResumeNote: 'スコア {score} · {speed}',
  snakeBestNote: 'ベスト {score}',

  // Game screen
  snakeTopBest: 'ベスト {score} · {speed}',
  snakeBoardLabel: 'ヘビの盤面（{size} × {size}）：{state}',
  snakeStateReady: 'スタート待ち',
  snakeStateRunning: '移動中',
  snakeStatePaused: '一時停止中',
  snakeStateOver: 'ゲームオーバー',
  snakeStateCleared: '盤面が埋まった',
  snakeControls: '操作ボタン',
  snakeDir_up: '上',
  snakeDir_down: '下',
  snakeDir_left: '左',
  snakeDir_right: '右',
  snakeStart: 'スタート',
  snakePause: '一時停止',
  snakePaused: '一時停止中',
  snakeNextTurn: '次の向き：{direction}',

  // Screen reader announcements
  snakeLiveStarted: 'スタート',
  snakeLivePaused: '一時停止中。スコア {score}',
  snakeLiveResumed: '再開',
  snakeLiveScore: 'スコア {score}',
  snakeLiveWall: 'ゲームオーバー：壁にぶつかりました。スコア {score}',
  snakeLiveSelf: 'ゲームオーバー：自分の体にぶつかりました。スコア {score}',
  snakeLiveCleared: '盤面が埋まりました。スコア {score}',
  snakeLiveNextCleared: '次の向きを取り消しました',

  // Result
  snakeOverTitle: 'ゲームオーバー',
  snakeClearedTitle: '盤面が埋まりました',
  snakeOverWall: '壁にぶつかりました。',
  snakeOverSelf: '自分の体にぶつかりました。',
  snakeClearedBody: 'すべてのマスがヘビで埋まりました。',
  snakeLength: '長さ',
  snakeNewBest: '{speed}の自己ベスト',
  snakeBestAt: '{speed}のベスト：{score}',

  // Statistics
  snakeBestScore: 'ベストスコア',
  snakeClears: '盤面を埋めた回数',

  // Quick Rules
  snakeStep1Title: '曲がる',
  snakeStep1Body: 'スワイプ・矢印ボタン・矢印キーで曲がり、ヘビは 1 マスずつ進み続けます。',
  snakeStep2Title: '食べる',
  snakeStep2Body: '食べ物を取るとヘビが 1 マス伸び、1 点入ります。',
  snakeStep3Title: 'ぶつからない',
  snakeStep3Body: '壁か自分の体に当たると終わり、盤面をすべて埋めればクリアです。',
  snakeFigureTurn: '食べ物のほうへ上に曲がろうとしているヘビ',
  snakeFigureEat: '食べ物の 1 マス手前にいるヘビ',
  snakeFigureCrash: '壁にぶつかったヘビ',
};
