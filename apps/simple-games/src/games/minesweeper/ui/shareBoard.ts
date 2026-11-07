import type { ShareBoardCell, ShareBoardPreview } from '@/services/share/board';
import { cellViews, type MinesweeperSession } from '../game';

// The board's light-theme number scale from minesweeper.css.
const NUMBER_INKS = [
  '#232a33',
  '#2f5fbf',
  '#2c7a4b',
  '#c2603f',
  '#6a4fa3',
  '#8a5a2b',
  '#1f7a72',
  '#4a4a4a',
  '#6b6b6b',
] as const;

/** Copy the UI's cell projection, never derive a second view of the mine map. */
export function shareBoardOf(session: MinesweeperSession): ShareBoardPreview | null {
  if (session.status === 'playing' || session.mode === 'daily') return null;
  return {
    gameId: 'minesweeper',
    columns: session.board.field.width,
    rows: session.board.field.height,
    background: '#ddd7ca',
    gridColor: '#ddd7ca',
    cells: cellViews(session.board).map((view): ShareBoardCell => {
      if (view.kind === 'number') {
        return {
          fill: '#e8e4d9',
          ...(view.count > 0 ? { text: String(view.count), ink: NUMBER_INKS[view.count] } : {}),
        };
      }
      if (view.kind === 'flagged') {
        return { fill: '#fffdf8', ink: '#4a5a72', piece: 'flag' };
      }
      if (view.kind === 'mine') {
        return {
          fill: view.exploded ? '#f6e4db' : '#e8e4d9',
          ink: view.exploded ? '#c2603f' : '#5c6772',
          piece: 'mine',
        };
      }
      return { fill: '#fffdf8' };
    }),
  };
}
