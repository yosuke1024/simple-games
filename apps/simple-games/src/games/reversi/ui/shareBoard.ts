import type { ShareBoardCell, ShareBoardPreview } from '@/services/share/board';
import { BLACK, BOARD_SIZE, WHITE, type ReversiSession } from '../game';

/** A finished match's discs retain their actual colour and row-major position. */
export function shareBoardOf(session: ReversiSession): ShareBoardPreview | null {
  if (session.status === 'playing') return null;
  return {
    gameId: 'reversi',
    columns: BOARD_SIZE,
    rows: BOARD_SIZE,
    background: '#648053',
    gridColor: '#4c6440',
    cells: session.board.map((piece): ShareBoardCell => {
      if (piece === BLACK) return { fill: '#648053', ink: '#20242b', piece: 'dark' };
      if (piece === WHITE) return { fill: '#648053', ink: '#f4f1e6', piece: 'light' };
      return { fill: '#648053' };
    }),
  };
}
