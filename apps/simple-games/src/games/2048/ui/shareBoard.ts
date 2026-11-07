import type { ShareBoardPreview } from '@/services/share/board';
import { BOARD_SIZE, type Game2048Session } from '../game';

// The light tile ramp from game-2048.css. An exported card has one stable
// palette regardless of the theme selected on the device that made it.
const TILE_COLORS: Readonly<Record<number, readonly [string, string]>> = {
  2: ['#e5dfd1', '#6b6456'],
  4: ['#d5cdb9', '#5c5442'],
  8: ['#a5cdb4', '#234f39'],
  16: ['#6fb695', '#133f2b'],
  32: ['#43a49e', '#ffffff'],
  64: ['#3d89b0', '#ffffff'],
  128: ['#5b73bd', '#ffffff'],
  256: ['#785fae', '#ffffff'],
  512: ['#9a5296', '#ffffff'],
  1024: ['#b0506e', '#ffffff'],
  2048: ['#bd7f33', '#ffffff'],
};

/** The visible position at the ending or the existing 2048 announcement. */
export function shareBoardOf(session: Game2048Session): ShareBoardPreview | null {
  if (session.status !== 'over' && !session.reached2048) return null;
  return {
    gameId: '2048',
    columns: BOARD_SIZE,
    rows: BOARD_SIZE,
    background: '#ddd7ca',
    gridColor: '#ddd7ca',
    cells: session.board.map((value) => {
      if (value === 0) return { fill: '#f3f0e9' };
      // Values beyond 2048 use the same gold face in the live board.
      const [fill, ink] = TILE_COLORS[Math.min(value, 2048)]!;
      return { text: String(value), fill, ink };
    }),
  };
}
