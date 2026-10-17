/**
 * Traditional Chinese catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * Taiwan usage, as in the shell: `分數` for the score (shell `score`), `最佳` for
 * a best (Number Match), `格子` for a square, `盤面` for the board (2048) and
 * `過關` for a clear (shell `cleared`). Full-width punctuation, a space between
 * Latin letters or digits and Han.
 */
import type { SnakeMessages } from './en';

export const zhHant: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: '速度',
  snakeSpeed_slow: '慢速',
  snakeSpeed_normal: '普通',
  snakeSpeed_fast: '快速',
  snakeResumeNote: '分數 {score} · {speed}',
  snakeBestNote: '最佳 {score}',

  // Game screen
  snakeTopBest: '最佳 {score} · {speed}',
  snakeBoardLabel: 'Snake 盤面，{size}×{size}：{state}',
  snakeStateReady: '等待開始',
  snakeStateRunning: '移動中',
  snakeStatePaused: '已暫停',
  snakeStateOver: '遊戲結束',
  snakeStateCleared: '盤面已填滿',
  snakeControls: '操作按鈕',
  snakeDir_up: '上',
  snakeDir_down: '下',
  snakeDir_left: '左',
  snakeDir_right: '右',
  snakeStart: '開始',
  snakePause: '暫停',
  snakePaused: '已暫停',
  snakeNextTurn: '下一個方向：{direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: '已開始',
  snakeLivePaused: '已暫停。分數 {score}',
  snakeLiveResumed: '已繼續',
  snakeLiveScore: '分數 {score}',
  snakeLiveWall: '遊戲結束：蛇撞到了牆。分數 {score}',
  snakeLiveSelf: '遊戲結束：蛇撞到了自己的身體。分數 {score}',
  snakeLiveCleared: '盤面已填滿。分數 {score}',
  snakeLiveNextCleared: '已取消下一個方向',

  // Result
  snakeOverTitle: '遊戲結束',
  snakeClearedTitle: '盤面已填滿',
  snakeOverWall: '蛇撞到了牆。',
  snakeOverSelf: '蛇撞到了自己的身體。',
  snakeClearedBody: '蛇佔滿了所有格子。',
  snakeLength: '長度',
  snakeNewBest: '新紀錄（{speed}）',
  snakeBestAt: '最佳（{speed}）：{score}',

  // Statistics
  snakeBestScore: '最高分',
  snakeClears: '填滿盤面次數',

  // Quick Rules
  snakeStep1Title: '轉向',
  snakeStep1Body: '滑動、點按箭頭或按方向鍵來轉向，蛇會一格一格地不停前進。',
  snakeStep2Title: '進食',
  snakeStep2Body: '吃到食物後，蛇變長一格並得一分。',
  snakeStep3Title: '別撞上',
  snakeStep3Body: '撞到牆或自己的身體就結束，填滿整個盤面即可過關。',
  snakeFigureTurn: '即將向上轉向食物的蛇',
  snakeFigureEat: '離食物還差一格的蛇',
  snakeFigureCrash: '撞到牆的蛇',
};
