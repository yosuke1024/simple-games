/**
 * Simplified Chinese catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `得分` of the shell (`score`), `最佳` for a best (Number Match), `格子` for
 * a square, `盘面` for the board (2048) and `通关` for a clear (shell `cleared`).
 * Full-width punctuation, a space between Latin letters or digits and Han.
 */
import type { SnakeMessages } from './en';

export const zhHans: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: '速度',
  snakeSpeed_slow: '慢速',
  snakeSpeed_normal: '普通',
  snakeSpeed_fast: '快速',
  snakeResumeNote: '得分 {score} · {speed}',
  snakeBestNote: '最佳 {score}',

  // Game screen
  snakeTopBest: '最佳 {score} · {speed}',
  snakeBoardLabel: 'Snake 盘面，{size}×{size}：{state}',
  snakeStateReady: '等待开始',
  snakeStateRunning: '移动中',
  snakeStatePaused: '已暂停',
  snakeStateOver: '游戏结束',
  snakeStateCleared: '盘面已填满',
  snakeControls: '操作按钮',
  snakeDir_up: '上',
  snakeDir_down: '下',
  snakeDir_left: '左',
  snakeDir_right: '右',
  snakeStart: '开始',
  snakePause: '暂停',
  snakePaused: '已暂停',
  snakeNextTurn: '下一个方向：{direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: '已开始',
  snakeLivePaused: '已暂停。得分 {score}',
  snakeLiveResumed: '已继续',
  snakeLiveScore: '得分 {score}',
  snakeLiveWall: '游戏结束：蛇撞到了墙。得分 {score}',
  snakeLiveSelf: '游戏结束：蛇撞到了自己的身体。得分 {score}',
  snakeLiveCleared: '盘面已填满。得分 {score}',
  snakeLiveNextCleared: '已取消下一个方向',

  // Result
  snakeOverTitle: '游戏结束',
  snakeClearedTitle: '盘面已填满',
  snakeOverWall: '蛇撞到了墙。',
  snakeOverSelf: '蛇撞到了自己的身体。',
  snakeClearedBody: '蛇占满了所有格子。',
  snakeLength: '长度',
  snakeNewBest: '新纪录（{speed}）',
  snakeBestAt: '最佳（{speed}）：{score}',

  // Statistics
  snakeBestScore: '最高分',
  snakeClears: '填满盘面次数',

  // Quick Rules
  snakeStep1Title: '转向',
  snakeStep1Body: '滑动、点按箭头或按方向键来转向，蛇会一格一格地不停前进。',
  snakeStep2Title: '进食',
  snakeStep2Body: '吃到食物后，蛇变长一格并得一分。',
  snakeStep3Title: '别撞上',
  snakeStep3Body: '撞到墙或自己的身体就结束，填满整个盘面即可通关。',
  snakeFigureTurn: '即将向上转向食物的蛇',
  snakeFigureEat: '离食物还差一格的蛇',
  snakeFigureCrash: '撞到墙的蛇',
};
