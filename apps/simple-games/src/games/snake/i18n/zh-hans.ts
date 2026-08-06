import type { SnakeMessages } from './en';

export const zhHans: SnakeMessages = {
  snakeName: 'Snake',
  snakeBoardLabel: 'Snake 棋盘，长度 {n}',
  snakeLength: '长度',
  snakeBestScore: '最高分',
  snakeBestLength: '最长纪录',
  snakeOverTitle: '这局结束了',
  snakeOverBody: '重试免费——新的一局马上开始。',
  snakeFullTitle: '整个棋盘！',
  snakeFullBody: '已经没有可以生长的地方了。',
  snakeNewBestScore: '你的新纪录！',
  snakeStep1Title: '滑动转向',
  snakeStep1Body: '蛇不会停下，滑动只改变它前进的方向。',
  snakeStep2Title: '吃到就变长',
  snakeStep2Body: '每吃一份食物就长一节，速度也会快一点。',
  snakeStep3Title: '当心墙壁',
  snakeStep3Body: '碰到墙壁或自己的身体就结束，而重来永远免费。',
};
