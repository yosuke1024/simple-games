/**
 * Korean catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `점수` of the shell (`score`), `최고` for a best (Number Match), `칸` for
 * a square, `보드` for the board, and the polite `-니다` ending of the other
 * Korean catalogs. Each Quick Rules step stays one sentence.
 */
import type { SnakeMessages } from './en';

export const ko: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: '속도',
  snakeSpeed_slow: '느림',
  snakeSpeed_normal: '보통',
  snakeSpeed_fast: '빠름',
  snakeResumeNote: '점수 {score} · {speed}',
  snakeBestNote: '최고 {score}',

  // Game screen
  snakeTopBest: '최고 {score} · {speed}',
  snakeBoardLabel: 'Snake 보드, {size}×{size}: {state}',
  snakeStateReady: '시작 대기',
  snakeStateRunning: '이동 중',
  snakeStatePaused: '일시정지됨',
  snakeStateOver: '게임 오버',
  snakeStateCleared: '보드가 가득 참',
  snakeControls: '조작 버튼',
  snakeDir_up: '위',
  snakeDir_down: '아래',
  snakeDir_left: '왼쪽',
  snakeDir_right: '오른쪽',
  snakeStart: '시작',
  snakePause: '일시정지',
  snakePaused: '일시정지됨',
  snakeNextTurn: '다음 방향: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: '시작했습니다',
  snakeLivePaused: '일시정지했습니다. 점수 {score}',
  snakeLiveResumed: '다시 시작했습니다',
  snakeLiveScore: '점수 {score}',
  snakeLiveWall: '게임 오버: 뱀이 벽에 부딪혔습니다. 점수 {score}',
  snakeLiveSelf: '게임 오버: 뱀이 자기 몸에 부딪혔습니다. 점수 {score}',
  snakeLiveCleared: '보드를 가득 채웠습니다. 점수 {score}',
  snakeLiveNextCleared: '다음 방향을 취소했습니다',

  // Result
  snakeOverTitle: '게임 오버',
  snakeClearedTitle: '보드를 가득 채웠습니다',
  snakeOverWall: '뱀이 벽에 부딪혔습니다.',
  snakeOverSelf: '뱀이 자기 몸에 부딪혔습니다.',
  snakeClearedBody: '뱀이 모든 칸을 덮었습니다.',
  snakeLength: '길이',
  snakeNewBest: '최고 기록 경신 ({speed})',
  snakeBestAt: '최고 기록 ({speed}): {score}',

  // Statistics
  snakeBestScore: '최고 점수',
  snakeClears: '보드를 채운 횟수',

  // Quick Rules
  snakeStep1Title: '방향 바꾸기',
  snakeStep1Body:
    '스와이프하거나 화살표 버튼 또는 방향키를 눌러 방향을 바꾸며, 뱀은 한 칸씩 계속 나아갑니다.',
  snakeStep2Title: '먹기',
  snakeStep2Body: '먹이를 먹을 때마다 뱀이 한 칸 길어지고 1점을 얻습니다.',
  snakeStep3Title: '부딪히지 않기',
  snakeStep3Body: '벽이나 자기 몸에 부딪히면 끝나며, 보드를 모두 채우면 클리어입니다.',
  snakeFigureTurn: '먹이를 향해 위로 방향을 바꾸려는 뱀',
  snakeFigureEat: '먹이 한 칸 앞에 있는 뱀',
  snakeFigureCrash: '벽에 부딪힌 뱀',
};
