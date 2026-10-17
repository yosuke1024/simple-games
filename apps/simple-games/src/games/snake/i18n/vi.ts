/**
 * Vietnamese catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `Điểm` of the shell (`score`), `Cao nhất` for a best (Number Match),
 * `Thường` for Normal (the difficulty pickers), `ô` for a square, `bàn chơi`
 * for the board (Brick Breaker), `Ván` for one game (shell) and `mồi` for the
 * food. Inside a sentence a speed goes in brackets.
 * A no-break space keeps each dash off the start of a line.
 */
import type { SnakeMessages } from './en';

export const vi: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Tốc độ',
  snakeSpeed_slow: 'Chậm',
  snakeSpeed_normal: 'Thường',
  snakeSpeed_fast: 'Nhanh',
  snakeResumeNote: 'Điểm {score} · {speed}',
  snakeBestNote: 'Cao nhất {score}',

  // Game screen
  snakeTopBest: 'Cao nhất {score} · {speed}',
  snakeBoardLabel: 'Bàn chơi Snake, {size} nhân {size}: {state}',
  snakeStateReady: 'sẵn sàng bắt đầu',
  snakeStateRunning: 'đang di chuyển',
  snakeStatePaused: 'đang tạm dừng',
  snakeStateOver: 'trò chơi kết thúc',
  snakeStateCleared: 'đã lấp đầy bàn',
  snakeControls: 'Nút điều khiển',
  snakeDir_up: 'Lên',
  snakeDir_down: 'Xuống',
  snakeDir_left: 'Trái',
  snakeDir_right: 'Phải',
  snakeStart: 'Bắt đầu',
  snakePause: 'Tạm dừng',
  snakePaused: 'Đang tạm dừng',
  snakeNextTurn: 'Hướng tiếp theo: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Đã bắt đầu',
  snakeLivePaused: 'Đang tạm dừng. Điểm {score}',
  snakeLiveResumed: 'Đã tiếp tục',
  snakeLiveScore: 'Điểm {score}',
  snakeLiveWall: 'Trò chơi kết thúc: rắn đâm vào tường. Điểm {score}',
  snakeLiveSelf: 'Trò chơi kết thúc: rắn đâm vào chính thân mình. Điểm {score}',
  snakeLiveCleared: 'Đã lấp đầy bàn. Điểm {score}',
  snakeLiveNextCleared: 'Đã bỏ hướng tiếp theo',

  // Result
  snakeOverTitle: 'Trò chơi kết thúc',
  snakeClearedTitle: 'Đã lấp đầy bàn',
  snakeOverWall: 'Rắn đâm vào tường.',
  snakeOverSelf: 'Rắn đâm vào chính thân mình.',
  snakeClearedBody: 'Rắn đã phủ kín mọi ô.',
  snakeLength: 'Độ dài',
  snakeNewBest: 'Kỷ lục mới ({speed})',
  snakeBestAt: 'Cao nhất ({speed}): {score}',

  // Statistics
  snakeBestScore: 'Điểm cao nhất',
  snakeClears: 'Số lần lấp đầy bàn',

  // Quick Rules
  snakeStep1Title: 'Rẽ',
  snakeStep1Body:
    'Vuốt, chạm vào mũi tên hoặc nhấn phím mũi tên để rẽ\u00a0— rắn luôn tiến lên từng ô một.',
  snakeStep2Title: 'Ăn',
  snakeStep2Body: 'Mỗi lần ăn mồi, rắn dài thêm một ô và được một điểm.',
  snakeStep3Title: 'Tránh va chạm',
  snakeStep3Body: 'Đâm vào tường hoặc thân mình là thua\u00a0— lấp đầy cả bàn để thắng.',
  snakeFigureTurn: 'Rắn sắp rẽ lên phía mồi',
  snakeFigureEat: 'Rắn còn cách mồi một ô',
  snakeFigureCrash: 'Rắn đã đâm vào tường',
};
