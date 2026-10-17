/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): this is
 * the source. Every other catalog is measured against it.
 *
 * Wording rules (docs/I18N_POLICY.md「文言設計」): short verbs and nouns on
 * buttons, one sentence per Quick Rules step, every variable part passed as
 * `{var}` — never a sentence glued together in code. Nothing here promises
 * anything about money, ads, the network, or what is kept or deleted.
 */
export const en = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Speed',
  snakeSpeed_slow: 'Slow',
  snakeSpeed_normal: 'Normal',
  snakeSpeed_fast: 'Fast',
  snakeResumeNote: 'Score {score} · {speed}',
  snakeBestNote: 'Best {score}',

  // Game screen
  snakeTopBest: 'Best {score} · {speed}',
  snakeBoardLabel: 'Snake board, {size} by {size}: {state}',
  snakeStateReady: 'ready to start',
  snakeStateRunning: 'moving',
  snakeStatePaused: 'paused',
  snakeStateOver: 'game over',
  snakeStateCleared: 'board filled',
  snakeControls: 'Controls',
  snakeDir_up: 'Up',
  snakeDir_down: 'Down',
  snakeDir_left: 'Left',
  snakeDir_right: 'Right',
  snakeStart: 'Start',
  snakePause: 'Pause',
  snakePaused: 'Paused',
  snakeNextTurn: 'Next turn: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Started',
  snakeLivePaused: 'Paused. Score {score}',
  snakeLiveResumed: 'Resumed',
  snakeLiveScore: 'Score {score}',
  snakeLiveWall: 'Game over: the snake hit the wall. Score {score}',
  snakeLiveSelf: 'Game over: the snake ran into itself. Score {score}',
  snakeLiveCleared: 'Board filled. Score {score}',
  snakeLiveNextCleared: 'Next turn cleared',

  // Result
  snakeOverTitle: 'Game over',
  snakeClearedTitle: 'Board filled',
  snakeOverWall: 'The snake hit the wall.',
  snakeOverSelf: 'The snake ran into itself.',
  snakeClearedBody: 'The snake covers every square.',
  snakeLength: 'Length',
  snakeNewBest: 'New best at {speed}',
  snakeBestAt: 'Best at {speed}: {score}',

  // Statistics
  snakeBestScore: 'Best score',
  snakeClears: 'Boards filled',

  // Quick Rules
  snakeStep1Title: 'Turn',
  snakeStep1Body:
    'Swipe, tap an arrow or press an arrow key to turn — the snake keeps moving one square at a time.',
  snakeStep2Title: 'Eat',
  snakeStep2Body: 'Each food makes the snake one square longer and scores a point.',
  snakeStep3Title: 'Don’t crash',
  snakeStep3Body:
    'Hitting a wall or the snake’s own body ends the run — fill the whole board to clear it.',
  snakeFigureTurn: 'A snake about to turn up towards the food',
  snakeFigureEat: 'A snake one square from the food',
  snakeFigureCrash: 'A snake that has hit the wall',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SnakeMessages = Record<keyof typeof en, string>;
